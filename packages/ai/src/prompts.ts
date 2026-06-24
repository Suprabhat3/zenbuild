/**
 * Prompt builders for the product-discovery agents. Kept separate from the
 * generation calls so prompts are easy to read, review, and iterate on. All
 * request-derived content is clearly delimited so the model treats it as data,
 * not instructions.
 */

export interface RequestContext {
  title: string;
  description: string;
  priority: string;
  source: string;
  projectName?: string | null;
  /** Prior clarification turns, oldest first. */
  conversation?: { role: "AGENT" | "USER"; content: string }[];
}

function renderContext(ctx: RequestContext): string {
  const lines = [
    `Title: ${ctx.title}`,
    `Priority: ${ctx.priority}`,
    `Source: ${ctx.source}`,
  ];
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  lines.push("", "Description:", ctx.description);

  if (ctx.conversation?.length) {
    lines.push("", "Clarification so far:");
    for (const turn of ctx.conversation) {
      const who = turn.role === "AGENT" ? "Agent" : "Requester";
      lines.push(`${who}: ${turn.content}`);
    }
  }
  return lines.join("\n");
}

export const CLARIFY_SYSTEM = `You are a senior product manager performing requirement discovery for a software delivery platform.
Given an incoming feature request, decide one of:
- ASK: the request is missing context needed to write a high-quality PRD. Return the smallest set of targeted, non-obvious questions (max 6). Do NOT ask questions already answered in the conversation.
- EDUCATE: the capability very likely already exists, is a duplicate, or is better solved another way. Explain clearly and kindly in educationNote.
- PROCEED: there is enough context (possibly after prior answers) to draft a PRD.
Be decisive. Prefer PROCEED once the core who/what/why and success criteria are reasonably clear — do not endlessly ask. Never invent product facts.`;

export function buildClarifyPrompt(ctx: RequestContext): string {
  return `Analyze this feature request and decide ASK, EDUCATE, or PROCEED.\n\n---\n${renderContext(
    ctx,
  )}\n---`;
}

export const PRD_SYSTEM = `You are a senior product manager writing a precise, build-ready Product Requirements Document.
Ground every section in the provided request and clarification answers — do not invent scope beyond what is supported.
Acceptance criteria must be testable and unambiguous. Keep goals outcome-focused and non-goals explicit to prevent scope creep.`;

export function buildPrdPrompt(ctx: RequestContext): string {
  return `Write a complete PRD for the following feature request, incorporating all clarification answers.\n\n---\n${renderContext(
    ctx,
  )}\n---`;
}

/** Human-readable labels for each editable PRD section. */
export const PRD_SECTION_LABELS = {
  title: "Title",
  problemStatement: "Problem statement",
  goals: "Goals",
  nonGoals: "Non-goals",
  userStories: "User stories",
  acceptanceCriteria: "Acceptance criteria",
  edgeCases: "Edge cases",
  successMetrics: "Success metrics",
} as const;

export const PRD_SECTION_SYSTEM = `You are a senior product manager refining one section of an existing Product Requirements Document.
Regenerate ONLY the requested section. Keep it consistent with the rest of the PRD, the original request, and any clarification answers.
Ground everything in the provided context — do not invent scope. Acceptance criteria must be testable; goals outcome-focused; non-goals explicit.`;

/**
 * Builds the prompt for regenerating a single PRD section. The full current PRD
 * (as markdown) is supplied as context so the model keeps the section coherent
 * with the rest of the document; an optional instruction steers the rewrite.
 */
export function buildSectionRegenPrompt(args: {
  ctx: RequestContext;
  sectionLabel: string;
  currentMarkdown: string;
  instruction?: string;
}): string {
  const { ctx, sectionLabel, currentMarkdown, instruction } = args;
  const parts = [
    `Regenerate the "${sectionLabel}" section of the PRD below.`,
    "",
    "Original feature request",
    "---",
    renderContext(ctx),
    "---",
    "",
    "Current PRD",
    "---",
    currentMarkdown,
    "---",
  ];
  if (instruction?.trim()) {
    parts.push(
      "",
      "Reviewer instruction for this section (follow it closely):",
      instruction.trim(),
    );
  }
  parts.push(
    "",
    `Return only the new content for the "${sectionLabel}" section.`,
  );
  return parts.join("\n");
}
