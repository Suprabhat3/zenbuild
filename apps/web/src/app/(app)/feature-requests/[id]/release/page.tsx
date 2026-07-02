import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { ReleaseApprovalView } from "@/components/app/release-approval-view";
import { Badge } from "@/components/ui/badge";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Ship decision · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function FeatureReleasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let summary: Awaited<ReturnType<typeof api.release.summary>>;
  let activeOrg: Awaited<ReturnType<typeof api.viewer.activeOrganization>>;
  try {
    [summary, activeOrg] = await Promise.all([
      api.release.summary({ featureRequestId: id }),
      api.viewer.activeOrganization(),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {summary.prd && <Badge variant="outline">PRD v{summary.prd.version}</Badge>}
        <p className="text-muted-foreground text-sm">
          The AI readiness verdict, PRD coverage, outstanding issues, and linked
          pull requests — only an explicit human approval can ship this.
        </p>
      </div>

      <ReleaseApprovalView
        featureRequestId={id}
        canApprove={canApprove}
        initialData={summary}
      />
    </div>
  );
}
