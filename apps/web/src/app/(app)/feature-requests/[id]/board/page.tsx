import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { KanbanBoard } from "@/components/app/kanban-board";
import { api } from "@/trpc/server";

export const metadata: Metadata = { title: "Task board · ZenBuild" };
export const dynamic = "force-dynamic";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let board: Awaited<ReturnType<typeof api.task.board>>;
  try {
    board = await api.task.board({ featureRequestId: id });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const activeOrg = await api.viewer.activeOrganization();
  const canApprove = activeOrg.role === "owner" || activeOrg.role === "admin";

  return (
    <div className="space-y-4">
      <p className="app-page-lede">
        Engineering plan — drag tasks across columns, edit details, assign
        owners, and approve the plan to enter development.
      </p>

      <KanbanBoard
        featureRequestId={id}
        initialData={board}
        canApprove={canApprove}
      />
    </div>
  );
}
