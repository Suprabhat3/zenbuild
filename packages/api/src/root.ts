import { z } from "zod";

import { dashboardRouter } from "./routers/dashboard";
import { featureRequestRouter } from "./routers/featureRequest";
import { intakeKeyRouter } from "./routers/intakeKey";
import { memberRouter } from "./routers/member";
import { onboardingRouter } from "./routers/onboarding";
import { projectRouter } from "./routers/project";
import { viewerRouter } from "./routers/viewer";
import { createTRPCRouter, publicProcedure } from "./trpc";

/**
 * Root application router. Feature routers (project, featureRequest, prd, task,
 * github, review, billing, …) are merged in here as each phase lands.
 */
export const appRouter = createTRPCRouter({
  health: publicProcedure.query(({ ctx }) => {
    return {
      status: "ok" as const,
      authenticated: Boolean(ctx.session?.user),
      time: new Date().toISOString(),
    };
  }),

  echo: publicProcedure
    .input(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: input.message })),

  viewer: viewerRouter,
  member: memberRouter,
  onboarding: onboardingRouter,
  project: projectRouter,
  featureRequest: featureRequestRouter,
  intakeKey: intakeKeyRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
