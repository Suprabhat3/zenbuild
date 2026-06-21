import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@zenbuild/api";

import { getAuthSession } from "@/server/session";

const handler = async (req: Request) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const session = await getAuthSession(req.headers);
      return createTRPCContext({ headers: req.headers, session });
    },
    onError({ error, path }) {
      if (process.env.NODE_ENV === "development") {
        console.error(`tRPC error on '${path ?? "<no-path>"}':`, error.message);
      }
    },
  });
};

export { handler as GET, handler as POST };
