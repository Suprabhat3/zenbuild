"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  Rocket,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FeatureRequestStatus } from "@/lib/feature-request";
import {
  DECISION_BADGE,
  DECISION_LABELS,
  VERDICT_BADGE,
  VERDICT_LABELS,
  type ReleaseDecisionType,
  type ReleaseVerdict,
} from "@/lib/release";
import { api } from "@/trpc/react";

const VISIBLE: FeatureRequestStatus[] = [
  "IN_REVIEW",
  "APPROVED",
  "SHIPPED",
];

/**
 * Phase-12 release gate summary on the feature-request detail page. Surfaces the
 * approval-gate state and AI readiness verdict, linking to the full approval
 * screen. Shown once a feature reaches review.
 */
export function ReleasePanel({
  featureRequestId,
  status,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
}) {
  const query = api.release.summary.useQuery(
    { featureRequestId },
    { enabled: VISIBLE.includes(status) },
  );

  if (!VISIBLE.includes(status)) return null;

  const data = query.data;
  const verdict = (data?.readiness?.verdict?.verdict ?? null) as ReleaseVerdict | null;
  const decision = (data?.decision?.decision ?? null) as ReleaseDecisionType | null;
  const shipped = status === "SHIPPED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="size-4 text-primary" />
          Human approval &amp; release
        </CardTitle>
        <CardDescription>
          Final human gate. Review the AI readiness verdict and ship — or send it
          back to the fix loop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading release status…
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {shipped ? (
                <span className="text-primary inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" />
                  Shipped
                </span>
              ) : data.gate.canApprove ? (
                <span className="text-primary inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" />
                  Ready for human approval
                </span>
              ) : (
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <ShieldAlert className="size-4" />
                  {data.openBlockingCount > 0
                    ? `${data.openBlockingCount} blocking issue(s) outstanding`
                    : "Gate not yet open"}
                </span>
              )}

              {verdict && (
                <Badge variant={VERDICT_BADGE[verdict]}>
                  AI: {VERDICT_LABELS[verdict]}
                </Badge>
              )}
              {decision && !shipped && (
                <Badge variant={DECISION_BADGE[decision]}>
                  {DECISION_LABELS[decision]}
                </Badge>
              )}
            </div>

            {decision === "REJECTED" && data.decision?.notes && (
              <p className="text-muted-foreground flex items-start gap-2 text-sm">
                <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                {data.decision.notes}
              </p>
            )}

            <Link
              href={`/feature-requests/${featureRequestId}/release`}
              className={buttonVariants({
                variant: shipped ? "outline" : "default",
                size: "sm",
              })}
            >
              {shipped ? "View release summary" : "Open approval screen"}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
