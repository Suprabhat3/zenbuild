import { generatePrd, type RequestContext } from "@zenbuild/ai";
import { db } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { inngest, prdRequested } from "../client";
import { markCompleted, markFailed, markRunning, updateProgress } from "../workflow";

/**
 * `feature/prd.requested` → generates a complete structured PRD from the request
 * and all clarification answers, stores it (with a version snapshot), and moves
 * the request CLARIFYING→PRD_DRAFTED. Re-running bumps the PRD version.
 */
export const generatePrdFn: InngestFunction.Any = inngest.createFunction(
  {
    id: "feature-prd-generate",
    name: "Generate PRD",
    retries: 2,
    triggers: [prdRequested],
  },
  async ({ event, step, runId }) => {
    const { featureRequestId, organizationId, workflowRunId } = event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Gathering context"),
      );

      const ctx = await step.run("load-request", async () => {
        const fr = await db.featureRequest.findFirst({
          where: { id: featureRequestId, organizationId },
          include: {
            project: { select: { name: true } },
            clarifications: { orderBy: { createdAt: "asc" } },
          },
        });
        if (!fr) throw new Error("Feature request not found.");

        const context: RequestContext = {
          title: fr.title,
          description: fr.description,
          priority: fr.priority,
          source: fr.source,
          projectName: fr.project?.name ?? null,
          conversation: fr.clarifications.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        };
        return context;
      });

      await step.run("progress-generating", () =>
        updateProgress(workflowRunId, 45, "Drafting PRD"),
      );

      const result = await step.run("generate-prd", () => generatePrd(ctx));

      await step.run("persist-prd", async () => {
        const existing = await db.prd.findUnique({
          where: { featureRequestId },
          select: { id: true, version: true },
        });
        const version = existing ? existing.version + 1 : 1;

        await db.$transaction(async (tx) => {
          const prd = await tx.prd.upsert({
            where: { featureRequestId },
            create: {
              featureRequestId,
              version,
              content: result.prd,
              markdown: result.markdown,
            },
            update: {
              version,
              content: result.prd,
              markdown: result.markdown,
              approvedAt: null,
              approvedById: null,
            },
          });

          await tx.prdVersion.create({
            data: {
              prdId: prd.id,
              version,
              content: result.prd,
              markdown: result.markdown,
            },
          });

          await tx.featureRequest.update({
            where: { id: featureRequestId },
            data: { status: "PRD_DRAFTED" },
          });

          await tx.auditLog.create({
            data: {
              organizationId,
              actorId: null,
              action: "prd.generate",
              entityType: "feature_request",
              entityId: featureRequestId,
              metadata: { version, model: result.model },
            },
          });
        });
      });

      await step.run("mark-completed", () =>
        markCompleted(workflowRunId, { model: result.model }),
      );

      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
