import { runClarification, type RequestContext } from "@zenbuild/ai";
import { db } from "@zenbuild/db";
import type { InngestFunction } from "inngest";

import { clarifyRequested, inngest } from "../client";
import { markCompleted, markFailed, markRunning, updateProgress } from "../workflow";

/**
 * `feature/clarify.requested` → the clarification agent analyzes the request
 * (plus any prior answers) and decides ASK / EDUCATE / PROCEED. The decision is
 * persisted as an AGENT clarification message; the request moves DRAFT→CLARIFYING.
 */
export const clarifyFeature: InngestFunction.Any = inngest.createFunction(
  {
    id: "feature-clarify",
    name: "Clarify feature request",
    retries: 2,
    triggers: [clarifyRequested],
  },
  async ({ event, step, runId }) => {
    const { featureRequestId, organizationId, workflowRunId } = event.data;

    try {
      await step.run("mark-running", () =>
        markRunning(workflowRunId, runId ?? null, "Analyzing request"),
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

      await step.run("progress-analyzing", () =>
        updateProgress(workflowRunId, 40, "Consulting product agent"),
      );

      const result = await step.run("run-clarification", () =>
        runClarification(ctx),
      );

      await step.run("persist-decision", async () => {
        const { clarification } = result;
        const content =
          clarification.decision === "EDUCATE"
            ? clarification.educationNote || clarification.reasoning
            : clarification.reasoning;

        await db.$transaction([
          db.clarificationMessage.create({
            data: {
              featureRequestId,
              role: "AGENT",
              content,
              metadata: {
                decision: clarification.decision,
                questions: clarification.questions,
                model: result.model,
              },
            },
          }),
          db.featureRequest.update({
            where: { id: featureRequestId },
            data: { status: "CLARIFYING" },
          }),
        ]);
      });

      await step.run("mark-completed", () =>
        markCompleted(workflowRunId, {
          decision: result.clarification.decision,
          questionCount: result.clarification.questions.length,
        }),
      );

      return { decision: result.clarification.decision };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await step.run("mark-failed", () => markFailed(workflowRunId, message));
      throw err;
    }
  },
);
