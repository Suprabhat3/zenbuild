import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { welcomeEmail, getMailer } from "@zenbuild/email";
import { serverEnv, clientEnv } from "@zenbuild/env";

import {
  ACCOUNT_PLAN_OPTIONS,
  PLAN_REVIEW_CREDITS,
  isPlanAllowedForAccount,
} from "../plans";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const accountTypeSchema = z.enum(["INDIVIDUAL", "ORGANIZATION"]);
const planSchema = z.enum(["FREE", "PRO", "TEAM"]);

function slugifyBase(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || "workspace";
}

/** Unique organization slug: bare base first, then short random suffixes. */
async function uniqueSlug(
  db: { organization: { findUnique: (args: { where: { slug: string } }) => Promise<unknown> } },
  name: string,
): Promise<string> {
  const base = slugifyBase(name);
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base}-${randomBytes(3).toString("hex")}`;
    const existing = await db.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${base}-${randomBytes(8).toString("hex")}`;
}

const appUrl =
  serverEnv.BETTER_AUTH_URL ??
  clientEnv.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";

/**
 * Onboarding: the first thing a verified user does. They choose Individual vs.
 * Organization and a plan; we provision the workspace (org + owner membership +
 * subscription) and send a welcome email. Reads/writes here are NOT org-scoped
 * because the user has no active org yet.
 */
export const onboardingRouter = createTRPCRouter({
  /** Whether the user already belongs to a workspace (→ skip onboarding). */
  status: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.db.member.findFirst({
      where: { userId: ctx.user.id },
      select: { organizationId: true },
    });
    return { onboarded: Boolean(membership) };
  }),

  /** Plan tiers selectable per account type (mirrors the server catalog). */
  planOptions: protectedProcedure.query(() => ACCOUNT_PLAN_OPTIONS),

  /**
   * Provision the user's first workspace from their onboarding choices.
   * Idempotent: if the user already has a membership we return it untouched
   * instead of creating a duplicate workspace.
   */
  complete: protectedProcedure
    .input(
      z.object({
        accountType: accountTypeSchema,
        workspaceName: z
          .string()
          .trim()
          .min(2, "Name must be at least 2 characters.")
          .max(60, "Name is too long."),
        plan: planSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Already onboarded → no-op, return existing workspace.
      const existing = await ctx.db.member.findFirst({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "asc" },
        include: { organization: { select: { id: true, slug: true } } },
      });
      if (existing) {
        return {
          organizationId: existing.organization.id,
          slug: existing.organization.slug,
          alreadyOnboarded: true as const,
        };
      }

      if (!isPlanAllowedForAccount(input.accountType, input.plan)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `The ${input.plan} plan isn't available for ${input.accountType.toLowerCase()} accounts.`,
        });
      }

      const slug = await uniqueSlug(ctx.db, input.workspaceName);
      const credits = PLAN_REVIEW_CREDITS[input.plan];

      const organization = await ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: input.workspaceName,
            slug,
            accountType: input.accountType,
          },
        });
        await tx.member.create({
          data: { organizationId: org.id, userId: ctx.user.id, role: "owner" },
        });
        await tx.subscription.create({
          data: {
            organizationId: org.id,
            plan: input.plan,
            status: "ACTIVE",
            reviewCreditsTotal: credits,
            reviewCreditsUsed: 0,
          },
        });
        await tx.creditLedger.create({
          data: {
            organizationId: org.id,
            reason: "GRANT",
            delta: credits,
            balance: credits,
            metadata: { source: "onboarding", plan: input.plan },
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: org.id,
            actorId: ctx.user.id,
            action: "onboarding.complete",
            entityType: "organization",
            entityId: org.id,
            metadata: { accountType: input.accountType, plan: input.plan },
          },
        });
        return org;
      });

      // Welcome email — best-effort; a delivery failure must not fail onboarding.
      try {
        const message = welcomeEmail({
          name: ctx.user.name,
          workspaceName: organization.name,
          accountType: input.accountType,
          dashboardUrl: `${appUrl}/dashboard`,
        });
        await getMailer().send({
          to: ctx.user.email,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to send welcome email:", error);
      }

      return {
        organizationId: organization.id,
        slug: organization.slug,
        alreadyOnboarded: false as const,
      };
    }),
});
