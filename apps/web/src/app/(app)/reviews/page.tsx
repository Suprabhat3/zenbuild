import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Reviews · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const reviews = await api.review.list({ limit: 100 });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="app-page-title">Pull request reviews</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          AI QA reviews across your workspace — each iteration is stored with
          categorized, explained issues and posted to GitHub.
        </p>
      </header>

      {reviews.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No reviews yet</CardTitle>
            <CardDescription>
              Reviews appear when a linked pull request is opened or you trigger
              &ldquo;Review now&rdquo; from a feature request.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => {
            const verdict = review.verdict as ReviewVerdict | null;
            return (
              <li key={review.id}>
                <Card className="transition-colors hover:border-primary/30">
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {verdict && (
                          <Badge variant={VERDICT_BADGE[verdict]}>
                            {VERDICT_LABELS[verdict]}
                          </Badge>
                        )}
                        <Badge variant="outline">v{review.version}</Badge>
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
                          href={`/feature-requests/${review.featureRequest.id}`}
                          className="block font-semibold hover:underline"
                        >
                          {review.featureRequest.title}
                        </Link>
                      )}
                      {review.pullRequest && (
                        <a
                          href={review.pullRequest.url}
                          target="_blank"
                          rel="noopener noreferrer"
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
                        {new Date(review.createdAt).toLocaleString()}
                      </p>
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
