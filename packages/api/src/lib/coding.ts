import type { PrismaClient } from "@zenbuild/db";
import {
  repoAnalyzeRequested,
  sendWorkflowEvent,
  taskImplementRequested,
} from "@zenbuild/jobs";

/**
 * Kicks off the Phase-8 coding workflows. As with discovery, the `WorkflowRun`
 * row is created first and the Inngest event is sent after (marked FAILED if
 * the send fails); the two are correlated by `workflowRunId`.
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

  await sendWorkflowEvent(
    db,
    run.id,
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

  await sendWorkflowEvent(
    db,
    run.id,
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
