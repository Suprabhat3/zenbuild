import type { PrismaClient } from "@zenbuild/db";

/** Normalized inbound feature-request payload (form, email, ticket, call, API). */
export interface IntakePayload {
  title: string;
  description: string;
  source?: "FORM" | "EMAIL" | "TICKET" | "CALL" | "API";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  requesterName?: string | null;
  requesterEmail?: string | null;
  projectId?: string | null;
  /** Original payload to retain for traceability (webhook bodies). */
  rawPayload?: unknown;
}

/**
 * Single code path for creating a feature request, shared by the in-app form and
 * the inbound `/api/intake` webhook. Creates the request in `DRAFT` and writes an
 * audit-log entry in one transaction. The caller is responsible for org-scoping
 * (`organizationId`) and for validating `projectId` belongs to the org.
 */
export async function createFeatureRequest(
  db: PrismaClient,
  args: {
    organizationId: string;
    actorId?: string | null;
    payload: IntakePayload;
  },
) {
  const { organizationId, actorId, payload } = args;

  return db.$transaction(async (tx) => {
    const featureRequest = await tx.featureRequest.create({
      data: {
        organizationId,
        title: payload.title,
        description: payload.description,
        source: payload.source ?? "FORM",
        priority: payload.priority ?? "MEDIUM",
        requesterName: payload.requesterName ?? null,
        requesterEmail: payload.requesterEmail ?? null,
        projectId: payload.projectId ?? null,
        rawPayload:
          payload.rawPayload === undefined
            ? undefined
            : (payload.rawPayload as object),
        status: "DRAFT",
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId,
        actorId: actorId ?? null,
        action: "feature_request.create",
        entityType: "feature_request",
        entityId: featureRequest.id,
        metadata: {
          source: featureRequest.source,
          via: actorId ? "app" : "intake_webhook",
        },
      },
    });

    return featureRequest;
  });
}
