import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { ReleaseApprovalView } from "@/components/app/release-approval-view";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const fr = await api.featureRequest.byId({ id });
    return { title: `Release · ${fr.title} · ZenBuild` };
  } catch {
    return { title: "Release · ZenBuild" };
  }
}

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

  const status = summary.feature.status as FeatureRequestStatus;
  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <div className="space-y-8">
      <Link href={`/feature-requests/${id}`} className="app-back-link">
        <ArrowLeft className="size-4" />
        Feature request
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[status]}>
            {STATUS_LABELS[status]}
          </Badge>
          {summary.prd && (
            <Badge variant="outline">PRD v{summary.prd.version}</Badge>
          )}
        </div>
        <h1 className="app-page-title">Human approval &amp; release</h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Everything needed to make the final ship decision for{" "}
          <strong>{summary.feature.title}</strong> — the AI readiness verdict, PRD
          coverage, acceptance criteria, outstanding issues, and the linked pull
          requests. Only an explicit human approval can ship it.
        </p>
      </header>

      <ReleaseApprovalView
        featureRequestId={id}
        canApprove={canApprove}
        initialData={summary}
      />
    </div>
  );
}
