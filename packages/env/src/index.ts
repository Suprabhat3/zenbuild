import { z } from "zod";

/**
 * Centralized, zod-validated environment access.
 *
 * - `serverEnv` must only be imported in server-side code (never bundled to the
 *   client) — it contains secrets.
 * - `clientEnv` holds the `NEXT_PUBLIC_*` values safe for the browser.
 *
 * Vars are marked optional until the phase that introduces them lands; this lets
 * the app boot in earlier phases without every secret present. Each consuming
 * package re-asserts the specific vars it needs at the point of use.
 *
 * Set `SKIP_ENV_VALIDATION=1` (e.g. during Docker builds) to bypass parsing.
 */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Phase 1 — database (required)
  DATABASE_URL: z.url(),

  // Phase 2 — auth
  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Phase 2 — transactional email (Resend). When RESEND_API_KEY is unset the
  // mailer falls back to logging emails to the console (dev). EMAIL_FROM must be
  // a verified Resend sender; defaults to Resend's zero-config test sender.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("ZenBuild <onboarding@resend.dev>"),

  // Phase 4+ — OpenAI (all AI operations). The model is chosen in code /
  // per-request, not via env.
  OPENAI_API_KEY: z.string().optional(),

  // Phase 7 — GitHub App
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_SLUG: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // Phase 4+ — Inngest
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Phase 13 — Razorpay (test). Plan ids are the test-mode subscription plan
  // ids created in the Razorpay dashboard (one per paid tier); when unset the
  // matching tier can't be subscribed to and the billing UI degrades to an
  // "unconfigured" state, mirroring the GitHub App.
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_ID_PRO: z.string().optional(),
  RAZORPAY_PLAN_ID_TEAM: z.string().optional(),

  // Phase 14 — observability
  SENTRY_DSN: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
});

const skip = process.env.SKIP_ENV_VALIDATION === "1";

function parse<T extends z.ZodTypeAny>(schema: T, source: unknown): z.infer<T> {
  if (skip) return source as z.infer<T>;
  const result = schema.safeParse(source);
  if (!result.success) {
    console.error(
      "❌ Invalid environment variables:",
      z.flattenError(result.error).fieldErrors,
    );
    throw new Error("Invalid environment variables");
  }
  return result.data;
}

export const serverEnv = parse(serverSchema, process.env);

export const clientEnv = parse(clientSchema, {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
