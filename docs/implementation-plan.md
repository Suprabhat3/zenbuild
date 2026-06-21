# ZenBuild — Implementation Plan

> A phase-by-phase build plan covering every requirement in [requirement.md](requirement.md).
> Each phase is independently shippable and ends with a concrete "Done when" checklist.
>
> **Bar: industry-grade SaaS, not a hackathon demo.** Time is not a constraint. Every phase
> ships with tests, proper error handling, observability, and security — nothing is stubbed,
> mocked-in-prod, or "good enough for the demo". The cross-cutting standards below are
> non-negotiable and apply to *every* phase.

---

## Engineering standards (apply to every phase)

These are acceptance criteria for all work, not a separate phase.

- **Testing**: unit tests for business logic (Vitest), integration tests for tRPC routers against a real test Postgres, E2E for critical flows (Playwright). AI/agent outputs tested against fixtures + schema validation. CI runs typecheck + lint + tests on every PR; red CI blocks merge.
- **Type safety**: strict TS everywhere, no `any`, zod-validated boundaries (env, tRPC inputs, AI outputs, webhook payloads). End-to-end types from DB → tRPC → client.
- **Security**: org-scoped authorization enforced in tRPC middleware (every query/mutation), webhook signature verification (GitHub, Razorpay) with timing-safe compare, secrets only in env, no PII in logs, rate limiting on public/expensive endpoints, CSRF/session hardening via BetterAuth, least-privilege GitHub App permissions.
- **Data integrity**: all multi-write operations in transactions, optimistic-concurrency where state machines matter, idempotency keys on webhook + Inngest handlers (events arrive more than once), soft-delete + `AuditLog` for sensitive actions.
- **Observability**: structured logging (request/org/trace ids), error tracking (Sentry), Inngest run visibility surfaced in-app, AI cost/token + latency metrics per call.
- **Resilience**: retries with backoff + dead-letter handling on Inngest functions, circuit-breaking around GitHub/AI rate limits, graceful degradation when an external service is down.
- **DX & docs**: each package has a README; conventional commits; `.env.example` kept in sync; seed data for local dev; Prisma migrations reviewed (no `db push` in shared environments).
- **Accessibility & UX**: WCAG-AA, keyboard nav, focus management, loading/empty/error states for every async surface.

---

## 0. Decisions locked (no ambiguity)

| Area | Decision |
|------|----------|
| **Monorepo** | Existing Turborepo + pnpm. Add `packages/*` for shared code, keep `apps/web` as the Next.js app. |
| **Database + ORM** | **PostgreSQL + Prisma** (Neon for hosted). Single `DATABASE_URL`. |
| **Auth** | **BetterAuth** (email/password + GitHub OAuth login). |
| **GitHub** | **GitHub App** (per-org installation, installation tokens via Octokit, app-level webhooks, posts comments as the app). |
| **AI** | **OpenAI via Vercel AI SDK** (`@ai-sdk/openai`, `OPENAI_API_KEY`) for all AI operations. |
| **Async** | **Inngest** (Inngest Cloud in prod; dev server locally). |
| **Billing** | **Razorpay in test mode** (subscriptions + plan gating). |
| **Intake** | In-app form (primary) **+** generic inbound webhook `POST /api/intake` simulating email/ticket/call payloads. |
| **Code authoring** | **Both**: ZenBuild tracks externally-opened PRs (webhook-driven) **and** has a coding agent that turns tasks into a branch + PR via Octokit. |
| **Deploy** | Vercel (web) + Neon (db) + Inngest Cloud + Razorpay test. |
| **API** | **tRPC** end-to-end, type-safe, in `packages/api`. |

### Core loop being delivered
`Feature Request → PRD → Tasks → Code → AI Review → Fixes → Re-Review → Human Approval → Ship`

### Multi-tenancy model
Everything is scoped to an **Organization (workspace)**. A user belongs to one or more orgs via **Membership** (role: owner/admin/member). All queries are org-scoped in tRPC middleware. Billing, repos, feature requests, PRDs, tasks, reviews, and credits all hang off `organizationId`.

---

## Target monorepo structure

```
apps/
  web/                 # Next.js 16 app (UI + route handlers for auth, webhooks, inngest, razorpay)
packages/
  db/                  # Prisma schema, client, migrations, seed
  api/                 # tRPC routers, context, procedures (org-scoped middleware)
  auth/                # BetterAuth config + helpers
  ai/                  # AI SDK prompts, schemas (zod), agent functions
  github/              # Octokit wrappers, GitHub App auth, webhook verify
  jobs/                # Inngest client + all functions (PRD gen, tasks, review, etc.)
  billing/             # Razorpay client, plan definitions, credit accounting
  ui/                  # shared Shadcn UI components (optional; can live in apps/web)
  tsconfig/            # existing
```

---

# Phase 1 — Foundation: data, tRPC, env

**Goal:** A typed, org-scoped backend skeleton the rest of the app builds on. No features yet.

1. **`packages/db`** — Prisma + Postgres.
   - Models (initial): `User`, `Session`, `Account`, `Verification` (BetterAuth tables), `Organization`, `Membership`, `Project`, `Repository`, `FeatureRequest`, `Prd`, `Task`, `PullRequest`, `Review`, `ReviewIssue`, `WorkflowRun`, `Subscription`, `CreditLedger`, `AuditLog`.
   - Enums for state machines (see Phase data states below).
   - `prisma migrate dev`, generated client exported from package, `seed.ts` with a demo org.
2. **`packages/api`** — tRPC v11.
   - `createContext` (session + db + current org).
   - `publicProcedure`, `protectedProcedure` (requires session), `orgProcedure` (requires `organizationId` + membership check).
   - Root router stub with a `health` query.
3. **`apps/web`** — mount tRPC.
   - `/api/trpc/[trpc]` route handler, React Query provider, typed client.
4. **Env + tooling**: `.env.example` with all keys from `turbo.json`, zod env validation, ESLint config, CI typecheck.

**Feature-request state machine** (used everywhere downstream):
`DRAFT → CLARIFYING → PRD_DRAFTED → PRD_APPROVED → TASKS_READY → IN_DEVELOPMENT → IN_REVIEW → FIX_NEEDED → APPROVED → SHIPPED` (+ `REJECTED`, `DECLINED_DUPLICATE`).

**Done when:** `pnpm typecheck` passes; a tRPC `health` query returns from a page; migrations apply to Neon.

---

# Phase 2 — Auth & Multi-tenant Workspaces

**Goal:** Users can sign up, create/switch organizations, invite teammates. Maps to *Authentication*, *Workspace Management*, *SaaS multi-tenancy*.

1. **BetterAuth** in `packages/auth`: email/password + GitHub OAuth provider. Mount `/api/auth/[...all]`.
2. **Org lifecycle**: create org on first login, `org.create`, `org.list`, `org.switch` (active org stored in cookie/session), `org.update`.
3. **Members & invites**: `member.list`, `member.invite` (email token), `member.updateRole`, `member.remove`. Role-based guards in `orgProcedure`.
4. **UI**: auth pages (sign in / sign up), org switcher in app shell, Settings → Members page (Shadcn data table).

**Done when:** New user signs up, lands in a default workspace, can invite a teammate, switch orgs; all data reads are org-isolated.

---

# Phase 3 — App Shell, Projects & Feature-Request Intake

**Goal:** Dashboard + projects + the entry point of the core loop. Maps to *Dashboard*, *Project View*, *Feature Requests*, *Product Discovery (intake)*.

1. **App shell**: authenticated layout, sidebar nav (Dashboard, Projects, Feature Requests, Repos, Reviews, Billing, Settings), org switcher, Shadcn theming.
2. **Projects**: CRUD (`project.*`), a project groups feature requests + repositories.
3. **Feature request intake — two paths:**
   - **In-app form**: title, description, requester, source (`FORM | EMAIL | TICKET | CALL`), priority.
   - **Inbound webhook** `POST /api/intake`: accepts a normalized payload (subject/body/source/contact), HMAC-protected, creates a `FeatureRequest` in `DRAFT`. Lets us demo "email/ticket/call → request".
4. **Dashboard**: counts by state, recent activity, in-flight workflow runs.

**Done when:** A request can be created via UI and via the intake webhook; both appear in the org's Feature Requests list and Dashboard.

---

# Phase 4 — Product Discovery: Clarification + PRD Generation (AI + Inngest)

**Goal:** The AI agent gathers missing context, decides if the request is worth building, then generates a structured PRD. Maps to *Product Discovery (Phase 1)*, *AI: requirement clarification + PRD generation*, *Async: PRD generation*.

1. **`packages/ai`**: AI SDK client, zod output schemas (`ClarificationSchema`, `PrdSchema`), reusable prompt builders.
2. **Clarification agent** (`feature.clarify`):
   - Analyzes the request; returns either (a) **follow-up questions** (missing context), (b) a **"may already exist / educate"** response with reasoning, or (c) **"proceed"**.
   - User answers questions in a chat-style panel; answers append to request context. State `DRAFT → CLARIFYING`.
3. **PRD generation** (Inngest `prd.generate`): produces structured PRD with **Problem statement, Goals, Non-goals, User stories, Acceptance criteria, Edge cases, Success metrics**. Stored in `Prd` (JSON + rendered markdown). State → `PRD_DRAFTED`.
4. **Workflow visibility**: `WorkflowRun` rows track step/status/progress; UI shows live status (poll or Inngest realtime).

**Done when:** A request triggers clarification, the agent can ask questions / flag duplicates / proceed, and a complete structured PRD is generated asynchronously with visible progress.

---

# Phase 5 — PRD Editor & Approval

**Goal:** Humans review/edit the PRD and approve it to unlock planning. Maps to *PRD Editor*, PRD section of *Human Approval*.

1. **PRD Editor**: section-based editor (each PRD section editable), markdown preview, regenerate-section action, version history.
2. **Approve PRD**: `prd.approve` (role-gated) moves state `PRD_DRAFTED → PRD_APPROVED`. Audit logged.

**Done when:** A reviewer can edit every PRD section, regenerate a section via AI, and approve; approval gates Phase 6.

---

# Phase 6 — Planning: Task Generation + Kanban Board

**Goal:** Convert PRD → engineering tasks, manage on a Kanban board, approve the plan. Maps to *Planning (Phase 2)*, *AI: task generation*, *Task Board*, *Async: task creation*.

1. **Task generation** (Inngest `tasks.generate`): from approved PRD → `Task[]` with title, description, acceptance criteria, estimate, dependencies, suggested files/areas. State → `TASKS_READY`.
2. **Kanban board**: columns `Backlog → Todo → In Progress → In Review → Done`. Drag-and-drop, edit/add/delete tasks, assignees.
3. **Plan approval**: `plan.approve` confirms tasks before development.

**Done when:** Approved PRD generates editable tasks on a working Kanban board; plan can be approved to enter development.

---

# Phase 7 — GitHub Integration (App, Repos, Webhooks)

**Goal:** Connect repos and ingest real GitHub data. Maps to *GitHub Integration (Octokit)*, *Development (Phase 3) repo connection*, *GitHub Webhooks*. **No hardcoded PR data.**

1. **`packages/github`**: GitHub App auth (JWT → installation token), Octokit factory per installation.
2. **Install & connect**: "Install GitHub App" flow → store `Installation`; `repo.listAvailable`, `repo.connect` to a project (store `Repository` with installation id + repo metadata).
3. **Webhooks** `POST /api/github/webhook`: verify signature (`GITHUB_WEBHOOK_SECRET`), handle `pull_request`, `pull_request_review`, `push`, `installation` events → emit Inngest events.
4. **PR ingestion**: on PR open/sync, create/update `PullRequest` (number, head/base, author, status), fetch **changed files + diff** via Octokit, link PR to the originating feature request when detectable (branch naming / PR body tag).

**Done when:** App installs on a real repo, connected repos list from GitHub, opening a PR creates a tracked `PullRequest` with real changed files/diffs — all from live data.

---

# Phase 8 — Coding Agent: Tasks → Branch → PR

**Goal:** ZenBuild can author code from tasks and open a real PR. Maps to *Development (Phase 3) "coding agents implement"*, *AI: repository analysis*.

1. **Repository analysis** (Inngest `repo.analyze`): fetch tree + key files, summarize stack/conventions into a `RepoContext` used to ground generation.
2. **Code generation agent** (Inngest `task.implement`): given a task + RepoContext + PRD, generate file changes (new/modified files) as a structured patch set.
3. **Open PR via Octokit**: create branch, commit generated files, open PR with body referencing feature request + task IDs. Sets task → In Review; feature → `IN_DEVELOPMENT`/`IN_REVIEW`.
4. **Safety/scope**: agent operates only on the connected repo with least-privilege tokens; changes always land as a PR (never auto-merged); a confidence/risk score and a self-check pass accompany each generation; large or low-confidence diffs are flagged for human edit. All generations are reproducible (prompt, model, context snapshot stored on the `WorkflowRun`).
5. **Quality**: generated code is validated against the repo's own lint/typecheck where feasible (run in the PR's CI), and failures feed straight into the Phase 9 review.

**Done when:** From an approved task, ZenBuild creates a branch, commits AI-generated changes grounded in real repo context, and opens a real PR that flows into the review pipeline — with a recorded confidence score and full reproducibility. (External human/agent PRs work identically via Phase 7.)

---

# Phase 9 — AI Review Loop

**Goal:** The QA agent reviews PRs against the full rubric and categorizes issues. Maps to *AI Review Loop (Phase 4)*, *AI: code review + QA validation*, *Async: AI reviews + re-review*.

1. **Review trigger** (Inngest `pr.review`): on PR open/sync or manual "Review now". Pulls PR diff + changed files + PRD + acceptance criteria + tasks.
2. **QA agent** evaluates against: **PRD requirements, acceptance criteria, engineering tasks, security, performance, edge cases, code quality.** Acts as engineering/QA reviewer, not a syntax checker — judges whether the implementation *satisfies the requirements and is production-ready*.
3. **Output**: `Review` + `ReviewIssue[]` each with severity **Blocking | Non-blocking**, category, file/line, **explanation of *why* it's an issue**, and an actionable suggested fix.
4. **Post to GitHub**: summary as PR review comment + optional inline comments via Octokit. Track review status.
5. **State**: blocking issues → feature `FIX_NEEDED`; none → `IN_REVIEW` ready for human.

**Done when:** A real PR gets an AI review with categorized, explained, actionable issues posted to GitHub and stored in ZenBuild.

---

# Phase 10 — Fix → Re-Review Cycle

**Goal:** Close the loop until the feature is ready. Maps to *fix-needed state*, *re-review workflows*.

1. **Fix-needed view**: shows blocking + non-blocking issues; devs (or coding agent via Phase 8) push fixes.
2. **Auto re-review**: a `push`/PR `synchronize` webhook on a PR in `FIX_NEEDED` re-triggers `pr.review`; review history accumulates (v1, v2, …).
3. **Convergence**: cycle repeats until no blocking issues → feature becomes review-ready for human approval.

**Done when:** Pushing fixes to a flagged PR automatically re-reviews it, and the feature exits `FIX_NEEDED` only when blocking issues are resolved.

---

# Phase 11 — Review History

**Goal:** Full audit trail of every review. Maps to *Review History* page, *Human Approval inputs*.

- Timeline per feature/PR: each review version, issues, who/what triggered it, GitHub comment links, state transitions. Filter by severity/status.

**Done when:** A feature shows its complete review history across iterations with links to GitHub.

---

# Phase 12 — Human Approval & Release

**Goal:** Final human gate and ship. Maps to *Human Approval (Phase 5)*, *Final Approval & Release*, *AI: release readiness checks*, *Async: release readiness*.

1. **Release readiness check** (Inngest `release.readiness`): AI summarizes PRD coverage, outstanding issues, acceptance-criteria status → readiness verdict + reasoning.
2. **Approval screen**: consolidated view of PRD, tasks, PR(s), AI review history, outstanding issues, readiness verdict.
3. **Decision**: human **Approve** or **Reject** (role-gated). Only approved features can move to `SHIPPED`. Approve → `APPROVED → SHIPPED` (optionally trigger PR merge via Octokit), reject → back to `FIX_NEEDED`/`IN_DEVELOPMENT`. All logged.

**Done when:** A reviewer sees everything needed, the AI gives a readiness verdict, and only an explicit human approval can ship the feature.

---

# Phase 13 — Billing & Plan Gating (Razorpay)

**Goal:** Monetized multi-tenant SaaS. Maps to *Billing (Razorpay)*, *SaaS: plans/limits/credits/repo limits/premium features*.

1. **`packages/billing`**: plan catalog (**Free / Pro / Team**) defining repo limits, AI review credits, seats, premium features.
2. **Razorpay** (test): create subscription/checkout, `POST /api/razorpay/webhook` (verify signature) → update `Subscription`.
3. **Credit accounting**: `CreditLedger` debited per AI review / generation; enforce limits in `orgProcedure` (block + upsell when exhausted). Repo-count limit enforced on connect.
4. **Billing UI**: current plan, usage (credits/repos/seats), upgrade/downgrade, invoices.

**Done when:** An org can subscribe via Razorpay test, plan limits are enforced (repos, credits, premium features), and webhooks keep subscription state in sync.

---

# Phase 14 — Polish, Landing, Deploy & Docs

**Goal:** Ship a polished, deployed product with mandatory deliverables.

1. **Landing page**: already built — finalize copy/pricing to match plans.
2. **UX polish**: loading/empty/error states, toasts, optimistic updates, mobile pass, consistent Shadcn theming, accessible workflow-progress indicators.
3. **Deploy**: Vercel (web + route handlers), Neon (db), Inngest Cloud, GitHub App in prod, Razorpay test keys. Configure all prod env vars + webhook URLs.
4. **Mandatory deliverables**:
   - **Public GitHub repo**.
   - **Live deployed URL**.
   - **Demo video** of the full core loop.
   - **README** including: project overview, tech stack, architecture, setup instructions, environment variables, database schema notes, GitHub integration setup, Inngest workflow explanation, AI features implemented.

**Done when:** Live URL works end-to-end (request → ship), repo is public, README is complete, demo video recorded.

---

## Requirement → Phase coverage map

| Requirement | Phase(s) |
|---|---|
| Multi-tenant orgs (users/projects/repos/requests/PRDs/tasks/reviews/billing) | 1, 2, 13 |
| Authentication (BetterAuth) | 2 |
| Product Discovery: clarify, educate/duplicate-check, proceed | 4 |
| Structured PRD (problem/goals/non-goals/stories/AC/edge cases/metrics) | 4, 5 |
| Planning: tasks + Kanban + plan approval | 6 |
| GitHub: connect, webhooks, PRs, changed files, diffs, comments, status (Octokit, no hardcoding) | 7, 8, 9 |
| Coding agents implement → PRs | 8 |
| AI Review against full rubric, Blocking/Non-blocking, explained | 9 |
| Fix-needed → re-review cycle | 10 |
| Review history | 11 |
| Human approval & release-readiness → Shipped | 12 |
| Billing/plans/limits/credits (Razorpay) | 13 |
| AI SDK across all AI features | 4, 6, 8, 9, 12 |
| Inngest async workflows + visible progress | 4, 6, 8, 9, 10, 12 |
| tRPC monorepo, Next.js, Prisma+Postgres, Shadcn | 1–3, all |
| Landing/Auth/Dashboard/Workspace/Project/Requests/PRD/Tasks/GitHub/Reviews/History/Billing/Approval pages | 2–14 |
| Deploy, public repo, demo video, README | 14 |

---

## Suggested build order & dependencies

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14
                              └────────── 9 depends on 7 (real PRs)
                              8 depends on 7 (repo connection)
13 can start in parallel after 2 (independent of the loop)
```

Build the **core loop (Phases 1–12)** first as the primary deliverable; **Phase 13 (billing)** can be developed in parallel once auth (Phase 2) exists; **Phase 14** finalizes deploy + docs.

Every phase is built to the **Engineering standards** above — no phase is considered complete without its tests, authorization checks, error handling, and observability in place. We optimize for a product a real engineering team would trust in production, not for the shortest path to a working demo.
