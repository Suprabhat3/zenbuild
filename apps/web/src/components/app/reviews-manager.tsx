"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, Filter, SearchX } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VERDICT_BADGE,
  VERDICT_LABELS,
  type ReviewVerdict,
} from "@/lib/review";
import { api, type RouterOutputs } from "@/trpc/react";

type ListReview = RouterOutputs["review"]["list"][number];

const ALL = "__all__";

/**
 * Workspace review feed with severity / verdict filters (Phase 11).
 */
export function ReviewsManager({ initialReviews }: { initialReviews: ListReview[] }) {
  const [severity, setSeverity] = useState(ALL);
  const [verdict, setVerdict] = useState(ALL);

  const query = api.review.list.useQuery(
    {
      limit: 100,
      ...(severity !== ALL
        ? { severity: severity as "BLOCKING" | "NON_BLOCKING" }
        : {}),
      ...(verdict !== ALL
        ? { verdict: verdict as "APPROVE" | "REQUEST_CHANGES" | "COMMENT" }
        : {}),
    },
    { initialData: initialReviews, refetchOnMount: false },
  );

  const reviews = query.data ?? initialReviews;
  const hasFilters = severity !== ALL || verdict !== ALL;

  const counts = useMemo(
    () => ({
      total: reviews.length,
      blocking: reviews.filter((r) => r.blockingCount > 0).length,
    }),
    [reviews],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="size-4" />
            Filters
          </div>
          <Select value={severity} onValueChange={(v) => setSeverity(v ?? ALL)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All severities</SelectItem>
              <SelectItem value="BLOCKING">Has blocking</SelectItem>
              <SelectItem value="NON_BLOCKING">Has non-blocking</SelectItem>
            </SelectContent>
          </Select>
          <Select value={verdict} onValueChange={(v) => setVerdict(v ?? ALL)}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Verdict" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All verdicts</SelectItem>
              <SelectItem value="APPROVE">Approve</SelectItem>
              <SelectItem value="REQUEST_CHANGES">Changes requested</SelectItem>
              <SelectItem value="COMMENT">Comment</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSeverity(ALL);
                setVerdict(ALL);
              }}
            >
              Clear
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {counts.total} review{counts.total === 1 ? "" : "s"}
          {counts.blocking > 0 && ` · ${counts.blocking} with blocking issues`}
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="app-panel">
          <EmptyState
            icon={SearchX}
            title={hasFilters ? "No matching reviews" : "No reviews yet"}
            description={
              hasFilters
                ? "No reviews match the current filters. Clear them to see the full history."
                : "AI code reviews will appear here once a pull request is reviewed from a feature request."
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSeverity(ALL);
                    setVerdict(ALL);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => {
            const v = review.verdict as ReviewVerdict | null;
            return (
              <li key={review.id}>
                <Card className="transition-colors hover:border-primary/30">
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {v && (
                          <Badge variant={VERDICT_BADGE[v]}>
                            {VERDICT_LABELS[v]}
                          </Badge>
                        )}
                        <Badge variant="outline">v{review.version}</Badge>
                        {review.isReReview && (
                          <Badge variant="secondary">Re-review</Badge>
                        )}
                        <Badge variant="secondary">{review.status}</Badge>
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
                      {review.featureRequest && (
                        <Link
                          href={`/requests/${review.featureRequest.id}/reviews`}
                          className="hover:text-primary block font-(family-name:--font-display) text-lg tracking-tight transition-colors"
                        >
                          {review.featureRequest.title}
                        </Link>
                      )}
                      {review.pullRequest && (
                        <a
                          href={review.pullRequest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open pull request ${review.pullRequest.repository.fullName} #${review.pullRequest.number} on GitHub`}
                          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:text-foreground"
                        >
                          {review.pullRequest.repository.fullName} #
                          {review.pullRequest.number} — {review.pullRequest.title}
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {review.summary && (
                        <p className="text-muted-foreground line-clamp-2 text-sm">
                          {review.summary}
                        </p>
                      )}
                      <p className="text-muted-foreground text-xs">
                        {review.triggeredByLabel}
                        {review.completedAt &&
                          ` · ${new Date(review.completedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <Link
                        href={`/reviews/${review.id}`}
                        className="text-primary text-sm font-medium hover:underline"
                      >
                        View details →
                      </Link>
                      {review.githubReviewUrl && (
                        <a
                          href={review.githubReviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open the review comment on GitHub"
                          className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:text-foreground"
                        >
                          GitHub comment
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
