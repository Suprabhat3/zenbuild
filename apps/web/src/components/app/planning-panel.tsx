"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ListChecks, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/trpc/react";
import type { FeatureRequestStatus } from "@/lib/feature-request";

const ACTIVE = new Set(["QUEUED", "RUNNING"]);

/**
 * Planning entry point on the feature-request detail page. Appears once the PRD
 * is approved: it triggers async task generation (with live progress) and links
 * through to the full Kanban board once tasks exist.
 */
export function PlanningPanel({
  featureRequestId,
  status,
  taskCount,
}: {
  featureRequestId: string;
  status: FeatureRequestStatus;
  taskCount: number;
}) {
  const router = useRouter();
  const [polling, setPolling] = useState(false);

  const runQuery = api.workflowRun.latest.useQuery(
    { featureRequestId, type: "TASKS_GENERATE" },
    { refetchInterval: polling ? 1500 : false },
  );
  const run = runQuery.data;
  const active = run ? ACTIVE.has(run.status) : false;

  useEffect(() => {
    if (active) setPolling(true);
  }, [active]);
  useEffect(() => {
    if (polling && run && !active) {
      setPolling(false);
      if (run.status === "FAILED") toast.error(run.error ?? "Task generation failed.");
      router.refresh();
    }
  }, [polling, run, active, router]);

  const generate = api.task.generate.useMutation({
    onSuccess: () => {
      setPolling(true);
      void runQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = polling || active || generate.isPending;
  const hasTasks = taskCount > 0;

  // Only relevant from PRD approval onward.
  const visibleStatuses: FeatureRequestStatus[] = [
    "PRD_APPROVED",
    "TASKS_READY",
    "IN_DEVELOPMENT",
    "IN_REVIEW",
    "FIX_NEEDED",
    "APPROVED",
    "SHIPPED",
  ];
  if (!visibleStatuses.includes(status)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          Planning
        </CardTitle>
        <CardDescription>
          Break the approved PRD into engineering tasks and manage them on the
          Kanban board.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {busy && (
          <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            {run?.step ?? "Generating tasks…"}
            {typeof run?.progress === "number" && run.progress > 0 && (
              <span>· {run.progress}%</span>
            )}
          </div>
        )}

        {!hasTasks && status === "PRD_APPROVED" && !busy && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm leading-relaxed">
              No tasks yet. Let the AI engineering lead break the PRD into an
              ordered, build-ready plan — you can edit and reorder everything on
              the board.
            </p>
            <Button
              className="gap-1.5"
              disabled={busy}
              onClick={() => generate.mutate({ featureRequestId })}
            >
              <Sparkles className="size-4" />
              Generate tasks
            </Button>
          </div>
        )}

        {hasTasks && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{taskCount}</span>{" "}
              {taskCount === 1 ? "task" : "tasks"} on the board.
            </p>
            <Link
              href={`/feature-requests/${featureRequestId}/board`}
              className={buttonVariants({ className: "gap-1.5" })}
            >
              Open board
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
