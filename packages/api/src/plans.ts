import type { AccountType, PlanTier } from "@zenbuild/db";

/**
 * Server-authoritative plan catalog. The web UI renders its own marketing copy
 * (names, prices, feature bullets); this module is the source of truth for what
 * a plan *grants* and which plans each account type may select. Razorpay
 * checkout (Phase 13) will layer real payments on top — onboarding only records
 * the chosen tier.
 */

/** Monthly AI review credits granted by each plan. */
export const PLAN_REVIEW_CREDITS: Record<PlanTier, number> = {
  FREE: 25,
  PRO: 200,
  TEAM: 500,
};

/** Which plan tiers each account type is allowed to choose during onboarding. */
export const ACCOUNT_PLAN_OPTIONS: Record<AccountType, PlanTier[]> = {
  INDIVIDUAL: ["FREE", "PRO"],
  ORGANIZATION: ["FREE", "TEAM"],
};

/** True if `plan` is selectable for the given account type. */
export function isPlanAllowedForAccount(
  accountType: AccountType,
  plan: PlanTier,
): boolean {
  return ACCOUNT_PLAN_OPTIONS[accountType].includes(plan);
}
