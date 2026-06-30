<div align="center">

# ZenBuild

**From feature request to shipped — with a human in the loop.**

ZenBuild is an AI-assisted product delivery platform. It takes a raw feature
request through discovery, a structured PRD, an engineering plan, AI-authored
code, an AI code review against the requirements, a fix/re-review loop, and a
final human approval — then ships. Every AI step is observable, every external
integration is real (GitHub via Octokit, no hardcoded data), and nothing
reaches production on the AI's word alone.

</div>

> **Live demo:** _add your Vercel URL here_
> **Demo video:** _add your video link here_

---

## Table of contents

1. [Project overview](#project-overview)
2. [The core loop](#the-core-loop)
3. [Tech stack](#tech-stack)
4. [Architecture](#architecture)
5. [Monorepo layout](#monorepo-layout)
6. [Data model](#data-model)
7. [AI features](#ai-features)
8. [Inngest workflows](#inngest-workflows)
9. [GitHub integration setup](#github-integration-setup)
10. [Billing (Razorpay)](#billing-razorpay)
11. [Local setup](#local-setup)
12. [Environment variables](#environment-variables)
13. [Deployment](#deployment)
14. [Project status](#project-status)

---

## Project overview

Most "AI builds your app" demos skip the parts that make software trustworthy:
clarifying ambiguous requirements, writing a real spec, planning the work,
reviewing the implementation against that spec, and getting a human to sign off.
ZenBuild is built around exactly those parts.

It is a **multi-tenant SaaS**: everything is scoped to an **Organization
(workspace)**. Users belong to one or more orgs via memberships (owner / admin /
member), and projects, repositories, feature requests, PRDs, tasks, reviews,
credits, and billing all hang off `organizationId`. Every tRPC query and
mutation is org-scoped in middleware.

The guiding principle is **AI does the work; a human owns the decision.** The AI
clarifies, drafts, plans, codes, and reviews. A person approves the PRD,
approves the plan, and is the only gate that can ship a release.

## The core loop

```
Feature Request → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship
```

| Stage | What happens | Human gate |
|-------|--------------|------------|
| **Intake** | Request arrives via in-app form or the signed `POST /api/intake` webhook (email / ticket / call payloads). | — |
| **Discovery** | AI clarifies missing context, flags duplicates / "already exists", or proceeds. | — |
| **PRD** | AI generates a structured PRD (problem, goals, non-goals, user stories, acceptance criteria, edge cases, success metrics). Humans edit any section, regenerate sections, and **approve**. | ✅ Approve PRD |
| **Planning** | Approved PRD → engineering tasks on a Kanban board with dependencies, estimates, assignees. Plan is **approved** before development. | ✅ Approve plan |
| **Development** | Coding agent turns a task into a branch + real PR via Octokit, or an external dev/agent opens a PR (webhook-tracked). | — |
| **AI Review** | QA agent reviews the PR against the PRD/acceptance-criteria/security/perf/edge-cases. Issues are Blocking / Non-blocking with explanations + suggested fixes, posted to GitHub. | — |
| **Fix loop** | Pushing fixes auto-re-reviews; review history accumulates (v1, v2, …) until no blocking issues remain. | — |
| **Release** | AI release-readiness verdict (advisory) + consolidated approval screen. A human **approves** (optionally merging the PR) or **rejects**. | ✅ Approve & ship |

## Tech stack

| Area | Choice |
|------|--------|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Web** | Next.js 16 (App Router, RSC), React 19 |
| **API** | tRPC v11 — end-to-end type-safe, org-scoped middleware |
| **Database** | PostgreSQL (Neon) + Prisma 7 with the `@prisma/adapter-pg` driver adapter |
| **Auth** | BetterAuth — email/password + GitHub + Google OAuth, mandatory 6-digit email OTP, organization plugin |
| **AI** | OpenAI via the Vercel AI SDK v6 (`generateObject` / `generateText` + tools) |
| **Async** | Inngest v4 (durable, retried, idempotent functions) |
| **GitHub** | GitHub App (per-org install) via Octokit |
| **Billing** | Razorpay (test mode) — subscriptions, plan gating, credit accounting |
| **Email** | Resend (console fallback in dev) |
| **UI** | Tailwind CSS v4 + shadcn / base-ui, custom warm-editorial theme |
| **Validation** | Zod at every boundary (env, tRPC inputs, AI outputs, webhook payloads) |

## Architecture

```
                        ┌─────────────────────────────────────────────┐
   Browser ────────────▶│  Next.js 16 (apps/web)                       │
                        │   • RSC pages + client components            │
                        │   • Route handlers:                          │
                        │       /api/auth/*       (BetterAuth)          │
                        │       /api/trpc/*       (tRPC)                │
                        │       /api/intake       (signed intake)       │
                        │       /api/github/*     (App + webhook)       │
                        │       /api/razorpay/*   (checkout + webhook)  │
                        │       /api/inngest      (function serve)      │
                        └───────┬─────────────────────────┬────────────┘
                                │ tRPC (type-safe)         │ emit events
                                ▼                          ▼
                   ┌────────────────────┐      ┌──────────────────────────┐
                   │ packages/api       │      │ packages/jobs (Inngest)  │
                   │  org-scoped procs  │      │  durable AI/GitHub work  │
                   └─────────┬──────────┘      └────────┬─────────────────┘
                             │                          │
        ┌────────────────────┼──────────────────────────┼──────────────────┐
        ▼                    ▼                           ▼                  ▼
 packages/auth        packages/db (Prisma)        packages/ai        packages/github
 (BetterAuth)         PostgreSQL / Neon       (OpenAI + AI SDK)    (GitHub App/Octokit)
                                                                          │
                            packages/billing (Razorpay) ─── packages/email (Resend)
```

**Why this shape:**

- **tRPC for synchronous, type-safe reads/writes** and to *trigger* async work.
  Every procedure runs through org-scoped middleware; `requireRole` gates
  owner/admin actions (PRD approval, plan approval, release, billing).
- **Inngest for everything slow, expensive, or AI-driven.** A tRPC mutation
  records intent (a `WorkflowRun` row) and emits an event, so intent is never
  lost if Inngest is briefly unreachable. Functions are durable
  (`step.run`), retried with backoff, and idempotent (keyed on workflow-run /
  webhook ids — events arrive more than once).
- **Graceful degradation.** GitHub, Razorpay, OpenAI, and Resend all detect
  missing config and degrade rather than crash, so the app boots and runs the
  free tier with nothing but `DATABASE_URL` + auth secrets.
- **Security:** org-scoped authorization in middleware; timing-safe webhook
  signature verification (GitHub `X-Hub-Signature-256`, Razorpay HMAC, per-org
  intake HMAC); least-privilege per-installation GitHub tokens; secrets only in
  env; audit logging on sensitive actions.

## Monorepo layout

```
apps/
  web/          # Next.js 16 app — UI + all route handlers
packages/
  db/           # Prisma schema, client, migrations, seed, lexorank util
  api/          # tRPC routers, context, org-scoped procedures
  auth/         # BetterAuth config + helpers
  ai/           # AI SDK prompts, zod output schemas, agent functions
  github/       # GitHub App auth, Octokit wrappers, webhook verify
  jobs/         # Inngest client + all durable functions
  billing/      # Razorpay client, plan catalog, credit accounting
  email/        # Resend transactional email (console fallback)
  env/          # zod-validated server/client env
  tsconfig/     # shared TS config
```

## Data model

Prisma + PostgreSQL. Core models (all org-scoped):

- **Identity / tenancy:** `User`, `Session`, `Account`, `Verification`
  (BetterAuth), `Organization` (with `accountType` INDIVIDUAL/ORGANIZATION),
  `Member`, `Invitation`.
- **Work:** `Project`, `Repository`, `GithubInstallation`, `IntakeKey`
  (per-org HMAC intake token), `FeatureRequest`, `ClarificationMessage`,
  `Prd` + `PrdVersion` (version history), `Task` + `TaskDependency`.
- **Delivery:** `PullRequest`, `Review` + `ReviewIssue`, `ReleaseDecision`.
- **Platform:** `WorkflowRun` (Inngest run visibility + AI reproducibility:
  model, tokens, confidence, context snapshot), `Subscription`, `CreditLedger`,
  `AuditLog`.

**Feature-request state machine:**

```
DRAFT → CLARIFYING → PRD_DRAFTED → PRD_APPROVED → TASKS_READY
      → IN_DEVELOPMENT → IN_REVIEW → FIX_NEEDED → APPROVED → SHIPPED
      (+ REJECTED, DECLINED_DUPLICATE)
```

Migrations live in `packages/db/prisma/migrations` and are applied with
`prisma migrate` (never `db push` in shared environments). `seed.ts` provisions
a demo org for local dev.

## AI features

All AI runs through the **Vercel AI SDK** against **OpenAI**, with Zod
output schemas validating every structured response (`generateObject`) and a
read-only repo toolkit for the agentic coding/analysis tier (`generateText` +
tools). Token usage, model, and cost are recorded per call.

| Feature | Package | What it does |
|---------|---------|--------------|
| **Requirement clarification** | `ai/src` | ASK (follow-up questions) / EDUCATE (already exists) / PROCEED, grounded in the request. |
| **PRD generation** | `ai/src` | Structured PRD: problem, goals, non-goals, user stories, acceptance criteria, edge cases, success metrics. |
| **PRD section regeneration** | `ai/src/section` | Regenerate a single section with an optional reviewer instruction, reusing the per-field schema. |
| **Task generation** | `ai/src/tasks` | Approved PRD → ordered, build-ready tasks with estimates + acyclic dependencies. |
| **Repository analysis** | `ai/src/coding` | Explores the repo (bounded list/read tools) → a `RepoContext` (stack, conventions, test/lint commands). |
| **Coding agent** | `ai/src/coding` | Task + RepoContext + PRD → a whole-file patch set with a confidence/risk score + self-checks; opens a real PR. |
| **AI code review** | `ai/src/review` | Reviews a PR against PRD/AC/security/perf/edge-cases; Blocking/Non-blocking issues with explanations + fixes. Re-review verifies prior fixes. |
| **Release readiness** | `ai/src/release` | Advisory READY / READY_WITH_RISKS / NOT_READY verdict with PRD-coverage and per-criterion evidence. (Premium feature.) |

The AI verdict is always **advisory** — it informs the human gate, it never
moves the state machine on its own.

## Inngest workflows

Functions live in `packages/jobs/src/functions` and are served at
`POST /api/inngest`. Each tracks progress on a `WorkflowRun` row (surfaced live
in the UI by polling), wraps side effects in durable `step.run`, retries with
backoff, and is idempotent.

| Function | Trigger | Effect |
|----------|---------|--------|
| `feature-clarify` | `feature/clarify.requested` | Runs the clarification agent; `DRAFT → CLARIFYING`. |
| `feature-prd-generate` | `feature/prd.requested` | Generates PRD + version snapshot; `→ PRD_DRAFTED`. |
| `feature-tasks-generate` | `feature/tasks.requested` | Builds the Kanban board from the approved PRD; `→ TASKS_READY`. |
| `coding-repo-analyze` | `coding/repo.analyze` | Caches a `RepoContext` on the repository. |
| `coding-task-implement` | `coding/task.implement` | Generates code, opens one PR per task, moves task → In Review. |
| `github-pr-sync` | `github/pr.sync` | Fetches PR + changed files + diff, links to feature/task, auto-enqueues review. |
| `github-repo-backfill` | on repo connect | Fans out `pr.sync` for every open PR. |
| `github-installation-sync` | App uninstalled | Cleans up the installation. |
| `review-pr` | `review/pr.requested` | QA agent review → `Review` vN + `ReviewIssue[]`, posts to GitHub, sets `FIX_NEEDED`/`IN_REVIEW`. |
| `release-readiness` | `release/readiness.requested` | Computes the advisory readiness verdict. |

Locally, run the **Inngest dev server** (`npx inngest-cli@latest dev`) and leave
`INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` blank. In production, point at Inngest
Cloud with both keys set.

## GitHub integration setup

ZenBuild uses a single **GitHub App** (created once by you, the vendor); each
org *installs* it. No PR data is hardcoded — repos, PRs, changed files, and
diffs are all fetched live via Octokit, and the App posts review comments as
itself.

1. **Create a GitHub App** (Settings → Developer settings → GitHub Apps).
   - **Webhook URL:** `{APP_URL}/api/github/webhook`, with a **webhook secret**.
   - **Permissions (least privilege):** Repository — Contents (R/W, for the
     coding agent's branches/commits), Pull requests (R/W), Metadata (R).
   - **Subscribe to events:** `pull_request`, `pull_request_review`, `push`,
     `installation`.
   - Generate a **private key** (PEM).
2. Fill `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (newlines as
   literal `\n`), and `GITHUB_WEBHOOK_SECRET`.
3. In-app: **Settings → Integrations → Install GitHub App** (owner/admin). The
   install carries a signed, expiring state token; the callback verifies it,
   re-checks membership, and stores the installation.
4. Connect a repo from the project's **Repositories** card. Opening a PR (or the
   coding agent opening one) creates a tracked `PullRequest` with real files/diffs.

> "Sign in with GitHub" (OAuth) is **separate** from the GitHub App and uses
> `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`.

## Billing (Razorpay)

Plans are defined server-side in `packages/billing/src/plans.ts` (the single
source of truth; the landing page renders marketing copy on top of it):

| Plan | Price | AI credits/mo | Repos | Seats | Eligible for |
|------|-------|---------------|-------|-------|--------------|
| **Free** | ₹0 | 25 | 1 | 3 | Individual & Organization |
| **Pro** | ₹999 | 200 | 5 | 1 | Individual |
| **Team** | ₹2,499 | 500 | 25 | unlimited | Organization |

- **Credit model:** gate at trigger (`assertCanRunWorkflow` blocks + upsells),
  debit on success (`meterWorkflowRun`, idempotent on the run id — failed/retried
  runs never charge). Costs: PR review 2, task implement 3, others 1;
  clarification is free.
- **Enforcement:** repo-count limit on connect; AI release-readiness gated as a
  premium feature; credit exhaustion blocks heavy ops with a structured upsell.
- **Razorpay test mode:** `createSubscription` mints a subscription; Checkout
  runs in-browser; `POST /api/razorpay/webhook` verifies the HMAC signature and
  reconciles `subscription.*` events idempotently. Leave the `RAZORPAY_*` env
  blank to run Free-only — the billing UI degrades to an "unconfigured" state.

## Local setup

**Prerequisites:** Node ≥ 20, pnpm 10, a PostgreSQL database (Neon works great),
and an OpenAI API key for the AI features.

```bash
# 1. Install
pnpm install

# 2. Configure env
cp .env.example .env        # then fill in DATABASE_URL, BETTER_AUTH_SECRET, OPENAI_API_KEY, …

# 3. Apply migrations + seed a demo org
pnpm --filter @zenbuild/db db:migrate:deploy   # or `db:migrate` while iterating
pnpm --filter @zenbuild/db db:seed

# 4. Run the app
pnpm dev                    # Next.js on http://localhost:3000

# 5. (separate terminal) run the Inngest dev server for async workflows
npx inngest-cli@latest dev
```

Useful root scripts: `pnpm typecheck`, `pnpm lint`, `pnpm build`,
`pnpm format`. A minimum boot needs only `DATABASE_URL`, `BETTER_AUTH_SECRET`,
and `BETTER_AUTH_URL`; AI/GitHub/Razorpay/email all degrade gracefully until
configured.

## Environment variables

Full reference with comments lives in [`.env.example`](.env.example). Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | Postgres connection (runtime + migrations). |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public base URL of the web app. |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | ✅ | Auth signing + base URL. |
| `OPENAI_API_KEY` | for AI | All AI features. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | optional | "Sign in with GitHub" OAuth. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | "Sign in with Google" OAuth. |
| `RESEND_API_KEY` / `EMAIL_FROM` | optional | Transactional email (console fallback if unset). |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | for GitHub | GitHub App: repos, webhooks, PR comments, coding agent. |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | prod only | Inngest Cloud (blank locally → dev server). |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | for billing | Razorpay test-mode API + webhook. |
| `RAZORPAY_PLAN_ID_PRO` / `RAZORPAY_PLAN_ID_TEAM` | for billing | Subscription plan ids per paid tier. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | for billing | Publishable key id for browser Checkout (= `RAZORPAY_KEY_ID`). |
| `SENTRY_DSN` | optional | Error tracking. |

## Deployment

Target: **Vercel** (web + route handlers) · **Neon** (Postgres) · **Inngest
Cloud** (async) · **GitHub App** (prod) · **Razorpay** (test keys).

1. **Database:** create a Neon project, copy the pooled connection string into
   `DATABASE_URL`, and run `pnpm --filter @zenbuild/db db:migrate:deploy`.
2. **Vercel:** import the repo. Root is the monorepo; the app is `apps/web`
   (Turborepo build). Set **all** env vars from the table above (use the real
   production URLs for `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`).
3. **Inngest Cloud:** create an app, set `INNGEST_EVENT_KEY` +
   `INNGEST_SIGNING_KEY`, and register the serve endpoint
   `{APP_URL}/api/inngest`.
4. **GitHub App:** set the production webhook URL to
   `{APP_URL}/api/github/webhook` and OAuth callback to
   `{APP_URL}/api/auth/callback/github`.
5. **Razorpay:** point the webhook at `{APP_URL}/api/razorpay/webhook`
   (subscribe to `subscription.*`) and create the per-tier subscription plans.
6. **OAuth / email:** update Google's authorized redirect URI and verify your
   Resend sending domain.

## Project status

Built phase-by-phase to an industry-grade-SaaS bar — see
[`docs/implementation-plan.md`](docs/implementation-plan.md) for the full plan
and per-phase notes. Phases 1–13 (auth, multi-tenancy, intake, discovery, PRD,
planning, GitHub, coding agent, AI review, fix loop, review history, human
approval, billing) are complete; Phase 14 (polish, docs, deploy) is in progress.

---

<div align="center">
Built for the ChaiCode hackathon · From request to release, with a human in the loop.
</div>
