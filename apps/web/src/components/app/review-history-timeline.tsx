"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, History } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api, type RouterOutputs } from "@/trpc/react";

const ALL = "__all__";

type HistoryData = RouterOutputs["review"]["history"];
type HistoryIssue =
  HistoryData["byPullRequest"][number]["reviews"][number]["issues"][number];

function IssueRow({ issue }: { issue: HistoryIssue }) {
  const sev = issue.severity as IssueSeverity;
  const cat = issue.category as IssueCategory;
  return (
    <li className="rounded-md border border-border/80 bg-background px-3 py-2.5 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant={SEVERITY_BADGE[sev]} className="text-xs">
          {SEVERITY_LABELS[sev]}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {issue.status.replace("_", " ")}
        </Badge>
        <span className="text-muted-foreground text-xs">{CATEGORY_LABELS[cat]}</span>
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
  );
}

/**
 * Full review history timeline for a feature request (Phase 11).
 */
export function ReviewHistoryTimeline({
  featureRequestId,
  initialData,
}: {
  featureRequestId: string;
  initialData: HistoryData;
}) {
  const [severity, setSeverity] = useState(ALL);
  const [issueStatus, setIssueStatus] = useState(ALL);

  const query = api.review.history.useQuery(
    {
      featureRequestId,
      ...(severity !== ALL
        ? { severity: severity as "BLOCKING" | "NON_BLOCKING" }
        : {}),
      ...(issueStatus !== ALL
        ? { issueStatus: issueStatus as "OPEN" | "RESOLVED" | "WONT_FIX" }
        : {}),
    },
    { initialData, refetchOnMount: false },
  );

  const data = query.data ?? initialData;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={severity} onValueChange={(v) => setSeverity(v ?? ALL)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All severities</SelectItem>
              <SelectItem value="BLOCKING">Blocking only</SelectItem>
              <SelectItem value="NON_BLOCKING">Non-blocking only</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={issueStatus}
            onValueChange={(v) => setIssueStatus(v ?? ALL)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Issue status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="WONT_FIX">Won&apos;t fix</SelectItem>
            </SelectContent>
          </Select>
          {(severity !== ALL || issueStatus !== ALL) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSeverity(ALL);
                setIssueStatus(ALL);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {data.totalIterations} iteration{data.totalIterations === 1 ? "" : "s"}{" "}
          · Pipeline:{" "}
          <span className="font-medium text-foreground">
            {data.pipelineStatus.replace("_", " ")}
          </span>
        </p>
      </div>

      {data.timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              Activity timeline
            </CardTitle>
            <CardDescription>
              State transitions derived from each review iteration, newest first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="app-review-timeline space-y-0">
              {data.timeline.map((entry) => (
                <li key={entry.reviewId} className="app-review-timeline-item">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">
                          v{entry.version}
                          {entry.isReReview && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              (re-review)
                            </span>
                          )}
                        </span>
                        {entry.verdict && (
                          <Badge
                            variant={
                              VERDICT_BADGE[entry.verdict as ReviewVerdict]
                            }
                            className="text-xs"
                          >
                            {VERDICT_LABELS[entry.verdict as ReviewVerdict]}
                          </Badge>
                        )}
                        {entry.blockingCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {entry.blockingCount} blocking
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{entry.transitionLabel}</p>
                      <p className="text-muted-foreground text-xs">
                        {entry.pullRequest.fullName} #{entry.pullRequest.number}{" "}
                        · {entry.triggeredByLabel}
                        {entry.completedAt &&
                          ` · ${new Date(entry.completedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <Link
                        href={`/reviews/${entry.reviewId}`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        Details
                      </Link>
                      {entry.githubReviewUrl && (
                        <a
                          href={entry.githubReviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground inline-flex items-center justify-end gap-1 text-xs hover:text-foreground"
                        >
                          GitHub
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {data.byPullRequest.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No review history yet</CardTitle>
            <CardDescription>
              Reviews appear when a linked pull request is opened or reviewed.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        data.byPullRequest.map(({ pullRequest: pr, reviews }) => (
          <section key={pr.id} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  {pr.repository.fullName} #{pr.number}
                  <ExternalLink className="size-3.5 opacity-60" />
                </a>
                <p className="text-muted-foreground text-sm">{pr.title}</p>
                <p className="text-muted-foreground text-xs">
                  Branch {pr.headRef} · {reviews.length} review
                  {reviews.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {[...reviews].reverse().map((review) => {
                const verdict = review.verdict as ReviewVerdict | null;
                return (
                  <Card key={review.id}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-base">
                          Review v{review.version}
                        </CardTitle>
                        {review.isReReview && (
                          <Badge variant="secondary">Re-review</Badge>
                        )}
                        {verdict && (
                          <Badge variant={VERDICT_BADGE[verdict]}>
                            {VERDICT_LABELS[verdict]}
                          </Badge>
                        )}
                        {review.blockingCount > 0 && (
                          <Badge variant="destructive">
                            {review.blockingCount} blocking
                          </Badge>
                        )}
                        {review.nonBlockingCount > 0 && (
                          <Badge variant="secondary">
                            {review.nonBlockingCount} non-blocking
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {review.transitionLabel} · {review.triggeredByLabel}
                        {review.completedAt &&
                          ` · ${new Date(review.completedAt).toLocaleString()}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {review.summary && (
                        <p className="text-sm leading-relaxed">{review.summary}</p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/reviews/${review.id}`}
                          className="text-primary text-sm font-medium hover:underline"
                        >
                          Full detail →
                        </Link>
                        {review.githubReviewUrl && (
                          <a
                            href={review.githubReviewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
                          >
                            View on GitHub
                            <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                      {review.issues.length > 0 && (
                        <ul className="space-y-2">
                          {review.issues.map((issue) => (
                            <IssueRow key={issue.id} issue={issue} />
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
