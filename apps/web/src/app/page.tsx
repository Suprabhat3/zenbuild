export default function Home() {
  const phases = [
    "Feature Request",
    "PRD",
    "Tasks",
    "Code",
    "AI Review",
    "Fixes",
    "Re-Review",
    "Human Approval",
    "Ship",
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-10 px-6 py-20 text-center">
      <div className="space-y-4">
        <span className="inline-block rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-widest opacity-70">
          Builder Mode On
        </span>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          ShipFlow&nbsp;AI
        </h1>
        <p className="mx-auto max-w-xl text-lg opacity-70">
          The AI-assisted product delivery platform that moves features from
          idea to production through a structured, reviewable workflow.
        </p>
      </div>

      <ol className="flex flex-wrap items-center justify-center gap-2">
        {phases.map((phase, i) => (
          <li key={phase} className="flex items-center gap-2">
            <span className="rounded-md border px-3 py-1.5 text-sm font-medium">
              {phase}
            </span>
            {i < phases.length - 1 && <span className="opacity-40">→</span>}
          </li>
        ))}
      </ol>

      <p className="text-sm opacity-50">
        Monorepo scaffold ready. Next: tRPC, database, auth.
      </p>
    </main>
  );
}
