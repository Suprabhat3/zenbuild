import { Reveal } from "./Reveal";

const PHASES = [
  {
    num: "01",
    kicker: "Discovery",
    title: "Understand the request — and push back when needed",
    body: "A request arrives by email, ticket, or call. The AI agent gathers missing context with follow-up questions, and tells you when the capability already exists. Only what's truly needed moves forward — then it drafts a structured PRD.",
    chips: ["Clarifying Qs", "PRD draft", "Acceptance criteria"],
  },
  {
    num: "02",
    kicker: "Planning",
    title: "Turn the PRD into tracked engineering work",
    body: "ZenBuild breaks the spec into actionable tasks, organized on a Kanban board. Your team reviews and approves the plan before a single line is written.",
    chips: ["Task breakdown", "Kanban board", "Team approval"],
  },
  {
    num: "03",
    kicker: "Development",
    title: "Connect the repo, open the pull request",
    body: "Link a GitHub repository and let developers — or coding agents — implement the feature. Pull requests carry the real changes that the spec called for.",
    chips: ["GitHub via Octokit", "Webhooks", "Real diffs"],
  },
  {
    num: "04",
    kicker: "AI Review",
    title: "Review the code against the requirements, not just syntax",
    body: "The QA agent checks the PR against the PRD, acceptance criteria, security, performance and edge cases. Issues are sorted into blocking and non-blocking — each with a reason. Fixes loop back and re-review until it's ready.",
    chips: ["Blocking vs non-blocking", "Re-review loop", "Explained findings"],
  },
  {
    num: "05",
    kicker: "Release",
    title: "A human makes the final call",
    body: "A reviewer verifies the PRD, tasks, pull request and full AI review history, then approves or rejects. Only approved features move to shipped — with the whole trail preserved.",
    chips: ["Human approval", "Audit trail", "Shipped"],
  },
];

export function Process() {
  return (
    <section className="section" id="process">
      <div className="wrap">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2 className="display">
              Five phases. <em>One</em> clear path to production.
            </h2>
            <p className="lede">
              Request → PRD → Tasks → Code → AI Review → Fixes → Approval → Ship.
              Every stage is visible, and nothing reaches production on the AI's
              word alone.
            </p>
          </div>
        </Reveal>

        <div className="timeline">
          {PHASES.map((p, i) => (
            <Reveal
              key={p.num}
              className="phase-row"
              delay={((i % 3) + 1) as 1 | 2 | 3}
            >
              <div className="phase-num">
                {p.num}
                <span className="pn-kicker">{p.kicker}</span>
              </div>
              <div className="phase-main">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
              <div className="phase-meta">
                {p.chips.map((c) => (
                  <span className="phase-chip" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
