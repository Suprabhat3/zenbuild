"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  GitPullRequest,
  Hammer,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  VERDICT_BADGE,
  VERDICT_LABELS,
  type ReviewVerdict,
} from "@/lib/review";
import { api } from "@/trpc/react";

const ACTIVE = new Set(["QUEUED", "RUNNING"]);

/**
 * Build stage surface: live coding-agent implementation runs and the pull
 * requests they open. Implementation is triggered per task from the Plan
 * board ("Implement with AI"); this panel is where you watch it land.
 */
export function BuildPanel({ featureRequestId }: { featureRequestId: string }) {
  const router = useRouter();
  const [polling, setPolling] = useState(false);

  const runQuery = api.workflowRun.latest.useQuery(
    { featureRequestId, type: "TASK_IMPLEMENT" },
    { refetchInterval: polling ? 1500 : false },
  );
  const run = runQuery.data;
  const active = run ? ACTIVE.has(run.status) : false;

  useEffect(() => {
    if (active) setPolling(true);
  }, [active]);
  useEffect(() => {
    if (polling && run && !active) {
      setPolling(false);
      if (run.status === "FAILED") {
        toast.error(run.error ?? "Implementation run failed.");
      } else if (run.status === "COMPLETED") {
        toast.success("Implementation run completed.");
      }
      router.refresh();
    }
  }, [polling, run, active, router]);

  const dataQuery = api.review.forFeature.useQuery({ featureRequestId });
  const pullRequests = dataQuery.data?.pullRequests ?? [];
  const reviews = dataQuery.data?.reviews ?? [];

  // Latest completed review verdict per PR, for a compact status chip.
  const latestVerdictByPr = new Map<string, ReviewVerdict>();
  for (const r of reviews) {
    if (r.status !== "COMPLETED" || !r.verdict) continue;
    if (!latestVerdictByPr.has(r.pullRequestId)) {
      latestVerdictByPr.set(r.pullRequestId, r.verdict as ReviewVerdict);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hammer className="size-4 text-primary" />
            Implementation
          </CardTitle>
          <CardDescription>
            The coding agent implements tasks on{" "}
            <code className="text-xs">zenbuild/&lt;feature&gt;/&lt;task&gt;</code>{" "}
            branches and opens pull requests. Trigger it with{" "}
            <strong>Implement with AI</strong> on a task card.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(polling || active) && (
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              {run?.step ?? "Implementation in progress…"}
              {typeof run?.progress === "number" && run.progress > 0 && (
                <span>· {run.progress}%</span>
              )}
            </div>
          )}

          {!polling && !active && run?.status === "FAILED" && (
            <Alert variant="destructive">
              <AlertTitle>The last implementation run didn't complete</AlertTitle>
              <AlertDescription>
                {run.error ??
                  "The workflow failed. Trigger it again from the task board — if it keeps happening, the background worker may be offline."}
              </AlertDescription>
            </Alert>
          )}

          <Link
            href={`/requests/${featureRequestId}/plan`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open the task board
            <ArrowRight className="size-3.5" />
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitPullRequest className="size-4 text-primary" />
            Pull requests
          </CardTitle>
          <CardDescription>
            Everything the coding agent (or you) opened for this request. Each
            PR is AI-reviewed on the Reviews stage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dataQuery.isLoading && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading pull requests…
            </div>
          )}

          {!dataQuery.isLoading && pullRequests.length === 0 && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              No pull requests yet. Implement a task from the board — the
              agent's PRs land here automatically.
            </p>
          )}

          {pullRequests.map((pr) => {
            const verdict = latestVerdictByPr.get(pr.id);
            return (
              <div
                key={pr.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                    >
                      {pr.repository.fullName} #{pr.number}
                      <ExternalLink className="size-3.5 opacity-60" />
                    </a>
                    <Badge variant="outline">{pr.status}</Badge>
                    {verdict && (
                      <Badge variant={VERDICT_BADGE[verdict]}>
                        {VERDICT_LABELS[verdict]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{pr.title}</p>
                </div>
              </div>
            );
          })}

          {pullRequests.length > 0 && (
            <Link
              href={`/requests/${featureRequestId}/reviews`}
              className="text-primary inline-block text-sm font-medium hover:underline"
            >
              See the reviews →
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
