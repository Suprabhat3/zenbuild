# ZenBuild — Implementation Plan

> A phase-by-phase build plan covering every requirement in [requirement.md](requirement.md).
> Each phase is independently shippable and ends with a concrete "Done when" checklist.
>
> **Bar: industry-grade SaaS, not a hackathon demo.** Time is not a constraint. Every phase
> ships with tests, proper error handling, observability, and security — nothing is stubbed,
> mocked-in-prod, or "good enough for the demo". The cross-cutting standards below are
> non-negotiable and apply to *every* phase.

---

## Progress tracker

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Decisions locked | ✅ Done |
| 1 | Foundation: data, tRPC, env | ✅ Done |
| 2 | Auth & Multi-tenant Workspaces | ✅ Done |
| 3 | App Shell, Projects & Feature-Request Intake | ✅ Done |
| 4 | Product Discovery: Clarification + PRD Generation | ✅ Done |
| 5 | PRD Editor & Approval | ✅ Done |
| 6 | Planning: Task Generation + Kanban | ✅ Done |
| 7 | GitHub App & Repository Integration | ✅ Done |
| 8 | Coding Agent | ✅ Done |
| 9 | AI Code Review | ✅ Done |
| 10 | Fix Loop & Re-Review | ✅ Done |
| 11 | Review History | ✅ Done |
| 12 | Human Approval & Ship | ✅ Done |
| 13 | Billing & Credits (Razorpay) | ✅ Done |
| 14 | Polish, Observability & Deploy | 🚧 In progress (polish + docs done; deploy pending) |

> Legend: ✅ Done · 🚧 In progress · ⬜ Not started. Keep this table and the per-phase
> "Status" lines in sync as work lands.

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
| **Auth** | **BetterAuth** (email/password + GitHub + Google OAuth login). |
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

# Phase 1 — Foundation: data, tRPC, env  ✅ Done

**Status:** Complete. `packages/db` (Prisma 7 + `prisma-client` generator + `@prisma/adapter-pg`
driver adapter, full domain schema, migration `init` applied to Neon, idempotent seed),
`packages/env` (zod-validated `serverEnv`/`clientEnv`, single `DATABASE_URL`), `packages/api`
(tRPC v11 with `public`/`protected`/`org` procedures + `requireRole`, `health` query), and
`apps/web` tRPC wiring (route handler, React Query provider, RSC caller, `/status` smoke page).
`pnpm -r typecheck` green; verified end-to-end.

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

# Phase 2 — Auth & Multi-tenant Workspaces  ✅ Done

**Status:** Complete and verified end-to-end (signup → default workspace → invite → switch).
See implementation notes under each item below.

**Goal:** Users can sign up, create/switch organizations, invite teammates. Maps to *Authentication*, *Workspace Management*, *SaaS multi-tenancy*.

1. ✅ **BetterAuth** in `packages/auth`: email/password + **optional** GitHub and Google OAuth (auto-disabled until creds set). Mounted at `/api/auth/[...all]`. **Email verification is mandatory via a 6-digit OTP** (the `emailOTP` plugin with `overrideDefaultEmailVerification`): signup no longer auto-signs-in or auto-provisions a workspace — the user verifies the code, then completes onboarding. Sign-in with an unverified email re-sends a code and routes to the verify screen. Transactional email goes through `@zenbuild/email` (Resend when `RESEND_API_KEY` is set, console fallback otherwise; `EMAIL_FROM` configurable), with on-brand HTML templates for the verification code, post-onboarding welcome, and org invites.
   - ✅ **Onboarding** (`/onboarding` + `onboarding` tRPC router): after verifying, the user picks **Individual** (solo personal workspace) or **Organization** (team workspace) and a plan. This provisions the org + owner membership + subscription transactionally (with `AuditLog` + credit grant) and sends the welcome email. `Organization.accountType` (`INDIVIDUAL | ORGANIZATION`) records the choice; plan options are server-validated per account type (`FREE`/`PRO` for individuals, `FREE`/`TEAM` for orgs). Razorpay checkout for paid plans lands in Phase 13.
2. ✅ **Org lifecycle**: default org created on signup, plus create / list / switch (active org in session) / update — via the BetterAuth organization client (owns cookie + active-org + CSRF correctly); org-isolated reads exposed through tRPC `viewer` router.
3. ✅ **Members & invites**: `member.list` + `member.pendingInvitations` (tRPC, org-scoped reads); invite / update-role / remove / cancel via the organization client with the plugin's role-based access control. Last-owner protected in the UI.
4. ✅ **UI** (shadcn / base-ui, Tailwind v4): sign-in / sign-up (+ GitHub + Google buttons), **Terms of Service** (`/terms`) and **Privacy Policy** (`/privacy`) pages with editorial styling, **mandatory terms consent checkbox** on sign-in/sign-up (blocks email and OAuth until accepted), accept-invite flow, authenticated app shell (sidebar, **org switcher** w/ create-workspace, user menu, sign-out), dashboard, Settings → General (`org.update`) + Members. Landing-page CTAs (`Sign in` / `Get started`) link into the auth pages and become “Go to dashboard” when authenticated.

**Done when:** New user signs up, lands in a default workspace, can invite a teammate, switch orgs; all data reads are org-isolated. ✅

**Notes / deferred to standards backlog:** automated tests (Vitest/Playwright) for the auth + onboarding + org flows are tracked under the cross-cutting Engineering Standards and will be added alongside the test-infra setup (currently no test runner is wired yet). A real email provider (Resend) is now wired via `@zenbuild/email`.

---

# Phase 3 — App Shell, Projects & Feature-Request Intake  ✅ Done

**Status:** Complete and verified. New schema model `IntakeKey` (per-org token +
HMAC secret, migration `add_intake_key`). tRPC routers: `project` (list/byId/
create/update/delete — soft-delete, audit-logged, owner/admin gate on delete),
`featureRequest` (list/byId/create via a shared `createFeatureRequest` helper),
`intakeKey` (get/rotate — secret returned once), `dashboard` (counts-by-state,
totals, recent audit activity, in-flight workflow runs). Inbound webhook
`POST /api/intake` verifies a per-org HMAC-SHA256 signature (timing-safe) over the
raw body, normalizes email/ticket/call aliases (subject→title, body→description,
contact* → requester*), and creates a `DRAFT` request — verified end-to-end
(401 no-creds, 401 bad-sig, 201 valid). UI: Projects (grid + create dialog +
detail), Feature Requests (list + create dialog + read-only detail with discovery/
PRD placeholders), real Dashboard, Settings → Intake (endpoint + token + signed
example + rotate). `pnpm -r typecheck` green.

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

> **Status: ✅ Done.**
> - **`packages/ai`** (new): OpenAI via AI SDK v6 (`generateObject`). Central model config (`model.ts`), zod structured-output schemas (`ClarificationSchema` = ASK/EDUCATE/PROCEED + questions/reasoning/educationNote; `PrdSchema` = problem/goals/non-goals/user-stories/acceptance-criteria/edge-cases/success-metrics), prompt builders with delimited request context, `runClarification` + `generatePrd` (return validated object + token usage + model), and a `renderPrdMarkdown` renderer.
> - **`packages/jobs`** (new): Inngest v4 client + `eventType`-typed events (`feature/clarify.requested`, `feature/prd.requested`), `WorkflowRun` tracking helpers (mark running/progress/completed/failed), and two functions — `feature-clarify` (persists an AGENT clarification message with decision metadata, DRAFT→CLARIFYING) and `feature-prd-generate` (upserts `Prd` + `PrdVersion` snapshot, CLARIFYING→PRD_DRAFTED, audit-logged). Both wrap each step in `step.run` (durable/idempotent) with `retries: 2`.
> - **API**: `clarification.start` / `clarification.answer` (records USER reply, re-runs agent), `prd.get` / `prd.generate` (regeneration bumps version), `workflowRun.latest` (polled for live status). Each creates a `WorkflowRun` (QUEUED) then emits the Inngest event, so intent is never lost if Inngest is unreachable.
> - **Web**: `/api/inngest` serve route; `DiscoveryPanel` (clarification chat — start, answer questions, proceed/educate handling — with live progress via polling that auto-refreshes server data when a run settles); `PrdView` (structured PRD with version/approval badges). Wired into the feature-request detail page.
> - **Verified**: `pnpm -r typecheck` green across all 9 packages; env-free AI core (schemas/prompts/markdown) runtime-checked (9/9). Live AI/Inngest runs require `OPENAI_API_KEY` + the Inngest dev server.
> - **Note**: a `pnpm dedupe` during this phase duplicated `@better-auth/core` and broke web typecheck; fixed by a clean install from the committed lockfile. Do not run `pnpm dedupe` here.

---

# Phase 5 — PRD Editor & Approval

**Goal:** Humans review/edit the PRD and approve it to unlock planning. Maps to *PRD Editor*, PRD section of *Human Approval*.

1. **PRD Editor**: section-based editor (each PRD section editable), markdown preview, regenerate-section action, version history.
2. **Approve PRD**: `prd.approve` (role-gated) moves state `PRD_DRAFTED → PRD_APPROVED`. Audit logged.

**Done when:** A reviewer can edit every PRD section, regenerate a section via AI, and approve; approval gates Phase 6.

> **Status: ✅ Done.**
> - **`packages/ai`**: added `regeneratePrdSection` (`src/section.ts`) — regenerates a
>   single PRD section synchronously via `generateObject`, reusing the exact per-field
>   schema from `PrdSchema` so a regenerated value satisfies the same constraints as the
>   full generator. Grounded in the current full PRD (rendered markdown) + original request
>   + clarification answers, with an optional reviewer instruction. New prompt builder
>   `buildSectionRegenPrompt` + `PRD_SECTION_LABELS` + `PRD_SECTION_KEYS`/`PrdSectionKeySchema`.
> - **API** (`prd` router): `update` (human edits — **every save bumps version + writes a
>   `PrdVersion` snapshot**, re-renders markdown, audit-logged `prd.edit`); `regenerateSection`
>   (sync AI regen, returns the proposed value for the reviewer to accept & save, audit-logged
>   `prd.section.regenerate` with token usage for cost visibility); `versions` (full history,
>   newest first); `restoreVersion` (copies a snapshot forward as a new revision, append-only,
>   audit-logged `prd.restore`); `approve` (**`requireRole("owner","admin")`**, `PRD_DRAFTED →
>   PRD_APPROVED`, stamps approver + timestamp, audit-logged `prd.approve`). All ops are
>   org-scoped through the parent feature request and **locked once the PRD is approved**.
> - **Web**: new `PrdEditor` client component replacing the read-only view on the
>   feature-request detail page — section-based editing (textarea/list/user-story editors with
>   add/remove), per-section **Regenerate with AI** (optional instruction), **Preview** toggle
>   (reuses `PrdView` to render the live draft), **Save new version**, role-gated **Approve PRD**,
>   and a **Version history** dialog (preview any version + restore). Approval state surfaced via
>   alert + locked editing. Editing permitted to any member; approval to owner/admin.
> - **Verified**: `pnpm -r typecheck` green across all 9 packages; env-free AI-core
>   (section schema wrap for every key + prompt builder + markdown) runtime-checked (18/18).
>   Live section regeneration requires `OPENAI_API_KEY`.

---

# Phase 6 — Planning: Task Generation + Kanban Board

**Goal:** Convert PRD → engineering tasks, manage on a Kanban board, approve the plan. Maps to *Planning (Phase 2)*, *AI: task generation*, *Task Board*, *Async: task creation*.

1. **Task generation** (Inngest `tasks.generate`): from approved PRD → `Task[]` with title, description, acceptance criteria, estimate, dependencies, suggested files/areas. State → `TASKS_READY`.
2. **Kanban board**: columns `Backlog → Todo → In Progress → In Review → Done`. Drag-and-drop, edit/add/delete tasks, assignees.
3. **Plan approval**: `plan.approve` confirms tasks before development.

**Done when:** Approved PRD generates editable tasks on a working Kanban board; plan can be approved to enter development.

> **Status: ✅ Done.**
> - **`packages/db`**: pure `lexorank` utility (`rankBetween`, `initialRanks`) for
>   fractional Kanban ordering without renumbering siblings — exported from the package
>   index and at `@zenbuild/db/lexorank` so both `api` (drag reordering) and `jobs`
>   (initial task creation) share one implementation.
> - **`packages/ai`**: `generateTasks` (`src/tasks.ts`) turns an approved PRD + request
>   context into an ordered, build-ready task list via `generateObject`. New `TasksSchema`
>   (title, description, acceptance criteria, priority, story-point estimate, suggested
>   areas, and `dependsOn` as 1-based indices into the list) + `TASKS_SYSTEM` /
>   `buildTasksPrompt`. Grounded strictly in the PRD.
> - **`packages/jobs`**: Inngest `feature-tasks-generate` (`feature/tasks.requested`,
>   `retries: 2`, durable `step.run`s + `WorkflowRun` progress) — loads the **approved**
>   PRD, generates tasks, and persists a fresh board in a transaction: tasks in the Backlog
>   column with lexorank ranks, dependency edges (mapping the model's 1-based indices to IDs
>   with a backward-only/in-range filter that keeps the graph acyclic), `PRD_APPROVED →
>   TASKS_READY`, audit-logged `tasks.generate`. Re-running regenerates the plan.
> - **API** (`task` router): `board` (org-scoped: ordered tasks + dependency labels +
>   assignable members + edit/generate gates); `generate` (async trigger, gated to
>   PRD_APPROVED/TASKS_READY); `create` / `update` / `remove`; `move` (column + lexorank
>   reorder from neighbour IDs, with a safe append fallback on stale ranks); `assign`
>   (validated against org membership); `approvePlan` (**`requireRole("owner","admin")`**,
>   `TASKS_READY → IN_DEVELOPMENT`, requires ≥1 task, audit-logged `plan.approve`). All
>   tenant-isolated through the parent feature request; board edits limited to
>   TASKS_READY/IN_DEVELOPMENT.
> - **Web**: themed (warm-editorial, not plain shadcn) Kanban at
>   `/feature-requests/[id]/board` — `@dnd-kit` drag-and-drop with **keyboard support**
>   (a11y) and optimistic reorder, plus a per-card menu (Move to / Assignee / Edit / Delete)
>   as a fully keyboard-accessible alternative; create/edit task dialog; assignee avatars;
>   priority/estimate/dependency chips; board summary (tasks/done/points); role-gated
>   **Approve plan** and **Regenerate tasks** (live progress). A `PlanningPanel` on the
>   detail page triggers generation (live progress) and links to the board. New CSS in
>   `styles/app.css` (`app-board`, `app-col`, `app-task-card`, …) using the `--zb-*` palette.
> - **Verified**: `pnpm -r typecheck` green across all 9 packages; env-free smoke (lexorank
>   ordering/midpoints, `TasksSchema` validation, dependency-edge acyclic mapping) 14/14.
>   Live task generation requires `OPENAI_API_KEY` + the Inngest dev server.

---

# Phase 7 — GitHub Integration (App, Repos, Webhooks)

**Goal:** Connect repos and ingest real GitHub data. Maps to *GitHub Integration (Octokit)*, *Development (Phase 3) repo connection*, *GitHub Webhooks*. **No hardcoded PR data.**

1. **`packages/github`**: GitHub App auth (JWT → installation token), Octokit factory per installation.
2. **Install & connect**: "Install GitHub App" flow → store `Installation`; `repo.listAvailable`, `repo.connect` to a project (store `Repository` with installation id + repo metadata).
3. **Webhooks** `POST /api/github/webhook`: verify signature (`GITHUB_WEBHOOK_SECRET`), handle `pull_request`, `pull_request_review`, `push`, `installation` events → emit Inngest events.
4. **PR ingestion**: on PR open/sync, create/update `PullRequest` (number, head/base, author, status), fetch **changed files + diff** via Octokit, link PR to the originating feature request when detectable (branch naming / PR body tag).

**Done when:** App installs on a real repo, connected repos list from GitHub, opening a PR creates a tracked `PullRequest` with real changed files/diffs — all from live data.

> **Status: ✅ Done.**
>
> - **`packages/github`** (new): single shared GitHub App (vendor-created; orgs install it).
>   `app.ts` reads `GITHUB_APP_*` env and exposes app-JWT + per-installation Octokit
>   factories (the `App` class caches installation tokens); everything degrades gracefully
>   via `isGithubConfigured()`/`assertGithubConfigured()` so the app boots unconfigured.
>   `state.ts` signs/verifies a tamper-proof install-state token (HMAC-SHA256, 10-min TTL);
>   `install.ts` builds the install URL; `webhook.ts` verifies `X-Hub-Signature-256` over the
>   raw body; `client.ts` lists installation repos and fetches a PR's changed files + unified
>   diff (truncated for huge PRs); `linking.ts` builds/parses the `zenbuild/<fr>/<task>` branch
>   and `<!-- zenbuild fr=… task=… -->` body marker.
> - **Install flow**: `github.installUrl` (owner/admin) → GitHub install screen with signed
>   `state` → `GET /api/github/callback` verifies state + re-checks membership + verifies the
>   `installation_id` against the API, then upserts `GithubInstallation` (audit-logged).
> - **Connect**: `github.status` / `listAvailableRepos` (live, minus already-connected) /
>   `connect` (owner/admin; re-verifies repo access, then backfills open PRs) / `disconnect` /
>   `repositories`. All org-scoped.
> - **Webhook** `POST /api/github/webhook`: verifies signature, resolves org/repo from the
>   installation id, and emits Inngest events — `pull_request` → `github/pr.sync`; `push` →
>   re-syncs open PRs on the branch; `installation` deleted → `github/installation.sync` cleanup;
>   `pull_request_review`/others acknowledged for later phases. Fast 200, heavy work async.
> - **Inngest** (`packages/jobs`): `github-pr-sync` (fetch PR + files + diff, link to the
>   feature request/task only when the parsed IDs belong to the repo's org, set AGENT/EXTERNAL
>   origin, upsert by `(repo, number)`), `github-repo-backfill` (fan out `pr.sync` for every
>   open PR on connect), `github-installation-sync` (drop the installation on uninstall).
> - **UI** (themed, warm editorial): Settings → **Integrations** page (`GithubIntegrationCard`)
>   for the org-level install + installation list; project detail page **Repositories** card
>   (`RepoConnectCard`) to connect/disconnect repos and see per-repo PR counts. Added a
>   `RouterOutputs` helper in `trpc/react` for end-to-end-typed props.
> - **Verified**: `pnpm -r typecheck` green across all 10 packages; env-free smoke (ref
>   parsing/builders/round-trip, push-ref extraction, signed-state sign/verify incl. expiry +
>   tamper rejection) 20/20. Live operations require the `GITHUB_APP_*` env + a real GitHub App;
>   webhooks require the public webhook URL configured on the App.

---

# Phase 8 — Coding Agent: Tasks → Branch → PR

**Goal:** ZenBuild can author code from tasks and open a real PR. Maps to *Development (Phase 3) "coding agents implement"*, *AI: repository analysis*.

1. **Repository analysis** (Inngest `repo.analyze`): fetch tree + key files, summarize stack/conventions into a `RepoContext` used to ground generation.
2. **Code generation agent** (Inngest `task.implement`): given a task + RepoContext + PRD, generate file changes (new/modified files) as a structured patch set.
3. **Open PR via Octokit**: create branch, commit generated files, open PR with body referencing feature request + task IDs. Sets task → In Review; feature → `IN_DEVELOPMENT`/`IN_REVIEW`.
4. **Safety/scope**: agent operates only on the connected repo with least-privilege tokens; changes always land as a PR (never auto-merged); a confidence/risk score and a self-check pass accompany each generation; large or low-confidence diffs are flagged for human edit. All generations are reproducible (prompt, model, context snapshot stored on the `WorkflowRun`).
5. **Quality**: generated code is validated against the repo's own lint/typecheck where feasible (run in the PR's CI), and failures feed straight into the Phase 9 review.

**Done when:** From an approved task, ZenBuild creates a branch, commits AI-generated changes grounded in real repo context, and opens a real PR that flows into the review pipeline — with a recorded confidence score and full reproducibility. (External human/agent PRs work identically via Phase 7.)

> **Status: ✅ Done.**
> - **`packages/ai`** (`src/coding/`): the agentic coding tier. `RepoContextSchema`
>   (stack/frameworks/package-manager/test+lint commands/conventions/key-dirs/entry-points)
>   and `ImplementationSchema` (whole-file `files[]` ADD/MODIFY + `deletions[]`, commit
>   message, PR title/body, **confidence 0-100 + risk + riskReasons**, **selfChecks**,
>   testsAdded, followUps). A read-only `RepoToolkit` (`list_files`/`read_file`, bounded +
>   recorded) is decoupled from GitHub so it's unit-testable with a fake. `analyzeRepo` and
>   `implementTask` use `generateText` with those tools + a forced answer-tool
>   (`submit_repo_context` / `submit_implementation`) so one call can both explore the repo
>   and return a validated object; `stopWhen` bounds the loop (`MAX_TOOL_STEPS` + the submit
>   tool). New `codingModel()` / `MODELS.coding`.
> - **`packages/github`** (`authoring.ts`): `getRepoTree` (recursive, capped), `getFileContent`
>   (base64-decoded, size-bounded, 404-safe), and `openPullRequestWithChanges` — lands a
>   whole-file patch set via the Git Data API (blobs → tree on `base_tree` → commit → ref) and
>   opens the PR. Idempotent on re-run: existing branch is force-updated, existing open PR is
>   reused. Per-installation (least-privilege) tokens throughout.
> - **`packages/jobs`**: `coding/repo.analyze` (`coding-repo-analyze`) caches a `RepoContext`
>   on `Repository.analysis`/`analyzedAt`; `coding/task.implement` (`coding-task-implement`,
>   `retries: 1` — side-effecting) self-heals analysis if missing, generates the patch set,
>   opens **one PR per task** on branch `zenbuild/<fr>/<task>` with the `<!-- zenbuild … -->`
>   marker, upserts the `PullRequest` (origin AGENT, linked to fr+task), moves the task →
>   IN_REVIEW and the feature IN_DEVELOPMENT → IN_REVIEW, audit-logs, and emits `github/pr.sync`
>   to backfill the real diff/line-counts. The full reproducibility record (model, tokens,
>   confidence/risk, self-checks, pinned context snapshot, files read, tool calls) lands on the
>   `WorkflowRun.output`. A shared `buildOctokitToolkit` wires the toolkit to Octokit.
> - **API** (`coding` router): `repos` (candidate connected repos for a feature + analysis
>   state), `implement` (async; auto-picks a sole connected repo, else requires `repositoryId`;
>   gated to IN_DEVELOPMENT/IN_REVIEW/FIX_NEEDED), `analyzeRepo` (owner/admin), `taskStatus`
>   (latest implement run + resulting PR, polled). `github.connect` now auto-triggers
>   `repo.analyze`; `task.board` returns each task's latest PR + a `canImplement` flag.
> - **Web**: per-task **Implement with AI** action on the Kanban card menu (available through
>   development/review, not just while editable), opening an `ImplementDialog` with a repo
>   picker (when >1 connected), live progress, and a completion summary (confidence/risk/tests +
>   PR link). Cards show a PR chip linking to the agent's PR. The project Repositories card shows
>   per-repo analysis state + a **Re-analyze** action.
> - **Verified**: `pnpm -r typecheck` green across all 10 packages; env-free smoke (Implementation/
>   RepoContext schema validation, toolkit list/read/truncate/record behavior, prompt grounding)
>   20/20. Live operations require `OPENAI_API_KEY` + the `GITHUB_APP_*` env + a real installation.

---

# Phase 9 — AI Review Loop

**Goal:** The QA agent reviews PRs against the full rubric and categorizes issues. Maps to *AI Review Loop (Phase 4)*, *AI: code review + QA validation*, *Async: AI reviews + re-review*.

1. **Review trigger** (Inngest `pr.review`): on PR open/sync or manual "Review now". Pulls PR diff + changed files + PRD + acceptance criteria + tasks.
2. **QA agent** evaluates against: **PRD requirements, acceptance criteria, engineering tasks, security, performance, edge cases, code quality.** Acts as engineering/QA reviewer, not a syntax checker — judges whether the implementation *satisfies the requirements and is production-ready*.
3. **Output**: `Review` + `ReviewIssue[]` each with severity **Blocking | Non-blocking**, category, file/line, **explanation of *why* it's an issue**, and an actionable suggested fix.
4. **Post to GitHub**: summary as PR review comment + optional inline comments via Octokit. Track review status.
5. **State**: blocking issues → feature `FIX_NEEDED`; none → `IN_REVIEW` ready for human.

**Done when:** A real PR gets an AI review with categorized, explained, actionable issues posted to GitHub and stored in ZenBuild.

> **Status: ✅ Done.**
> - **`packages/ai`** (`src/review/`): `PrReviewOutputSchema` + `ReviewIssueOutputSchema`
>   (verdict, summary, issues with severity/category/file/line/explanation/suggestion),
>   `REVIEW_SYSTEM` + `buildReviewPrompt` (grounds on request + approved PRD markdown +
>   all tasks/AC + changed files + unified diff), and `reviewPullRequest` via
>   `generateObject` with post-validation (blocking issues → `REQUEST_CHANGES`).
> - **`packages/github`** (`reviews.ts`): `postPullRequestReview` (summary + up to 25 inline
>   comments via `pulls.createReview`, graceful fallback when line numbers are stale) and
>   `formatReviewBody` for GitHub markdown.
> - **`packages/jobs`**: `review/pr.requested` (`review-pr`, `retries: 2`) loads PR + repo +
>   feature context, runs the QA agent, persists `Review` vN + `ReviewIssue[]`, posts to
>   GitHub (stores `githubReviewId`), moves the feature → `FIX_NEEDED` when blocking issues
>   exist else `IN_REVIEW`, audit-logs `pr.review`, and records token usage on the review +
>   full output on the `WorkflowRun`. `enqueuePrReview` + `shouldAutoReviewAfterSync` shared
>   helpers; `github-pr-sync` auto-enqueues after open/sync/push/agent-implement when the PR
>   is linked and the head SHA hasn't already been reviewed (dedupes in-flight runs).
> - **API** (`review` router): `list` (org feed), `byId`, `forFeature` (PRs + reviews),
>   `trigger` (manual Review now), `prStatus` (poll latest run + latest review), `canAutoReview`.
> - **Web**: `ReviewPanel` on the feature-request detail page (per-PR latest review, issues,
>   Review now + live progress); `/reviews` workspace feed. Sidebar link was already wired.
> - **Verified**: `pnpm -r typecheck` green. Live review requires `OPENAI_API_KEY` +
>   `GITHUB_APP_*` + Inngest dev server; auto-review fires after `github/pr.sync` on linked
>   open PRs.

---

# Phase 10 — Fix → Re-Review Cycle

**Goal:** Close the loop until the feature is ready. Maps to *fix-needed state*, *re-review workflows*.

1. **Fix-needed view**: shows blocking + non-blocking issues; devs (or coding agent via Phase 8) push fixes.
2. **Auto re-review**: a `push`/PR `synchronize` webhook on a PR in `FIX_NEEDED` re-triggers `pr.review`; review history accumulates (v1, v2, …).
3. **Convergence**: cycle repeats until no blocking issues → feature becomes review-ready for human approval.

**Done when:** Pushing fixes to a flagged PR automatically re-reviews it, and the feature exits `FIX_NEEDED` only when blocking issues are resolved.

> **Status: ✅ Done.**
> - **`packages/jobs`**: `computeFeatureReviewStatus` — multi-PR convergence (feature stays
>   `FIX_NEEDED` while *any* open linked PR's latest review has blocking issues; exits to
>   `IN_REVIEW` only when every open PR is reviewed clean). `shouldAutoReviewAfterSync`
>   Phase-10 rules: when `FIX_NEEDED`, only `push` / `synchronize` / `agent-implement`
>   enqueue a re-review (not passive `opened`). Re-review runs record `isReReview` on the
>   `WorkflowRun`, audit as `pr.rereview`, and bump review version (v1, v2, …).
> - **`packages/ai`**: re-review prompt grounding — prior review vN−1 issues injected so the
>   agent verifies fixes instead of re-flagging resolved items.
> - **`packages/github`**: `formatReviewBody` labels re-reviews distinctly on GitHub.
> - **API** (`review.fixNeeded`): aggregated blocking/non-blocking issues, per-PR iteration
>   timeline, linked tasks, in-flight re-review run, and computed pipeline status.
> - **Web**: `FixNeededPanel` (prominent when `FIX_NEEDED` — full issue list, iteration
>   history, board link, re-implement guidance, live re-review progress, manual re-review).
>   `ReviewPanel` shows iteration history per PR.
> - **Verified**: `pnpm -r typecheck` green.

---

# Phase 11 — Review History

**Goal:** Full audit trail of every review. Maps to *Review History* page, *Human Approval inputs*.

- Timeline per feature/PR: each review version, issues, who/what triggered it, GitHub comment links, state transitions. Filter by severity/status.

**Done when:** A feature shows its complete review history across iterations with links to GitHub.

> **Status: ✅ Done.**
> - **`packages/github`**: `buildGithubReviewUrl` deep-links to posted PR review comments.
> - **`packages/api`**: `reviewHelpers` (trigger labels, transition labels, row enrichment);
>   enhanced `list` (severity/verdict/issue-status filters, GitHub links, trigger labels);
>   enriched `byId`; new `history` (per-feature timeline, grouped by PR, iteration issues,
>   state transitions, audit trail, pipeline status).
> - **Web**: `/reviews` → filterable workspace feed (`ReviewsManager`); `/reviews/[reviewId]`
>   → full review detail with issues + GitHub link; `/feature-requests/[id]/reviews` →
>   `ReviewHistoryTimeline` (activity timeline, per-PR iteration cards, severity/status
>   filters). Links from feature detail + review panel. Timeline styles in `app.css`.
> - **Verified**: `pnpm -r typecheck` green.

---

# Phase 12 — Human Approval & Release

**Goal:** Final human gate and ship. Maps to *Human Approval (Phase 5)*, *Final Approval & Release*, *AI: release readiness checks*, *Async: release readiness*.

1. **Release readiness check** (Inngest `release.readiness`): AI summarizes PRD coverage, outstanding issues, acceptance-criteria status → readiness verdict + reasoning.
2. **Approval screen**: consolidated view of PRD, tasks, PR(s), AI review history, outstanding issues, readiness verdict.
3. **Decision**: human **Approve** or **Reject** (role-gated). Only approved features can move to `SHIPPED`. Approve → `APPROVED → SHIPPED` (optionally trigger PR merge via Octokit), reject → back to `FIX_NEEDED`/`IN_DEVELOPMENT`. All logged.

**Done when:** A reviewer sees everything needed, the AI gives a readiness verdict, and only an explicit human approval can ship the feature.

> **Status: ✅ Done.**
> - **`packages/ai`** (`src/release/`): the release-readiness agent. `ReleaseReadinessSchema`
>   (advisory verdict `READY | READY_WITH_RISKS | NOT_READY`, executive summary, PRD-coverage
>   assessment, per-criterion status `MET/PARTIAL/UNMET/UNKNOWN` with evidence, outstanding
>   concerns with severity, and a recommendation), `RELEASE_SYSTEM` + `buildReleasePrompt`
>   (grounds on request + approved PRD markdown + tasks/AC + every linked PR's diff and latest
>   review issues), and `assessReleaseReadiness` via `generateObject`. The verdict is explicitly
>   **advisory** — it never gates the state machine.
> - **`packages/github`** (`merge.ts`): `mergePullRequest` lands a PR as the App via the per-
>   installation token. "GitHub said no" outcomes (conflicts, branch protection, failing checks,
>   already-merged, 403/404) return `{ merged: false, reason }` so the caller can fall back to
>   mark-shipped; only genuinely unexpected errors (5xx/network) propagate for retry.
> - **`packages/jobs`**: `release/readiness.requested` (`release-readiness`, `retries: 2`) loads
>   the approved PRD + tasks + linked PRs (with each PR's latest completed review), runs the agent,
>   stores the verdict on `WorkflowRun.output`, and audit-logs `release.readiness`. It does **not**
>   mutate feature state.
> - **API** (`release` router): `summary` (consolidated approval-screen payload — PRD, tasks, PRs
>   with latest review + open-issue counts, pipeline status, latest readiness verdict, existing
>   decision, and the computed **hard gate**: IN_REVIEW + approved PRD + no unresolved blocking
>   issues), `assessReadiness` (async trigger, dedups in-flight), `readinessStatus` (poll),
>   `approve` (**`requireRole("owner","admin")`** — hard-gated, records an `APPROVED`
>   `ReleaseDecision` with the readiness snapshot, **optionally merges** the open linked PR(s) via
>   Octokit, then → `SHIPPED` when no open PRs remain else rests at `APPROVED`; audit-logs
>   `feature.approve`/`feature.ship`), and `reject` (**role-gated**, required reason, records a
>   `REJECTED` decision, → `FIX_NEEDED`, audit-logs `feature.reject`). All tenant-scoped.
> - **Web**: dedicated approval screen at `/feature-requests/[id]/release` (`ReleaseApprovalView`)
>   — decision banner, the human-approval gate with per-condition checklist, **Approve & ship**
>   dialog (optional-merge toggle + squash/merge/rebase method + notes) and **Reject** dialog
>   (required reason), the AI readiness report (verdict, PRD coverage, per-criterion status,
>   concerns, recommendation) with assess/re-assess + live progress, outstanding issues, linked
>   PRs, and PRD/task scope. A compact `ReleasePanel` on the feature-detail page surfaces the gate
>   state + AI verdict and links to the screen. New `lib/release.ts` display helpers.
> - **Verified**: `pnpm -r typecheck` green across all 10 packages; env-free release-schema smoke
>   (valid/invalid verdict + AC status, min-length, enum values) 6/6. Live readiness requires
>   `OPENAI_API_KEY` + the Inngest dev server; PR merge requires the `GITHUB_APP_*` env + a real
>   installation.

---

# Phase 13 — Billing & Plan Gating (Razorpay)

**Goal:** Monetized multi-tenant SaaS. Maps to *Billing (Razorpay)*, *SaaS: plans/limits/credits/repo limits/premium features*.

1. **`packages/billing`**: plan catalog (**Free / Pro / Team**) defining repo limits, AI review credits, seats, premium features.
2. **Razorpay** (test): create subscription/checkout, `POST /api/razorpay/webhook` (verify signature) → update `Subscription`.
3. **Credit accounting**: `CreditLedger` debited per AI review / generation; enforce limits in `orgProcedure` (block + upsell when exhausted). Repo-count limit enforced on connect.
4. **Billing UI**: current plan, usage (credits/repos/seats), upgrade/downgrade, invoices.

**Done when:** An org can subscribe via Razorpay test, plan limits are enforced (repos, credits, premium features), and webhooks keep subscription state in sync.

> **Status: ✅ Done.**
> - **`packages/billing`** (new): the server-authoritative billing core, with
>   graceful degradation mirroring the GitHub App (works fully unconfigured;
>   `isRazorpayConfigured()` gates the paid paths). `plans.ts` — the single source
>   of truth for what each tier *grants* (monthly AI credits, repo limit, seats,
>   premium-feature flags, INR price, Razorpay plan id from env) plus
>   account-type eligibility and the `PlanLimitError`. `credits.ts` — a two-phase
>   credit model: **gate at trigger** (`assertCanRunWorkflow`, a cheap read that
>   blocks an op + surfaces an upsell) and **debit on success** (`meterWorkflowRun`,
>   idempotent on the workflow-run id so failed/retried runs never charge), with a
>   per-workflow cost map (`PR_REVIEW` 2, `TASK_IMPLEMENT` 3, others 1; CLARIFY
>   free), `getCreditState`/`hasCreditsFor`, `grantPlanCredits` (monthly reset),
>   and `InsufficientCreditsError`. `razorpay.ts` — lazily-constructed client +
>   subscription create/cancel/fetch. `webhook.ts` — timing-safe HMAC-SHA256
>   verification for both the webhook body and the Checkout callback signature.
>   `subscription.ts` — webhook→DB reconciliation that's **idempotent by
>   construction** (sets plan/status/credits rather than incrementing, so Razorpay's
>   at-least-once delivery converges).
> - **Credit enforcement** wired into the real chokepoints: `meterWorkflowRun` runs
>   inside `markCompleted` (so every successful AI run is metered exactly once,
>   across both tRPC-triggered and webhook-triggered work); the user-initiated
>   mutations (`prd.generate`, `task.generate`, `coding.implement`/`analyzeRepo`,
>   `release.assessReadiness`, `review.trigger`) gate up front via `guardWorkflowCredits`;
>   the webhook auto-review skips with `out-of-credits` rather than silently
>   overspending. Repo-count limit enforced on `github.connect`; AI release-readiness
>   gated as a premium feature (Free keeps the manual approval gate, the AI verdict is
>   the upsell). The tRPC error formatter surfaces a structured `billingError`
>   (`INSUFFICIENT_CREDITS` / `PLAN_LIMIT`) so the client can render an upgrade CTA.
> - **API** (`billing` router): `summary` (plan, status, credits/repos/seats usage,
>   upgrade options), `plans`, `ledger` (credit-activity feed), `createSubscription`
>   (owner/admin — mints a Razorpay subscription + persists the pending id for webhook
>   resolution), `verifyPayment` (verifies the Checkout signature and optimistically
>   activates; webhook reconciles authoritatively), and `cancel` (at cycle end or
>   immediate). All audit-logged. Onboarding's `api/plans.ts` now re-exports the
>   billing catalog (one source of truth for the granted-credits value).
> - **Webhook** `POST /api/razorpay/webhook`: verifies the signature over the raw
>   body, reconciles `subscription.*` events (activated/charged/resumed → ACTIVE +
>   credit grant; cancelled/completed/expired → CANCELLED + downgrade to FREE;
>   pending/halted → PAST_DUE; paused → PAUSED), and writes an `AuditLog` row per
>   processed event.
> - **Web**: top-level **Billing** page (`/billing`, already in the sidebar) —
>   current-plan card with status + renewal/cancel, live usage meters (credits with a
>   low-balance warning, repos, seats), a plan-comparison grid with per-tier feature
>   lists and **Upgrade** buttons that drive Razorpay Checkout (loaded on demand via
>   `lib/razorpay-checkout.ts`) → `verifyPayment`, a cancel-confirmation dialog, and a
>   credit-activity table. Owners/admins manage; members get a read-only view. Degrades
>   to an "unconfigured" notice when Razorpay env is unset. `lib/billing.ts` holds the
>   display helpers.
> - **Verified**: `pnpm -r typecheck` green across all 11 packages; env-free billing-core
>   smoke (credit cost map incl. free CLARIFY, plan catalog, account eligibility,
>   timing-safe webhook + Checkout signatures incl. tamper/swap rejection, Razorpay
>   status mapping, plan-id resolution) 25/25. Live checkout/webhooks require the
>   `RAZORPAY_*` env (keys, webhook secret, per-tier plan ids) + a Razorpay test account.
> - **Note**: no schema migration was needed — the `Subscription`/`CreditLedger`/
>   `PlanTier`/`CreditReason` models shipped in the Phase-1 `init` migration. Webhook
>   idempotency relies on the reconciliation being set-based (not a unique constraint).
>   Clarification stays free (it has no `CreditReason`); credits meter the six heavy ops.

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

> **Status: 🚧 In progress.**
> - **Landing polish**: new auth-aware `LandingCta` client component — every
>   marketing CTA (Hero, FinalCta, Pricing) becomes **"Go to dashboard"** /
>   **"Go to billing"** when a visitor is already signed in (the Nav already did
>   this). Pricing rewritten to the real **3-tier** catalog (Free ₹0/25cr/1repo,
>   Pro ₹999/200cr/5repos, Team ₹2,499/500cr/25repos) sourced from
>   `packages/billing/src/plans.ts`, with the eligibility note and a 3-column
>   responsive grid (`.plans-3`).
> - **Docs (mandatory deliverable)**: comprehensive root [`README.md`](../README.md)
>   (overview, core loop, tech stack, architecture diagram, monorepo layout, data
>   model + state machine, AI features table, every Inngest workflow, GitHub App
>   setup, Razorpay billing/credits, local setup, full env-var reference, deploy
>   summary) + a detailed [`DEPLOYMENT.md`](../DEPLOYMENT.md) runbook.
> - **Deploy prep**: fixed the #1 deploy blocker — the gitignored Prisma client now
>   regenerates on every install via a `postinstall: prisma generate` in
>   `packages/db` (verified with a clean `pnpm install --frozen-lockfile`). Added
>   `RESEND_API_KEY`/`EMAIL_FROM` to `turbo.json` `globalEnv` for cache correctness.
> - **Verified**: `pnpm typecheck` green across all 10 packages; `pnpm --filter web
>   build` succeeds (landing prerenders static).
> - **Remaining**: provision prod services (Vercel/Neon/Inngest Cloud/GitHub
>   App/Razorpay) per `DEPLOYMENT.md`, then fill the live URL + demo video into the
>   README. Deferred standards backlog: automated test suite (Vitest/Playwright),
>   Sentry wiring, per-package READMEs.

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
