/** Display helpers for the billing UI (presentation only; server is authoritative). */

export type PlanTier = "FREE" | "PRO" | "TEAM";
export type SubscriptionStatus =
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELLED"
  | "PAUSED"
  | "TRIALING";

export const PLAN_NAMES: Record<PlanTier, string> = {
  FREE: "Free",
  PRO: "Pro",
  TEAM: "Team",
};

export const PLAN_TAGLINES: Record<PlanTier, string> = {
  FREE: "Everything you need to ship your first features with AI.",
  PRO: "More credits and repos for solo builders shipping continuously.",
  TEAM: "Scale AI delivery across your whole engineering team.",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELLED: "Cancelled",
  PAUSED: "Paused",
  TRIALING: "Trialing",
};

/** Tailwind/badge variant per subscription status. */
export function statusBadgeVariant(
  status: SubscriptionStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "PAST_DUE":
      return "destructive";
    case "CANCELLED":
      return "outline";
    default:
      return "secondary";
  }
}

export const CREDIT_REASON_LABELS: Record<string, string> = {
  PRD_GENERATE: "PRD generation",
  TASKS_GENERATE: "Task generation",
  REPO_ANALYZE: "Repository analysis",
  TASK_IMPLEMENT: "Code implementation",
  PR_REVIEW: "AI code review",
  RELEASE_READINESS: "Release readiness",
  GRANT: "Credit grant",
  RESET: "Monthly reset",
};

export function creditReasonLabel(reason: string): string {
  return CREDIT_REASON_LABELS[reason] ?? reason;
}

/** Format a whole-rupee INR amount, e.g. 2499 → "₹2,499". */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** "unlimited" for null limits, otherwise the number. */
export function formatLimit(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}
