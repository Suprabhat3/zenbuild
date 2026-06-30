import type {
  CreditReason,
  PlanTier,
  Prisma,
  PrismaClient,
  WorkflowType,
} from "@zenbuild/db";

import { PLAN_DEFINITIONS } from "./plans";

/**
 * Credit accounting. ZenBuild meters AI work against a per-org monthly credit
 * pool (`Subscription.reviewCreditsTotal/Used`, backed by an append-only
 * `CreditLedger`). Each AI workflow type has a fixed cost; the heavier the
 * operation, the more it costs.
 *
 * Two-phase model:
 *  - **Gate at trigger** (`assertCanRunWorkflow`): a cheap read that blocks an
 *    AI op from starting when the org is out of credits — surfaced to the user
 *    as an upsell. Best-effort: it does not reserve, so a burst can slightly
 *    overspend; the ledger is the source of truth.
 *  - **Debit on success** (`meterWorkflowRun`): the actual charge, written once
 *    when the workflow completes, so failed/abandoned runs never cost credits.
 *    Idempotent on the workflow-run id, safe under Inngest step replays.
 */

/** Accepts the base client or an interactive-transaction client. */
type DbClient = PrismaClient | Prisma.TransactionClient;

/** Cost (in credits) per AI workflow. CLARIFY is intentionally absent — the
 *  clarification turn is a tiny call folded into intake and charged nothing. */
export const WORKFLOW_CREDIT: Partial<
  Record<WorkflowType, { reason: CreditReason; cost: number }>
> = {
  PRD_GENERATE: { reason: "PRD_GENERATE", cost: 1 },
  TASKS_GENERATE: { reason: "TASKS_GENERATE", cost: 1 },
  REPO_ANALYZE: { reason: "REPO_ANALYZE", cost: 1 },
  TASK_IMPLEMENT: { reason: "TASK_IMPLEMENT", cost: 3 },
  PR_REVIEW: { reason: "PR_REVIEW", cost: 2 },
  RELEASE_READINESS: { reason: "RELEASE_READINESS", cost: 1 },
};

/** Credit cost of a workflow type (0 when the type isn't metered). */
export function workflowCreditCost(type: WorkflowType): number {
  return WORKFLOW_CREDIT[type]?.cost ?? 0;
}

export interface CreditState {
  plan: PlanTier;
  total: number;
  used: number;
  remaining: number;
}

/**
 * Raised when an org lacks the credits to start an AI operation. Carried as a
 * tRPC error `cause` so the API boundary can surface a structured upsell.
 */
export class InsufficientCreditsError extends Error {
  readonly code = "INSUFFICIENT_CREDITS" as const;
  constructor(
    readonly plan: PlanTier,
    readonly remaining: number,
    readonly required: number,
  ) {
    super(
      `Out of AI credits: ${remaining} remaining, ${required} required on the ${plan} plan.`,
    );
    this.name = "InsufficientCreditsError";
  }
}

/** Current credit balance for an org. Returns null when no subscription. */
export async function getCreditState(
  db: DbClient,
  organizationId: string,
): Promise<CreditState | null> {
  const sub = await db.subscription.findUnique({
    where: { organizationId },
    select: { plan: true, reviewCreditsTotal: true, reviewCreditsUsed: true },
  });
  if (!sub) return null;
  const remaining = Math.max(0, sub.reviewCreditsTotal - sub.reviewCreditsUsed);
  return {
    plan: sub.plan,
    total: sub.reviewCreditsTotal,
    used: sub.reviewCreditsUsed,
    remaining,
  };
}

/** Whether the org can afford `cost` credits right now (read-only). */
export async function hasCreditsFor(
  db: DbClient,
  organizationId: string,
  cost: number,
): Promise<boolean> {
  if (cost <= 0) return true;
  const state = await getCreditState(db, organizationId);
  // No subscription row → treat as ungated (shouldn't happen; orgs always have
  // one via provisioning) rather than hard-blocking the core loop.
  if (!state) return true;
  return state.remaining >= cost;
}

/**
 * Gate an AI workflow at trigger time. Throws `InsufficientCreditsError` when
 * the org can't afford it; no-op for unmetered types (e.g. CLARIFY).
 */
export async function assertCanRunWorkflow(
  db: DbClient,
  organizationId: string,
  type: WorkflowType,
): Promise<void> {
  const cost = workflowCreditCost(type);
  if (cost <= 0) return;
  const state = await getCreditState(db, organizationId);
  if (!state) return;
  if (state.remaining < cost) {
    throw new InsufficientCreditsError(state.plan, state.remaining, cost);
  }
}

/**
 * Debit credits for a completed workflow run. Idempotent: keyed on the run id
 * via the ledger, so a step replay or duplicate completion won't double-charge.
 * Must run inside a transaction (`tx`) so the balance update and ledger insert
 * commit together. No-op for unmetered types or orgs without a subscription.
 */
export async function meterWorkflowRun(
  tx: Prisma.TransactionClient,
  run: { id: string; type: WorkflowType; organizationId: string },
): Promise<{ charged: boolean; cost: number }> {
  const spec = WORKFLOW_CREDIT[run.type];
  if (!spec) return { charged: false, cost: 0 };

  // Idempotency guard — has this exact run already been metered?
  const existing = await tx.creditLedger.findFirst({
    where: {
      organizationId: run.organizationId,
      reason: spec.reason,
      metadata: { path: ["workflowRunId"], equals: run.id },
    },
    select: { id: true },
  });
  if (existing) return { charged: false, cost: spec.cost };

  const sub = await tx.subscription.findUnique({
    where: { organizationId: run.organizationId },
    select: { reviewCreditsTotal: true, reviewCreditsUsed: true },
  });
  if (!sub) return { charged: false, cost: spec.cost };

  const newUsed = sub.reviewCreditsUsed + spec.cost;
  await tx.subscription.update({
    where: { organizationId: run.organizationId },
    data: { reviewCreditsUsed: newUsed },
  });
  await tx.creditLedger.create({
    data: {
      organizationId: run.organizationId,
      reason: spec.reason,
      delta: -spec.cost,
      balance: Math.max(0, sub.reviewCreditsTotal - newUsed),
      metadata: { workflowRunId: run.id, workflowType: run.type },
    },
  });
  return { charged: true, cost: spec.cost };
}

/**
 * Reset the monthly credit pool to a plan's allotment (subscribe / renewal /
 * downgrade). Sets the new total, zeroes usage, and writes a `RESET` ledger
 * entry. Runs in its own transaction.
 */
export async function grantPlanCredits(
  db: PrismaClient,
  organizationId: string,
  plan: PlanTier,
  source: string,
): Promise<void> {
  const total = PLAN_DEFINITIONS[plan].monthlyCredits;
  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { organizationId },
      data: { reviewCreditsTotal: total, reviewCreditsUsed: 0 },
    });
    await tx.creditLedger.create({
      data: {
        organizationId,
        reason: "RESET",
        delta: total,
        balance: total,
        metadata: { source, plan },
      },
    });
  });
}
