export { db } from "./client";

// Re-export the generated Prisma client (types + enums) so consumers import
// everything from "@zenbuild/db" rather than the generated path directly.
export * from "./generated/prisma/client";

// Pure ordering helpers (no Prisma dependency); also at "@zenbuild/db/lexorank".
export { rankBetween, initialRanks } from "./lexorank";
