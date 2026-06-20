import { Reveal } from "./Reveal";
import {
  MessageSearch,
  FileText,
  Kanban,
  GitBranch,
  ShieldCheck,
  Rocket,
  Sparkle,
} from "./icons";

const SMALL = [
  {
    area: "disc",
    icon: MessageSearch,
    title: "Product discovery",
    body: "Reads the request, asks for missing context, and flags when it already exists.",
  },
  {
    area: "prd",
    icon: FileText,
    title: "Structured PRDs",
    body: "Problem, goals, non-goals, user stories, acceptance criteria, edge cases, metrics.",
  },
  {
    area: "git",
    icon: GitBranch,
    title: "GitHub, connected",
    body: "Repos, webhooks, real PRs and diffs via Octokit. No hardcoded data, ever.",
  },
  {
    area: "tasks",
    icon: Kanban,
    title: "Tasks on a board",
    body: "The PRD becomes tracked engineering tasks your team approves before development.",
  },
  {
    area: "appr",
    icon: Rocket,
    title: "Human-approved ship",
    body: "A reviewer signs off the PRD, PR and AI history. Only then does it ship.",
  },
];

export function Features() {
  return (
    <section className="section" id="features" style={{ paddingTop: 24 }}>
      <div className="wrap">
        <Reveal>
          <div className="section-head">
            <span className="eyebrow">The platform</span>
            <h2 className="display">Everything the lifecycle needs.</h2>
            <p className="lede">
              One multi-tenant workspace for discovery, planning, development,
              AI review and release — built on tRPC, Inngest and the AI SDK.
            </p>
          </div>
        </Reveal>

        <div className="bento">
          {/* big showcase tile */}
          <Reveal className="tile tile-feature tile-area-ai">
            <div>
              <span className="t-icon">
                <ShieldCheck size={22} />
              </span>
              <h3>AI review that reasons about requirements</h3>
              <p>
                Your QA agent evaluates whether the implementation actually
                satisfies the PRD — checking acceptance criteria, security,
                performance and edge cases, then explaining why each issue
                matters. Fixes loop back until it's production-ready.
              </p>
            </div>
            <span className="t-verdict">
              <Sparkle size={16} /> 1 blocking · 1 non-blocking · re-review queued
            </span>
          </Reveal>

          {SMALL.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal
                key={f.area}
                className={`tile tile-area-${f.area}`}
                delay={((i % 3) + 1) as 1 | 2 | 3}
              >
                <span className="t-icon">
                  <Icon size={20} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
