import type { Prd } from "./schemas";

/** Renders a structured PRD into reviewer-friendly markdown. */
export function renderPrdMarkdown(prd: Prd): string {
  const section = (heading: string, body: string) => `## ${heading}\n\n${body}`;
  const bullets = (items: string[]) =>
    items.length ? items.map((i) => `- ${i}`).join("\n") : "_None._";

  const stories = prd.userStories.length
    ? prd.userStories
        .map((s) => `- As a ${s.as}, I want ${s.want}, so that ${s.soThat}.`)
        .join("\n")
    : "_None._";

  return [
    `# ${prd.title}`,
    section("Problem statement", prd.problemStatement),
    section("Goals", bullets(prd.goals)),
    section("Non-goals", bullets(prd.nonGoals)),
    section("User stories", stories),
    section("Acceptance criteria", bullets(prd.acceptanceCriteria)),
    section("Edge cases", bullets(prd.edgeCases)),
    section("Success metrics", bullets(prd.successMetrics)),
  ].join("\n\n");
}
