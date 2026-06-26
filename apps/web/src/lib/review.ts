import type { ComponentProps } from "react";

import type { Badge } from "@/components/ui/badge";

/** Display labels for AI review enums (mirrors Prisma + @zenbuild/ai). */

export type ReviewVerdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
export type IssueSeverity = "BLOCKING" | "NON_BLOCKING";
export type IssueCategory =
  | "PRD_REQUIREMENT"
  | "ACCEPTANCE_CRITERIA"
  | "ENGINEERING_TASK"
  | "SECURITY"
  | "PERFORMANCE"
  | "EDGE_CASE"
  | "CODE_QUALITY";

export const VERDICT_LABELS: Record<ReviewVerdict, string> = {
  APPROVE: "Approve",
  REQUEST_CHANGES: "Changes requested",
  COMMENT: "Comment",
};

export const SEVERITY_LABELS: Record<IssueSeverity, string> = {
  BLOCKING: "Blocking",
  NON_BLOCKING: "Non-blocking",
};

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  PRD_REQUIREMENT: "PRD requirement",
  ACCEPTANCE_CRITERIA: "Acceptance criteria",
  ENGINEERING_TASK: "Engineering task",
  SECURITY: "Security",
  PERFORMANCE: "Performance",
  EDGE_CASE: "Edge case",
  CODE_QUALITY: "Code quality",
};

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export const VERDICT_BADGE: Record<ReviewVerdict, BadgeVariant> = {
  APPROVE: "default",
  REQUEST_CHANGES: "destructive",
  COMMENT: "secondary",
};

export const SEVERITY_BADGE: Record<IssueSeverity, BadgeVariant> = {
  BLOCKING: "destructive",
  NON_BLOCKING: "secondary",
};
