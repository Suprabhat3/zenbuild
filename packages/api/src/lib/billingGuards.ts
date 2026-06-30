import { TRPCError } from "@trpc/server";
import {
  InsufficientCreditsError,
  PlanLimitError,
  assertCanRunWorkflow,
  getPlan,
} from "@zenbuild/billing";
import type { PlanTier, PrismaClient, WorkflowType } from "@zenbuild/db";

import type { PlanFeatures } from "@zenbuild/billing";

/**
 * tRPC-layer plan/credit guards. These translate billing-domain errors
 * (`InsufficientCreditsError`, `PlanLimitError`) into `TRPCError`s with the
 * original carried as `cause`, so the root error formatter can attach a
 * structured upsell payload for the UI. Used at the user-initiated AI
 * mutations and the repo-connect path.
 */

/** Throws FORBIDDEN with an upsell when the org can't afford the AI workflow. */
export async function guardWorkflowCredits(
  db: PrismaClient,
  organizationId: string,
  type: WorkflowType,
): Promise<void> {
  try {
    await assertCanRunWorkflow(db, organizationId, type);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      throw new TRPCError({ code: "FORBIDDEN", message: err.message, cause: err });
    }
    throw err;
  }
}

/** Throws FORBIDDEN with an upsell when the plan doesn't include `feature`. */
export function guardPlanFeature(
  plan: PlanTier,
  feature: keyof PlanFeatures,
  label: string,
): void {
  if (!getPlan(plan).features[feature]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `${label} isn't available on the ${plan} plan. Upgrade to unlock it.`,
      cause: new PlanLimitError(plan, "feature", label),
    });
  }
}

/** Loads the org's plan and gates a premium feature. */
export async function guardOrgFeature(
  db: PrismaClient,
  organizationId: string,
  feature: keyof PlanFeatures,
  label: string,
): Promise<void> {
  const sub = await db.subscription.findUnique({
    where: { organizationId },
    select: { plan: true },
  });
  // No subscription → don't block the core loop (defensive; orgs always have one).
  if (!sub) return;
  guardPlanFeature(sub.plan, feature, label);
}

/** Throws FORBIDDEN with an upsell when connecting would exceed the repo limit. */
export function guardRepoLimit(plan: PlanTier, currentRepoCount: number): void {
  const limit = getPlan(plan).repoLimit;
  if (currentRepoCount >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `The ${plan} plan allows up to ${limit} connected ${
        limit === 1 ? "repository" : "repositories"
      }. Upgrade to connect more.`,
      cause: new PlanLimitError(plan, "repos", `repo limit (${limit})`),
    });
  }
}
