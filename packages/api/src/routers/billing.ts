import { TRPCError } from "@trpc/server";
import {
  ACCOUNT_PLAN_OPTIONS,
  activateSubscription,
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  getPlan,
  isPlanAllowedForAccount,
  isRazorpayConfigured,
  razorpayKeyId,
  upgradeTierForAccount,
  verifySubscriptionPaymentSignature,
} from "@zenbuild/billing";
import { serverEnv } from "@zenbuild/env";
import { z } from "zod";

import { createTRPCRouter, orgProcedure, requireRole } from "../trpc";

const planTierSchema = z.enum(["FREE", "PRO", "TEAM"]);

/** Public-safe view of a plan definition (no internal-only fields). */
function planView(tier: "FREE" | "PRO" | "TEAM") {
  const p = getPlan(tier);
  return {
    tier: p.tier,
    monthlyCredits: p.monthlyCredits,
    repoLimit: p.repoLimit,
    seatLimit: p.seatLimit,
    features: p.features,
    priceInInr: p.priceInInr,
    /** Whether this tier can actually be subscribed to on this deployment. */
    available: p.tier === "FREE" || Boolean(p.razorpayPlanId),
  };
}

/**
 * Phase-13 billing surface. Reads (`summary`, `plans`, `ledger`) are open to any
 * member; subscription mutations (`createSubscription`, `verifyPayment`,
 * `cancel`) are gated to owners/admins. Razorpay is the source of truth for
 * payment state — these mutations create/cancel subscriptions and optimistically
 * reflect the result, while the webhook (`/api/razorpay/webhook`) reconciles
 * authoritatively.
 */
export const billingRouter = createTRPCRouter({
  /** Current plan, usage (credits / repos / seats), and upgrade options. */
  summary: orgProcedure.query(async ({ ctx }) => {
    const [org, repoCount] = await Promise.all([
      ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        include: {
          subscription: true,
          _count: { select: { members: true } },
        },
      }),
      ctx.db.repository.count({ where: { organizationId: ctx.organizationId } }),
    ]);
    if (!org) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
    }

    const plan = org.subscription?.plan ?? "FREE";
    const def = getPlan(plan);
    const total = org.subscription?.reviewCreditsTotal ?? def.monthlyCredits;
    const used = org.subscription?.reviewCreditsUsed ?? 0;

    const allowedTiers = ACCOUNT_PLAN_OPTIONS[org.accountType];
    const upgradeTier = upgradeTierForAccount(org.accountType);

    return {
      accountType: org.accountType,
      configured: isRazorpayConfigured(),
      role: ctx.role,
      subscription: {
        plan,
        status: org.subscription?.status ?? "ACTIVE",
        currentPeriodEnd: org.subscription?.currentPeriodEnd ?? null,
        hasRazorpaySubscription: Boolean(org.subscription?.razorpaySubId),
      },
      usage: {
        credits: { total, used, remaining: Math.max(0, total - used) },
        repos: { used: repoCount, limit: def.repoLimit },
        seats: { used: org._count.members, limit: def.seatLimit },
      },
      currentPlan: planView(plan),
      plans: allowedTiers.map(planView),
      upgradeTier:
        upgradeTier && upgradeTier !== plan ? planView(upgradeTier) : null,
    };
  }),

  /** The plan catalog selectable for the active org's account type. */
  plans: orgProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { accountType: true },
    });
    const tiers = ACCOUNT_PLAN_OPTIONS[org?.accountType ?? "ORGANIZATION"];
    return tiers.map(planView);
  }),

  /** Recent credit-ledger entries (newest first) for the usage timeline. */
  ledger: orgProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25) }).optional())
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.creditLedger.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 25,
      });
      return entries.map((e) => ({
        id: e.id,
        reason: e.reason,
        delta: e.delta,
        balance: e.balance,
        createdAt: e.createdAt,
      }));
    }),

  /**
   * Create a Razorpay subscription for a paid plan and return the parameters the
   * browser Checkout needs. The local subscription's plan isn't changed yet —
   * `verifyPayment` (and the webhook) flips it once payment authorizes.
   */
  createSubscription: requireRole("owner", "admin")
    .input(z.object({ plan: planTierSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!isRazorpayConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Razorpay is not configured on this deployment.",
        });
      }
      if (input.plan === "FREE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The Free plan does not require checkout.",
        });
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { accountType: true, name: true },
      });
      if (!org) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found." });
      }
      if (!isPlanAllowedForAccount(org.accountType, input.plan)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The ${input.plan} plan isn't available for ${org.accountType.toLowerCase()} accounts.`,
        });
      }

      const planId = getPlan(input.plan).razorpayPlanId;
      if (!planId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `The ${input.plan} plan has no Razorpay plan id configured.`,
        });
      }

      const sub = await createRazorpaySubscription({
        planId,
        notes: {
          organizationId: ctx.organizationId,
          tier: input.plan,
          workspace: org.name,
        },
      });

      // Persist the pending subscription id so the webhook can resolve the org.
      await ctx.db.subscription.update({
        where: { organizationId: ctx.organizationId },
        data: { razorpaySubId: sub.id },
      });

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorId: ctx.user.id,
          action: "billing.checkout.start",
          entityType: "subscription",
          entityId: sub.id,
          metadata: { plan: input.plan },
        },
      });

      return {
        subscriptionId: sub.id,
        keyId: razorpayKeyId(),
        plan: input.plan,
        shortUrl: sub.shortUrl,
        customerName: ctx.user.name,
        customerEmail: ctx.user.email,
      };
    }),

  /**
   * Verify the signature Razorpay Checkout returns to the browser and
   * optimistically activate the plan. The webhook reconciles authoritatively;
   * this just gives the user instant feedback. Idempotent.
   */
  verifyPayment: requireRole("owner", "admin")
    .input(
      z.object({
        plan: planTierSchema,
        razorpayPaymentId: z.string().min(1),
        razorpaySubscriptionId: z.string().min(1),
        signature: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!serverEnv.RAZORPAY_KEY_SECRET) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Razorpay is not configured on this deployment.",
        });
      }

      const ok = verifySubscriptionPaymentSignature({
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySubscriptionId: input.razorpaySubscriptionId,
        signature: input.signature,
        keySecret: serverEnv.RAZORPAY_KEY_SECRET,
      });
      if (!ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payment signature verification failed.",
        });
      }

      // Bind the subscription id to this org if not already, then activate.
      const current = await ctx.db.subscription.findUnique({
        where: { organizationId: ctx.organizationId },
        select: { razorpaySubId: true },
      });
      if (
        current?.razorpaySubId &&
        current.razorpaySubId !== input.razorpaySubscriptionId
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Subscription mismatch for this workspace.",
        });
      }

      await activateSubscription(ctx.db, {
        organizationId: ctx.organizationId,
        plan: input.plan,
        status: "ACTIVE",
        razorpaySubId: input.razorpaySubscriptionId,
        source: "checkout.verify",
      });

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorId: ctx.user.id,
          action: "billing.subscribe",
          entityType: "subscription",
          entityId: input.razorpaySubscriptionId,
          metadata: { plan: input.plan, paymentId: input.razorpayPaymentId },
        },
      });

      return { ok: true, plan: input.plan };
    }),

  /** Cancel the active paid subscription (at cycle end by default). */
  cancel: requireRole("owner", "admin")
    .input(z.object({ immediate: z.boolean().default(false) }).optional())
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.subscription.findUnique({
        where: { organizationId: ctx.organizationId },
        select: { razorpaySubId: true, plan: true },
      });
      if (!sub?.razorpaySubId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active paid subscription to cancel.",
        });
      }
      if (!isRazorpayConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Razorpay is not configured on this deployment.",
        });
      }

      const cancelAtCycleEnd = !input?.immediate;
      const result = await cancelRazorpaySubscription(
        sub.razorpaySubId,
        cancelAtCycleEnd,
      );

      // Mark cancelled locally; the webhook will finalize the downgrade. When
      // cancelling immediately, drop to FREE now.
      if (input?.immediate) {
        await activateSubscription(ctx.db, {
          organizationId: ctx.organizationId,
          plan: "FREE",
          status: "CANCELLED",
          razorpaySubId: null,
          source: "cancel.immediate",
        });
      } else {
        await ctx.db.subscription.update({
          where: { organizationId: ctx.organizationId },
          data: { status: "CANCELLED" },
        });
      }

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorId: ctx.user.id,
          action: "billing.cancel",
          entityType: "subscription",
          entityId: sub.razorpaySubId,
          metadata: { immediate: Boolean(input?.immediate), plan: sub.plan },
        },
      });

      return { ok: true, status: result.status, cancelAtCycleEnd };
    }),
});
