"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  History,
  Loader2,
  MessageSquareWarning,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  SEVERITY_BADGE,
  SEVERITY_LABELS,
  VERDICT_BADGE,
  VERDICT_LABELS,
  type IssueCategory,
  type IssueSeverity,
  type ReviewVerdict,
} from "@/lib/review";
import type { FeatureRequestStatus } from "@/lib/feature-request";
import { api } from "@/trpc/react";

const ACTIVE = new Set(["QUEUED", "RUNNING"]);
const REVIEWABLE: FeatureRequestStatus[] = [
  "IN_DEVELOPMENT",
  "IN_REVIEW",
  "FIX_NEEDED",
];

interface ReviewIssueView {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  explanation: string;
  suggestion: string | null;
  filePath: string | null;
  line: number | null;
}

interface LatestReviewView {
  id: string;
  version: number;
  status: string;
  verdict: ReviewVerdict | null;
  summary: string | null;
  completedAt: Date | null;
  issues: ReviewIssueView[];
}

/**
 * AI review entry point on the feature-request detail page. Lists linked PRs,
 * shows the latest review per PR, supports manual "Review now", and polls live
 * progress while the Inngest job runs.
 */
export function ReviewPanel({
  featureRequestId,
  status,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
}) {
  const router = useRouter();
  const [pollingPrId, setPollingPrId] = useState<string | null>(null);

  const dataQuery = api.review.forFeature.useQuery({ featureRequestId });
  const pullRequests = dataQuery.data?.pullRequests ?? [];
  const reviews = dataQuery.data?.reviews ?? [];

  const statusQuery = api.review.prStatus.useQuery(
    { pullRequestId: pollingPrId ?? "" },
    {
      enabled: Boolean(pollingPrId),
      refetchInterval: pollingPrId ? 1500 : false,
    },
  );

  const run = statusQuery.data?.run ?? null;
  const active = run ? ACTIVE.has(run.status) : false;

  useEffect(() => {
    if (pollingPrId && run && !active) {
      if (run.status === "FAILED") {
        toast.error(run.error ?? "AI review failed.");
      } else if (run.status === "COMPLETED") {
        toast.success("AI review completed.");
      }
      setPollingPrId(null);
      void dataQuery.refetch();
      router.refresh();
    }
  }, [pollingPrId, run, active, dataQuery, router]);

  const trigger = api.review.trigger.useMutation({
    onSuccess: (_data, vars) => {
      setPollingPrId(vars.pullRequestId);
      toast.message("AI review started…");
    },
    onError: (e) => toast.error(e.message),
  });

  const visibleStatuses: FeatureRequestStatus[] = [
    "IN_DEVELOPMENT",
    "IN_REVIEW",
    "FIX_NEEDED",
    "APPROVED",
    "SHIPPED",
  ];
  if (!visibleStatuses.includes(status)) return null;

  const latestByPr = new Map<string, LatestReviewView>();
  const historyByPr = new Map<string, LatestReviewView[]>();

  for (const r of reviews) {
    if (r.status !== "COMPLETED") continue;
    const entry: LatestReviewView = {
      id: r.id,
      version: r.version,
      status: r.status,
      verdict: r.verdict as ReviewVerdict | null,
      summary: r.summary,
      completedAt: r.completedAt,
      issues: r.issues as ReviewIssueView[],
    };
    const hist = historyByPr.get(r.pullRequestId) ?? [];
    hist.push(entry);
    historyByPr.set(r.pullRequestId, hist);
    if (!latestByPr.has(r.pullRequestId)) {
      latestByPr.set(r.pullRequestId, entry);
    }
  }

  const canTrigger = REVIEWABLE.includes(status);
  const busy = Boolean(pollingPrId && active) || trigger.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitPullRequest className="size-4 text-primary" />
          AI code review
        </CardTitle>
        <CardDescription>
          QA review against the PRD, tasks, and acceptance criteria. Results are
          posted to GitHub and stored here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {busy && (
          <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            {run?.step ?? "Running AI review…"}
            {typeof run?.progress === "number" && run.progress > 0 && (
              <span>· {run.progress}%</span>
            )}
          </div>
        )}

        {pullRequests.length === 0 && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            No pull requests linked yet. Implement a task on the board or open a
            PR with a{" "}
            <code className="text-xs">zenbuild/&lt;feature&gt;/&lt;task&gt;</code>{" "}
            branch to start the review pipeline.
          </p>
        )}

        {pullRequests.map((pr) => {
          const latest = latestByPr.get(pr.id);
          const blocking =
            latest?.issues.filter((i) => i.severity === "BLOCKING").length ?? 0;
          const nonBlocking =
            latest?.issues.filter((i) => i.severity === "NON_BLOCKING").length ??
            0;

          return (
            <div
              key={pr.id}
              className="space-y-3 rounded-lg border border-border bg-muted/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-sm hover:underline"
                    >
                      {pr.repository.fullName} #{pr.number}
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                    <Badge variant="outline">{pr.status}</Badge>
                    {latest?.verdict && (
                      <Badge variant={VERDICT_BADGE[latest.verdict]}>
                        {VERDICT_LABELS[latest.verdict]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{pr.title}</p>
                  {latest && (
                    <p className="text-muted-foreground text-xs">
                      Review v{latest.version}
                      {latest.completedAt &&
                        ` · ${new Date(latest.completedAt).toLocaleString()}`}
                      {blocking + nonBlocking > 0 &&
                        ` · ${blocking} blocking, ${nonBlocking} non-blocking`}
                    </p>
                  )}
                </div>
                {canTrigger && pr.status === "OPEN" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => trigger.mutate({ pullRequestId: pr.id })}
                  >
                    <Sparkles className="size-3.5" />
                    Review now
                  </Button>
                )}
              </div>

              {latest?.summary && (
                <p className="text-sm leading-relaxed">{latest.summary}</p>
              )}

              {latest && latest.issues.length > 0 && (
                <ul className="space-y-2">
                  {latest.issues.slice(0, status === "FIX_NEEDED" ? 3 : 5).map((issue) => (
                    <li
                      key={issue.id}
                      className="rounded-md border border-border/80 bg-background px-3 py-2 text-sm"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={SEVERITY_BADGE[issue.severity]} className="text-xs">
                          {SEVERITY_LABELS[issue.severity]}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {CATEGORY_LABELS[issue.category]}
                        </span>
                        {issue.filePath && (
                          <span className="font-mono text-xs text-muted-foreground">
                            {issue.filePath}
                            {issue.line ? `:${issue.line}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="font-medium">{issue.title}</p>
                      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                        {issue.explanation}
                      </p>
                      {issue.suggestion && (
                        <p className="mt-1 text-xs">
                          <span className="font-medium">Fix: </span>
                          {issue.suggestion}
                        </p>
                      )}
                    </li>
                  ))}
                  {latest.issues.length > (status === "FIX_NEEDED" ? 3 : 5) && (
                    <li className="text-muted-foreground text-xs">
                      + {latest.issues.length - (status === "FIX_NEEDED" ? 3 : 5)} more
                      issues
                      {status === "FIX_NEEDED" && " (see Fix needed panel above)"}
                    </li>
                  )}
                </ul>
              )}

              {(historyByPr.get(pr.id)?.length ?? 0) > 1 && (
                <details className="text-sm">
                  <summary className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                    <History className="size-3.5" />
                    {historyByPr.get(pr.id)!.length} review iterations
                  </summary>
                  <ol className="mt-2 space-y-1 pl-4 text-xs">
                    {historyByPr.get(pr.id)!.map((rev) => {
                      const b = rev.issues.filter((i) => i.severity === "BLOCKING").length;
                      const nb = rev.issues.length - b;
                      return (
                        <li key={rev.id} className="text-muted-foreground">
                          <span className="font-medium text-foreground">
                            v{rev.version}
                          </span>
                          {rev.verdict && (
                            <> · {VERDICT_LABELS[rev.verdict]}</>
                          )}
                          {" · "}
                          {b} blocking, {nb} non-blocking
                          {rev.completedAt &&
                            ` · ${new Date(rev.completedAt).toLocaleString()}`}
                        </li>
                      );
                    })}
                  </ol>
                </details>
              )}

              {latest &&
                blocking === 0 &&
                latest.verdict === "APPROVE" &&
                status !== "FIX_NEEDED" && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-primary" />
                  No blocking issues — ready for human approval.
                </div>
              )}

              {!latest && pr.status === "OPEN" && canTrigger && !busy && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <MessageSquareWarning className="size-4" />
                  Not reviewed yet — auto-review runs when the PR opens or syncs.
                </div>
              )}
            </div>
          );
        })}

        {reviews.length > 0 && (
          <Link
            href={`/feature-requests/${featureRequestId}/reviews`}
            className="text-primary inline-block text-sm font-medium hover:underline"
          >
            Full review history →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
