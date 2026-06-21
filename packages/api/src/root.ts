import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "./trpc";

/**
 * Root application router. Feature routers (org, project, featureRequest, prd,
 * task, github, review, billing, …) are merged in here as each phase lands.
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
});

export type AppRouter = typeof appRouter;
