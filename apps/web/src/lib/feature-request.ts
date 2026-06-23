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
