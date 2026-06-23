import { createTRPCRouter, orgProcedure } from "../trpc";

/**
 * Read-only aggregates powering the dashboard: feature-request counts by state,
 * headline totals, recent audit activity, and in-flight workflow runs. All
 * org-scoped via `orgProcedure`.
 */
export const dashboardRouter = createTRPCRouter({
  summary: orgProcedure.query(async ({ ctx }) => {
    const { organizationId } = ctx;

    const [statusGroups, projectCount, repositoryCount, activeRuns] =
      await Promise.all([
        ctx.db.featureRequest.groupBy({
          by: ["status"],
          where: { organizationId },
          _count: { _all: true },
        }),
        ctx.db.project.count({
          where: { organizationId, deletedAt: null },
        }),
        ctx.db.repository.count({ where: { organizationId } }),
        ctx.db.workflowRun.findMany({
          where: {
            organizationId,
            status: { in: ["QUEUED", "RUNNING"] },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            featureRequest: { select: { id: true, title: true } },
          },
        }),
      ]);

    const countsByStatus: Record<string, number> = {};
    let totalRequests = 0;
    for (const group of statusGroups) {
      countsByStatus[group.status] = group._count._all;
      totalRequests += group._count._all;
    }

    const recentActivity = await ctx.db.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { name: true, email: true } } },
    });

    return {
      totals: {
        featureRequests: totalRequests,
        projects: projectCount,
        repositories: repositoryCount,
        activeRuns: activeRuns.length,
      },
      countsByStatus,
      activeRuns: activeRuns.map((run) => ({
        id: run.id,
        type: run.type,
        status: run.status,
        step: run.step,
        progress: run.progress,
        createdAt: run.createdAt,
        featureRequest: run.featureRequest,
      })),
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt,
        actor: log.actor
          ? log.actor.name || log.actor.email
          : "System",
      })),
    };
  }),
});
