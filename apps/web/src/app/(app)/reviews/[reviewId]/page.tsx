import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { Badge } from "@/components/ui/badge";
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
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}): Promise<Metadata> {
  const { reviewId } = await params;
  try {
    const review = await api.review.byId({ reviewId });
    return {
      title: `Review v${review.version} · ${review.pullRequest.repository.fullName} · ZenBuild`,
    };
  } catch {
    return { title: "Review · ZenBuild" };
  }
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  let review: Awaited<ReturnType<typeof api.review.byId>>;
  try {
    review = await api.review.byId({ reviewId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const verdict = review.verdict as ReviewVerdict | null;

  return (
    <div className="space-y-8">
      <Link href="/reviews" className="app-back-link">
        <ArrowLeft className="size-4" />
        Review history
      </Link>

      <header className="space-y-3">
        <span className="app-eyebrow">AI code review</span>
        <h1 className="app-page-title">
          {review.pullRequest.repository.fullName} #{review.pullRequest.number}
        </h1>
        <p className="app-page-lede">{review.pullRequest.title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {verdict && (
            <Badge variant={VERDICT_BADGE[verdict]}>{VERDICT_LABELS[verdict]}</Badge>
          )}
          <Badge variant="outline">v{review.version}</Badge>
          {review.isReReview && <Badge variant="secondary">Re-review</Badge>}
          <Badge variant="secondary">{review.status}</Badge>
          {review.blockingCount > 0 && (
            <Badge variant="destructive">{review.blockingCount} blocking</Badge>
          )}
          {review.nonBlockingCount > 0 && (
            <Badge variant="secondary">
              {review.nonBlockingCount} non-blocking
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {review.featureRequest && (
            <Link
              href={`/feature-requests/${review.featureRequest.id}/reviews`}
              className="font-medium text-primary hover:underline"
            >
              {review.featureRequest.title}
            </Link>
          )}
          <span>{review.transitionLabel}</span>
          <span>{review.triggeredByLabel}</span>
          {review.completedAt && (
            <span>{new Date(review.completedAt).toLocaleString()}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <a
            href={review.pullRequest.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open pull request #${review.pullRequest.number} on GitHub`}
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Open pull request
            <ExternalLink className="size-3.5" />
          </a>
          {review.githubReviewUrl && (
            <a
              href={review.githubReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the review comment on GitHub"
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              View GitHub review comment
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </header>

      {review.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{review.summary}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Issues ({review.issues.length})</CardTitle>
          <CardDescription>
            Categorized feedback with explanations and suggested fixes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {review.issues.length === 0 ? (
            <p className="text-muted-foreground text-sm">No issues were flagged.</p>
          ) : (
            <ul className="space-y-3">
              {review.issues.map((issue) => {
                const sev = issue.severity as IssueSeverity;
                const cat = issue.category as IssueCategory;
                return (
                  <li
                    key={issue.id}
                    className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant={SEVERITY_BADGE[sev]} className="text-xs">
                        {SEVERITY_LABELS[sev]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {issue.status.replace("_", " ")}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      {issue.filePath && (
                        <code className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">
                          {issue.filePath}
                          {issue.line ? `:${issue.line}` : ""}
                        </code>
                      )}
                    </div>
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-muted-foreground mt-1 leading-relaxed">
                      {issue.explanation}
                    </p>
                    {issue.suggestion && (
                      <p className="mt-2 text-xs">
                        <span className="font-medium">Suggested fix: </span>
                        {issue.suggestion}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {(review.model || review.promptTokens) && (
        <Card className="app-meta-card">
          <CardHeader>
            <CardTitle>Run metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {review.model && (
              <div className="app-meta-row">
                <span>Model</span>
                <span>{review.model}</span>
              </div>
            )}
            {review.promptTokens != null && (
              <div className="app-meta-row">
                <span>Tokens</span>
                <span>
                  {review.promptTokens} in / {review.completionTokens ?? 0} out
                </span>
              </div>
            )}
            <div className="app-meta-row">
              <span>Branch</span>
              <span className="font-mono text-xs">{review.pullRequest.headRef}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
