import type { PrismaClient } from "@zenbuild/db";
import {
  inngest,
  repoAnalyzeRequested,
  taskImplementRequested,
} from "@zenbuild/jobs";

/**
 * Kicks off the Phase-8 coding workflows. As with discovery, the `WorkflowRun`
 * row is created first (so intent is never lost) and the Inngest event is sent
 * after; the two are correlated by `workflowRunId`.
 */

export async function triggerRepoAnalyze(
  db: PrismaClient,
  args: {
    organizationId: string;
    repositoryId: string;
    featureRequestId?: string | null;
    actorId?: string | null;
  },
) {
  const run = await db.workflowRun.create({
    data: {
      type: "REPO_ANALYZE",
      status: "QUEUED",
      organizationId: args.organizationId,
      featureRequestId: args.featureRequestId ?? null,
      input: {
        repositoryId: args.repositoryId,
        triggeredBy: args.actorId ?? null,
      },
    },
  });

  await inngest.send(
    repoAnalyzeRequested.create({
      organizationId: args.organizationId,
      repositoryId: args.repositoryId,
      workflowRunId: run.id,
      ...(args.featureRequestId ? { featureRequestId: args.featureRequestId } : {}),
      ...(args.actorId ? { triggeredBy: args.actorId } : {}),
    }),
  );

  return run;
}

export async function triggerTaskImplement(
  db: PrismaClient,
  args: {
    organizationId: string;
    featureRequestId: string;
    taskId: string;
    repositoryId: string;
    actorId: string;
  },
) {
  const run = await db.workflowRun.create({
    data: {
      type: "TASK_IMPLEMENT",
      status: "QUEUED",
      organizationId: args.organizationId,
      featureRequestId: args.featureRequestId,
      input: {
        taskId: args.taskId,
        repositoryId: args.repositoryId,
        triggeredBy: args.actorId,
      },
    },
  });

  await inngest.send(
    taskImplementRequested.create({
      organizationId: args.organizationId,
      featureRequestId: args.featureRequestId,
      taskId: args.taskId,
      repositoryId: args.repositoryId,
      workflowRunId: run.id,
      triggeredBy: args.actorId,
    }),
  );

  return run;
}
