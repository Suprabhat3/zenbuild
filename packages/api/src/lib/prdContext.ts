import type { PrismaClient } from "@zenbuild/db";
import type { RequestContext } from "@zenbuild/ai";

/**
 * Loads a feature request (org-scoped) and shapes it into the `RequestContext`
 * the AI agents consume — the same context used for full PRD generation, so a
 * regenerated section stays grounded in the original request + clarification
 * answers. Returns null if the request isn't found in the org.
 */
export async function loadRequestContext(
  db: PrismaClient,
  args: { featureRequestId: string; organizationId: string },
): Promise<RequestContext | null> {
  const fr = await db.featureRequest.findFirst({
    where: { id: args.featureRequestId, organizationId: args.organizationId },
    include: {
      project: { select: { name: true } },
      clarifications: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!fr) return null;

  return {
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
}
