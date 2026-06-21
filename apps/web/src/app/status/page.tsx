import { api } from "@/trpc/server";

export const dynamic = "force-dynamic";

/**
 * Phase 1 smoke-test page: calls the tRPC `health` procedure server-side to
 * verify the API + DB + env wiring end to end. Remove once real pages land.
 */
export default async function StatusPage() {
  const health = await api.health();

  return (
    <main style={{ fontFamily: "var(--font-body), system-ui", padding: 48 }}>
      <h1>ZenBuild — system status</h1>
      <pre
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 8,
          background: "#0a0a0a",
          color: "#e5e5e5",
          width: "fit-content",
        }}
      >
        {JSON.stringify(health, null, 2)}
      </pre>
    </main>
  );
}
