"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  GitPullRequest,
  History,
  Loader2,
  Sparkles,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

interface IssueView {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  explanation: string;
  suggestion: string | null;
  filePath: string | null;
  line: number | null;
}

function IssueCard({ issue }: { issue: IssueView }) {
  return (
    <li className="rounded-md border border-border/80 bg-background px-3 py-2.5 text-sm">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
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
        <p className="mt-1.5 text-xs">
          <span className="font-medium">Suggested fix: </span>
          {issue.suggestion}
        </p>
      )}
    </li>
  );
}

/**
 * Phase-10 fix-needed workspace: full outstanding issue list, review iteration
 * history, paths to push fixes (board + re-implement), and live re-review progress.
 */
export function FixNeededPanel({
  featureRequestId,
  status,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
}) {
  const router = useRouter();
  const [polling, setPolling] = useState(false);

  const summaryQuery = api.review.fixNeeded.useQuery(
    { featureRequestId },
    { enabled: status === "FIX_NEEDED" },
  );
  const data = summaryQuery.data;

  const runQuery = api.workflowRun.latest.useQuery(
    { featureRequestId, type: "PR_REVIEW" },
    { refetchInterval: polling ? 1500 : false },
  );
  const run = runQuery.data;
  const active = run ? ACTIVE.has(run.status) : false;

  useEffect(() => {
    if (status === "FIX_NEEDED" && active) setPolling(true);
  }, [status, active]);

  useEffect(() => {
    if (polling && run && !active) {
      setPolling(false);
      if (run.status === "FAILED") {
        toast.error("Re-review failed.");
      } else if (run.status === "COMPLETED") {
        toast.success("Re-review completed.");
      }
      void summaryQuery.refetch();
      router.refresh();
    }
  }, [polling, run, active, summaryQuery, router]);

  const trigger = api.review.trigger.useMutation({
    onSuccess: () => {
      setPolling(true);
      void runQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (status !== "FIX_NEEDED") return null;

  const busy = polling || active || trigger.isPending;
  const blocking = (data?.blockingIssues ?? []) as IssueView[];
  const nonBlocking = (data?.nonBlockingIssues ?? []) as IssueView[];

  return (
    <Card className="border-destructive/40 bg-destructive/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Wrench className="size-4" />
          Fix needed
        </CardTitle>
        <CardDescription>
          AI review found blocking issues. Push fixes to the pull request branch
          (or re-implement with AI on the board) — a fresh review runs
          automatically on the next sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {busy && (
          <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border bg-background/80 px-3 py-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            {run?.step ?? "Re-review in progress…"}
            {typeof run?.progress === "number" && run.progress > 0 && (
              <span>· {run.progress}%</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-lg border border-destructive/30 bg-background px-3 py-2">
            <span className="text-muted-foreground">Blocking</span>{" "}
            <span className="font-semibold text-destructive">
              {data?.blockingCount ?? "—"}
            </span>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-muted-foreground">Non-blocking</span>{" "}
            <span className="font-semibold">{data?.nonBlockingCount ?? "—"}</span>
          </div>
          <div className="rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-muted-foreground">Review iterations</span>{" "}
            <span className="font-semibold">{data?.totalReviewIterations ?? 0}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/feature-requests/${featureRequestId}/board`}
            className={buttonVariants({ className: "gap-1.5" })}
          >
            Open board
            <ArrowRight className="size-4" />
          </Link>
          <p className="text-muted-foreground flex items-center text-xs">
            Use <strong className="mx-1">Implement with AI</strong> on a task to
            land fixes on its branch.
          </p>
        </div>

        {blocking.length > 0 && (
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-destructive" />
              Blocking issues
            </h3>
            <ul className="space-y-2">
              {blocking.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </ul>
          </section>
        )}

        {nonBlocking.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Non-blocking issues</h3>
            <ul className="space-y-2">
              {nonBlocking.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </ul>
          </section>
        )}

        {(data?.pullRequests.length ?? 0) > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <GitPullRequest className="size-4" />
              Pull requests
            </h3>
            {data!.pullRequests.map(({ pullRequest: pr, task, latestReview, iterations }) => (
              <div
                key={pr.id}
                className="space-y-3 rounded-lg border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-sm hover:underline"
                    >
                      {pr.repository.fullName} #{pr.number}
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                    <p className="text-muted-foreground text-sm">{pr.title}</p>
                    {task && (
                      <p className="text-muted-foreground text-xs">
                        Task: {task.title}
                      </p>
                    )}
                    {latestReview && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {latestReview.verdict && (
                          <Badge
                            variant={
                              VERDICT_BADGE[latestReview.verdict as ReviewVerdict]
                            }
                          >
                            {VERDICT_LABELS[latestReview.verdict as ReviewVerdict]}
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-xs">
                          Latest: v{latestReview.version}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => trigger.mutate({ pullRequestId: pr.id })}
                  >
                    <Sparkles className="size-3.5" />
                    Re-review now
                  </Button>
                </div>

                {iterations.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                      <History className="size-3.5" />
                      Review history
                    </p>
                    <ol className="space-y-1 text-xs">
                      {iterations.map((it) => (
                        <li
                          key={it.id}
                          className="text-muted-foreground flex flex-wrap items-center gap-2"
                        >
                          <span className="font-medium text-foreground">
                            v{it.version}
                          </span>
                          {it.verdict && (
                            <span>{VERDICT_LABELS[it.verdict as ReviewVerdict]}</span>
                          )}
                          <span>
                            {it.blockingCount} blocking · {it.nonBlockingCount}{" "}
                            non-blocking
                          </span>
                          {it.completedAt && (
                            <span>
                              · {new Date(it.completedAt).toLocaleString()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {data?.pipelineStatus === "IN_REVIEW" && (
          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              All blocking issues are resolved across open PRs — this feature
              should move to <strong>In review</strong> shortly.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
