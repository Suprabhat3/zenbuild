import type { Metadata } from "next";

import { ReviewsManager } from "@/components/app/reviews-manager";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Review History · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const reviews = await api.review.list({ limit: 100 });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="app-page-title">Review history</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Full audit trail of AI QA reviews across your workspace — every
          iteration, verdict, trigger source, and link to the GitHub comment.
        </p>
      </header>

      <ReviewsManager initialReviews={reviews} />
    </div>
  );
}
