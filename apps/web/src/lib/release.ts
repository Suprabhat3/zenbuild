import type { ComponentProps } from "react";

import type { Badge } from "@/components/ui/badge";

/** Display metadata for Phase-12 release readiness (mirrors @zenbuild/ai). */

export type ReleaseVerdict = "READY" | "READY_WITH_RISKS" | "NOT_READY";
export type AcceptanceStatus = "MET" | "PARTIAL" | "UNMET" | "UNKNOWN";
export type ReleaseDecisionType = "APPROVED" | "REJECTED";

type BadgeVariant = ComponentProps<typeof Badge>["variant"];

export const VERDICT_LABELS: Record<ReleaseVerdict, string> = {
  READY: "Ready to ship",
  READY_WITH_RISKS: "Ready with risks",
  NOT_READY: "Not ready",
};

export const VERDICT_BADGE: Record<ReleaseVerdict, BadgeVariant> = {
  READY: "default",
  READY_WITH_RISKS: "secondary",
  NOT_READY: "destructive",
};

export const AC_STATUS_LABELS: Record<AcceptanceStatus, string> = {
  MET: "Met",
  PARTIAL: "Partial",
  UNMET: "Unmet",
  UNKNOWN: "Unknown",
};

export const AC_STATUS_BADGE: Record<AcceptanceStatus, BadgeVariant> = {
  MET: "default",
  PARTIAL: "secondary",
  UNMET: "destructive",
  UNKNOWN: "outline",
};

export const DECISION_LABELS: Record<ReleaseDecisionType, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const DECISION_BADGE: Record<ReleaseDecisionType, BadgeVariant> = {
  APPROVED: "default",
  REJECTED: "destructive",
};

export interface ReleaseReadinessView {
  verdict: ReleaseVerdict;
  summary: string;
  prdCoverage: string;
  acceptanceCriteria: {
    criterion: string;
    status: AcceptanceStatus;
    evidence: string;
  }[];
  outstandingConcerns: {
    title: string;
    severity: "BLOCKING" | "NON_BLOCKING";
    detail: string;
  }[];
  recommendation: string;
}
