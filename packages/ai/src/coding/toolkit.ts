import { tool } from "ai";
import { z } from "zod";

/**
 * The read-only view of a repository the coding agents are allowed to explore.
 * Implemented by the caller (the jobs package wires it to Octokit) so this
 * package stays free of any GitHub dependency and is unit-testable with an
 * in-memory fake.
 *
 * Everything here is least-privilege and read-only: the agent can list and read
 * files to ground its work, but writes only ever happen later, as a PR, in the
 * job layer.
 */
export interface RepoToolkit {
  /**
   * Repo-relative file paths, optionally filtered to those under `prefix` (or
   * containing it). Returns a bounded list — the implementation truncates.
   */
  listFiles(prefix?: string): Promise<string[]>;
  /**
   * The contents of a single file, or null if it doesn't exist / is binary /
   * too large. `truncated` signals the contents were cut for size.
   */
  readFile(
    path: string,
  ): Promise<{ path: string; content: string; truncated: boolean } | null>;
}

/** Per-run cap on how many tool calls the agent may make (cost/safety bound). */
export const MAX_TOOL_STEPS = 24;

/** Caps to keep tool results (and thus the context) bounded. */
const MAX_LIST_RESULTS = 400;
const MAX_READ_CHARS = 40_000;

/**
 * Builds the AI-SDK tool set backed by a `RepoToolkit`, plus a `recordedReads`
 * accumulator the caller can inspect afterwards for the reproducibility record
 * (which files the agent actually looked at). The tools are intentionally tiny
 * and read-only.
 */
export function buildRepoTools(toolkit: RepoToolkit) {
  const recordedReads: string[] = [];
  const toolCalls: { tool: string; arg: string }[] = [];

  const tools = {
    list_files: tool({
      description:
        "List repository file paths. Optionally pass a path prefix or substring to filter. Use this to discover where relevant code lives before reading it.",
      inputSchema: z.object({
        prefix: z
          .string()
          .optional()
          .describe("Filter to paths under / containing this string."),
      }),
      execute: async ({ prefix }) => {
        toolCalls.push({ tool: "list_files", arg: prefix ?? "" });
        const all = await toolkit.listFiles(prefix);
        const truncated = all.length > MAX_LIST_RESULTS;
        const paths = all.slice(0, MAX_LIST_RESULTS);
        return {
          count: all.length,
          truncated,
          paths,
        };
      },
    }),

    read_file: tool({
      description:
        "Read the full contents of a single repository file by its repo-relative path. Read every file you intend to modify before changing it.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Repo-relative path, forward slashes."),
      }),
      execute: async ({ path }) => {
        toolCalls.push({ tool: "read_file", arg: path });
        const file = await toolkit.readFile(path);
        if (!file) {
          return { path, found: false as const };
        }
        recordedReads.push(path);
        const content =
          file.content.length > MAX_READ_CHARS
            ? file.content.slice(0, MAX_READ_CHARS)
            : file.content;
        return {
          path: file.path,
          found: true as const,
          truncated: file.truncated || content.length < file.content.length,
          content,
        };
      },
    }),
  };

  return { tools, recordedReads, toolCalls };
}

export type RepoTools = ReturnType<typeof buildRepoTools>["tools"];
