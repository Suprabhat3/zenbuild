import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TRPCError } from "@trpc/server";

import { KanbanBoard } from "@/components/app/kanban-board";
import { Badge } from "@/components/ui/badge";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  type FeatureRequestStatus,
} from "@/lib/feature-request";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Task board · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let request: Awaited<ReturnType<typeof api.featureRequest.byId>>;
  let board: Awaited<ReturnType<typeof api.task.board>>;
  try {
    [request, board] = await Promise.all([
      api.featureRequest.byId({ id }),
      api.task.board({ featureRequestId: id }),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const activeOrg = await api.viewer.activeOrganization();
  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";
  const status = request.status as FeatureRequestStatus;

  return (
    <div className="space-y-6">
      <Link href={`/feature-requests/${id}`} className="app-back-link">
        <ArrowLeft className="size-4" />
        Back to request
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE_VARIANT[status]}>
            {STATUS_LABELS[status]}
          </Badge>
          {request.project && (
            <span className="text-muted-foreground text-sm">
              {request.project.name} ({request.project.key})
            </span>
          )}
        </div>
        <h1 className="app-page-title">{request.title}</h1>
        <p className="app-page-lede">
          Engineering plan — drag tasks across columns, edit details, assign
          owners, and approve the plan to enter development.
        </p>
      </header>

      <KanbanBoard
        featureRequestId={id}
        initialData={board}
        canApprove={canApprove}
      />
    </div>
  );
}
