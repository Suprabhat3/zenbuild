import type { AccountType, PlanTier } from "@zenbuild/db";
import { serverEnv } from "@zenbuild/env";

/**
 * Server-authoritative plan catalog. This module is the single source of truth
 * for what each plan *grants* (AI credits, repo limits, premium features) and
 * which plans an account type may select. The web app renders its own marketing
 * copy on top of this; nothing the client sends is trusted.
 *
 * Razorpay plan ids are read from env (test-mode subscription plans created in
 * the dashboard). A paid tier with no configured plan id can't be subscribed
 * to — the billing UI degrades to an "unconfigured" state, mirroring the
 * GitHub App's graceful-degradation pattern.
 */

/** Premium feature flags gated by plan. */
export interface PlanFeatures {
  /** AI release-readiness assessment (Phase 12). Free tier ships without it;
   *  the manual approval gate still works, the AI verdict is the upsell. */
  releaseReadiness: boolean;
  /** Priority support (presentation-only; no runtime effect). */
  prioritySupport: boolean;
}

export interface PlanDefinition {
  tier: PlanTier;
  /** Monthly AI credits granted on subscribe/renewal. Consumed by AI ops. */
  monthlyCredits: number;
  /** Max connected GitHub repositories. */
  repoLimit: number;
  /** Max workspace members; `null` = unlimited. Advisory (surfaced in UI). */
  seatLimit: number | null;
  features: PlanFeatures;
  /** Monthly price in paise-free INR (display only; Razorpay holds the truth). */
  priceInInr: number;
  /** Razorpay subscription plan id (test mode); null for free / unconfigured. */
  razorpayPlanId: string | null;
}

export const PLAN_DEFINITIONS: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: "FREE",
    monthlyCredits: 25,
    repoLimit: 1,
    seatLimit: 3,
    features: { releaseReadiness: false, prioritySupport: false },
    priceInInr: 0,
    razorpayPlanId: null,
  },
  PRO: {
    tier: "PRO",
    monthlyCredits: 200,
    repoLimit: 5,
    seatLimit: 1,
    features: { releaseReadiness: true, prioritySupport: true },
    priceInInr: 999,
    razorpayPlanId: serverEnv.RAZORPAY_PLAN_ID_PRO ?? null,
  },
  TEAM: {
    tier: "TEAM",
    monthlyCredits: 500,
    repoLimit: 25,
    seatLimit: null,
    features: { releaseReadiness: true, prioritySupport: true },
    priceInInr: 2499,
    razorpayPlanId: serverEnv.RAZORPAY_PLAN_ID_TEAM ?? null,
  },
};

/** Convenience accessor. */
export function getPlan(tier: PlanTier): PlanDefinition {
  return PLAN_DEFINITIONS[tier];
}

/** Monthly AI credits granted by each plan (back-compat with onboarding). */
export const PLAN_REVIEW_CREDITS: Record<PlanTier, number> = {
  FREE: PLAN_DEFINITIONS.FREE.monthlyCredits,
  PRO: PLAN_DEFINITIONS.PRO.monthlyCredits,
  TEAM: PLAN_DEFINITIONS.TEAM.monthlyCredits,
};

/** Which plan tiers each account type may choose. */
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

/** The paid upgrade tier offered to a given account type (if any). */
export function upgradeTierForAccount(accountType: AccountType): PlanTier | null {
  return accountType === "INDIVIDUAL" ? "PRO" : "TEAM";
}

/**
 * Raised when an action would exceed a plan's limits (repo count, gated premium
 * feature). Carried as a tRPC error `cause` so the API surfaces a structured
 * upsell, paralleling `InsufficientCreditsError`.
 */
export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT" as const;
  constructor(
    readonly plan: PlanTier,
    readonly kind: "repos" | "seats" | "feature",
    message: string,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}
