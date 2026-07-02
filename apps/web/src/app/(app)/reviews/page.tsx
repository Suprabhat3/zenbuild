import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ReviewsManager } from "@/components/app/reviews-manager";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Review History · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const reviews = await api.review.list({ limit: 100 });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Quality"
        title="Review history"
        description="Full audit trail of AI QA reviews across your workspace — every iteration, verdict, trigger source, and link to the GitHub comment."
      />

      <ReviewsManager initialReviews={reviews} />
    </div>
  );
}
