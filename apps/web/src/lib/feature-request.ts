/** Display metadata for the feature-request state machine (see schema). */

export type FeatureRequestStatus =
  | "DRAFT"
  | "CLARIFYING"
  | "PRD_DRAFTED"
  | "PRD_APPROVED"
  | "TASKS_READY"
  | "IN_DEVELOPMENT"
  | "IN_REVIEW"
  | "FIX_NEEDED"
  | "APPROVED"
  | "SHIPPED"
  | "REJECTED"
  | "DECLINED_DUPLICATE";

export const STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  DRAFT: "Draft",
  CLARIFYING: "Clarifying",
  PRD_DRAFTED: "PRD drafted",
  PRD_APPROVED: "PRD approved",
  TASKS_READY: "Tasks ready",
  IN_DEVELOPMENT: "In development",
  IN_REVIEW: "In review",
  FIX_NEEDED: "Fix needed",
  APPROVED: "Approved",
  SHIPPED: "Shipped",
  REJECTED: "Rejected",
  DECLINED_DUPLICATE: "Duplicate",
};

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

export const STATUS_BADGE_VARIANT: Record<FeatureRequestStatus, BadgeVariant> = {
  DRAFT: "outline",
  CLARIFYING: "secondary",
  PRD_DRAFTED: "secondary",
  PRD_APPROVED: "secondary",
  TASKS_READY: "secondary",
  IN_DEVELOPMENT: "default",
  IN_REVIEW: "default",
  FIX_NEEDED: "destructive",
  APPROVED: "default",
  SHIPPED: "default",
  REJECTED: "destructive",
  DECLINED_DUPLICATE: "outline",
};

export const SOURCE_LABELS: Record<string, string> = {
  FORM: "Form",
  EMAIL: "Email",
  TICKET: "Ticket",
  CALL: "Call",
  API: "API / Webhook",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/* ------------------------------------------------------------------ */
/* Pipeline model                                                      */
/*                                                                     */
/* The delivery loop is the spine of the product:                      */
/*   Intake → Discovery → PRD → Plan → Build → Review → Ship           */
/* Every status maps to a stage, and every non-terminal status has a   */
/* single "next action" — the thing the user should do right now.      */
/* ------------------------------------------------------------------ */

export const PIPELINE_STAGES = [
  { key: "intake", label: "Intake" },
  { key: "discovery", label: "Discovery" },
  { key: "prd", label: "PRD" },
  { key: "plan", label: "Plan" },
  { key: "build", label: "Build" },
  { key: "review", label: "Review" },
  { key: "ship", label: "Ship" },
] as const;

export type PipelineStageKey = (typeof PIPELINE_STAGES)[number]["key"];

/** Index into PIPELINE_STAGES of the stage the request currently sits in. */
export const STATUS_STAGE_INDEX: Record<FeatureRequestStatus, number> = {
  DRAFT: 1,
  CLARIFYING: 1,
  PRD_DRAFTED: 2,
  PRD_APPROVED: 3,
  TASKS_READY: 3,
  IN_DEVELOPMENT: 4,
  IN_REVIEW: 5,
  FIX_NEEDED: 5,
  APPROVED: 6,
  SHIPPED: 6,
  REJECTED: 5,
  DECLINED_DUPLICATE: 1,
};

export const TERMINAL_STATUSES: FeatureRequestStatus[] = [
  "SHIPPED",
  "REJECTED",
  "DECLINED_DUPLICATE",
];

export interface NextAction {
  /** Button label, e.g. "Approve the PRD". */
  label: string;
  /** One-line explanation of where the request stands. */
  hint: string;
  /** Destination, given the feature request id. */
  href: (id: string) => string;
  /** True when only an owner/admin can take this action. */
  adminGate: boolean;
}

/**
 * The single most useful thing to do next for each status. `null` for
 * terminal states. Drives the stepper CTA, the dashboard attention queue,
 * and the approvals inbox.
 */
export const NEXT_ACTION: Record<FeatureRequestStatus, NextAction | null> = {
  DRAFT: {
    label: "Start discovery",
    hint: "Run the discovery agent to clarify the request before drafting a PRD.",
    href: (id) => `/feature-requests/${id}`,
    adminGate: false,
  },
  CLARIFYING: {
    label: "Continue discovery",
    hint: "Answer the agent's questions, or generate the PRD when ready.",
    href: (id) => `/feature-requests/${id}`,
    adminGate: false,
  },
  PRD_DRAFTED: {
    label: "Review & approve the PRD",
    hint: "The PRD draft is ready — edit it, then approve to unlock planning.",
    href: (id) => `/feature-requests/${id}`,
    adminGate: true,
  },
  PRD_APPROVED: {
    label: "Generate the task plan",
    hint: "The PRD is approved — break it into engineering tasks.",
    href: (id) => `/feature-requests/${id}/board`,
    adminGate: false,
  },
  TASKS_READY: {
    label: "Review & approve the plan",
    hint: "Tasks are drafted — adjust the board, then approve the plan to start development.",
    href: (id) => `/feature-requests/${id}/board`,
    adminGate: true,
  },
  IN_DEVELOPMENT: {
    label: "Implement tasks",
    hint: "Development is underway — implement tasks with the coding agent or link PRs.",
    href: (id) => `/feature-requests/${id}/board`,
    adminGate: false,
  },
  IN_REVIEW: {
    label: "Make the ship decision",
    hint: "AI review passed with no blocking issues — a human decides whether it ships.",
    href: (id) => `/feature-requests/${id}/release`,
    adminGate: true,
  },
  FIX_NEEDED: {
    label: "Resolve blocking issues",
    hint: "Review found blocking issues — fix them and push to trigger a re-review.",
    href: (id) => `/feature-requests/${id}`,
    adminGate: false,
  },
  APPROVED: {
    label: "Finish shipping",
    hint: "Approved for release — merge the remaining pull requests to ship.",
    href: (id) => `/feature-requests/${id}/release`,
    adminGate: true,
  },
  SHIPPED: null,
  REJECTED: null,
  DECLINED_DUPLICATE: null,
};
