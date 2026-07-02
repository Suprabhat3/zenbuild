# ZenBuild — Manual QA Walkthrough

> The hands-on script for [enhancement.md](enhancement.md) Phase 2. Walk each
> journey in order (later ones depend on earlier state), tick ✅/❌, and log
> every defect in the findings table at the bottom. Anything that surprises you
> — even "this works but feels wrong" — is worth a row.

---

## 0. Inngest in five minutes (read this first)

Inngest is the **background-job engine** — everything slow or AI-powered runs
there instead of inside a web request, so the UI never blocks on a 30-second
OpenAI call and a crash mid-job doesn't lose work.

**How a job flows through ZenBuild:**

1. You click something like **Generate PRD**. The tRPC mutation does two fast
   things: creates a `WorkflowRun` row in Postgres (status `QUEUED` — this is
   what the UI polls to show progress) and **sends an event** to Inngest, e.g.
   `feature/prd.requested`, carrying ids (`featureRequestId`, `workflowRunId`).
2. Inngest receives the event and calls back into our app at `POST /api/inngest`,
   where all our functions are registered (`packages/jobs/src/functions/`).
   The matching function (e.g. `feature-prd-generate`) starts running.
3. The function is written as **steps** (`step.run("load-context", …)`,
   `step.run("call-openai", …)`). Each completed step's result is memoized by
   Inngest — if the process crashes or a step throws, Inngest **retries** the
   function, and already-finished steps are skipped instead of re-executed.
   That's why an AI job can't double-charge credits or double-post to GitHub.
4. As it progresses, the function updates the `WorkflowRun` row
   (`RUNNING` → progress % → `COMPLETED` or `FAILED` + error message). The UI
   polls that row — that's the live progress you see in the app.
5. Some functions aren't user-triggered: webhook handlers emit events
   (`github/pr.sync` after a push), and `workflow-reconcile` runs on a **cron**
   every 15 minutes to fail any run stuck `QUEUED` >15 min / `RUNNING` >60 min.

**Dev vs. production:**

- **Local dev**: leave `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` blank and run
  the **Inngest dev server** next to the app:
  ```
  npx inngest-cli@latest dev
  ```
  It auto-discovers the app at `http://localhost:3000/api/inngest` and gives you
  a dashboard at **http://localhost:8288** — every event, every function run,
  every step, every error, with payloads. Keep it open in a tab during this
  walkthrough; when something async "does nothing", this is where you look:
  no event = the trigger failed; event but failed run = the red run has the
  stack trace.
- **Production**: both keys set; Inngest Cloud (app.inngest.com) plays the dev
  server's role and its dashboard shows the same run history.

**If the dev server is NOT running** and you trigger an AI action: the send
fails, the run is marked `FAILED` with "background job service is unreachable"
(this is the Phase-1 fix — previously it stranded as a phantom QUEUED run).
That's itself a test — see journey 10.

---

## Setup

```powershell
# 1. Env: copy .env.example → .env at the repo root and fill in (minimum for a
#    full walkthrough: DATABASE_URL, BETTER_AUTH_SECRET, OPENAI_API_KEY;
#    GitHub App + Razorpay test keys unlock journeys 6-9).

# 2. Install + generate Prisma client
pnpm install

# 3. Terminal A — the web app
pnpm dev

# 4. Terminal B — the Inngest dev server
npx inngest-cli@latest dev
```

Open http://localhost:3000 and http://localhost:8288 (Inngest dashboard).

**Email note:** with `RESEND_API_KEY` blank, verification codes and invites are
printed to **Terminal A** (the web app console) instead of sent — watch it
during signup/invite steps.

**Tip:** test with two browser profiles (or one normal + one incognito) so you
can be Owner and invited Member at the same time.

---

## Journey 1 — Auth & onboarding

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 1.1 | Visit `/` logged out | Landing renders; CTAs say "Get started"/"Sign in" | |
| 1.2 | Try to submit sign-up without ticking the terms checkbox | Blocked until accepted (also blocks the OAuth buttons) | |
| 1.3 | Sign up with email/password | Redirected to verify-email screen; 6-digit code appears in Terminal A (or inbox) | |
| 1.4 | Enter a **wrong** code | Clear error, can retry | |
| 1.5 | Enter the right code | Onboarding: choose Individual vs Organization | |
| 1.6 | Pick **Individual** → plan options | Only FREE/PRO offered (TEAM must not appear) | |
| 1.7 | Complete onboarding on FREE | Lands on dashboard; workspace exists; welcome email in console | |
| 1.8 | Sign out → sign in again | Straight to dashboard, no re-verification | |
| 1.9 | Sign up with a second email but **don't** verify; try to sign in with it | Re-sends a code and routes to the verify screen (no silent sign-in) | |
| 1.10 | Wrong password sign-in | Clear error, no account-existence leak beyond the norm | |
| 1.11 | Visit `/dashboard` logged out | Redirected to sign-in | |
| 1.12 | OAuth buttons (if `GITHUB_CLIENT_ID`/`GOOGLE_CLIENT_ID` unset) | Buttons hidden or fail gracefully — no 500 | |

## Journey 2 — Workspace & members

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 2.1 | Org switcher → Create workspace (Organization type) | Created and switched; dashboard shows new org name | |
| 2.2 | Switch back and forth between orgs | Data (projects/requests) is isolated per org | |
| 2.3 | Settings → General: rename org | Saves, toast, name updates in sidebar switcher | |
| 2.4 | Settings → Members: invite your second email as Member | Invite email in Terminal A with accept link | |
| 2.5 | Open accept link in the second browser profile | Accept flow works; member appears in the list | |
| 2.6 | As **Member** (second profile): look for admin-only actions | No Approve PRD / Approve plan / billing management; read-only billing | |
| 2.7 | Change member's role → Admin → back to Member | Role updates reflected live | |
| 2.8 | Try to remove/demote the **last owner** | Blocked | |
| 2.9 | Cancel a pending invitation | Disappears; link no longer works | |

## Journey 3 — Projects, intake & discovery (needs `OPENAI_API_KEY` + Inngest dev server)

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 3.1 | Projects → create one | Appears in grid; detail page opens | |
| 3.2 | Feature Requests → New request (fill everything, attach the project) | Created as `DRAFT`; detail page shows meta | |
| 3.3 | Settings → Intake: copy the endpoint + the pre-signed curl example, run it | `201`; request appears in the list with the webhook's source | |
| 3.4 | Re-run the curl with a tampered body (change one char, keep signature) | `401` | |
| 3.5 | On a vague request ("make the app faster"): **Start discovery** | WorkflowRun progress appears; watch the run live at :8288; agent asks follow-up questions (`CLARIFYING`) | |
| 3.6 | Answer the questions in the chat panel | Agent re-runs; eventually proceeds | |
| 3.7 | Create a request for something the product plausibly already does | Agent returns an **EDUCATE** response with reasoning | |
| 3.8 | On a clear request: discovery → **Generate PRD** | Async run with visible progress → structured PRD (all 7 sections) → state `PRD_DRAFTED` | |

## Journey 4 — PRD editor & approval

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 4.1 | Edit several sections (text, list items, user stories add/remove) → Save | New version created; content persists on reload | |
| 4.2 | Regenerate one section with an instruction | AI proposal shown; accept → save works | |
| 4.3 | Version history: preview an old version → restore it | Restored as a **new** version (append-only) | |
| 4.4 | As **Member**: look for Approve PRD | Not available (owner/admin only) | |
| 4.5 | As Owner: Approve PRD | State → `PRD_APPROVED`; editing now locked | |

## Journey 5 — Tasks & Kanban

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 5.1 | Generate tasks from the approved PRD | Async run → Backlog fills with tasks (AC, priority, estimates, dependencies); state `TASKS_READY` | |
| 5.2 | Drag cards across columns; reorder within a column; reload | Order/column persist | |
| 5.3 | Keyboard-only: move a card (focus card → keyboard DnD or card menu) | Fully possible without a mouse | |
| 5.4 | Create, edit, delete a task; assign a member | All work; avatar shows | |
| 5.5 | Approve plan (owner/admin; needs ≥1 task) | State → `IN_DEVELOPMENT` | |

## Journey 6 — GitHub integration (needs `GITHUB_APP_*` env + a test repo)

> Webhooks need a public URL — test on the deployed instance, or tunnel local
> port 3000 (e.g. `cloudflared`/`ngrok`) and point the GitHub App's webhook URL
> at `{tunnel}/api/github/webhook`.

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 6.1 | Settings → Integrations → Install GitHub App | GitHub install screen → callback lands back in ZenBuild; installation listed | |
| 6.2 | Project detail → connect a repo | Repo listed; open PRs backfilled; analysis auto-triggers (watch :8288 / Inngest Cloud) | |
| 6.3 | Connect repos past the FREE plan limit (1) | Blocked with an upgrade prompt, not an error dump | |
| 6.4 | Open a PR on the repo manually with branch `zenbuild/<featureRequestId>/<taskId>` or the `<!-- zenbuild fr=… task=… -->` body marker | PR appears in ZenBuild, linked to the feature/task, with real changed files + diff | |
| 6.5 | Disconnect the repo | Gone; its PRs no longer tracked | |

## Journey 7 — Coding agent (needs 6 + OpenAI)

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 7.1 | Board → task card menu → **Implement with AI** | Live progress; completion summary shows confidence/risk; a real PR opens on GitHub on branch `zenbuild/<fr>/<task>` | |
| 7.2 | The card afterwards | Shows a PR chip linking to the PR; task moved to In Review; feature → `IN_REVIEW` | |
| 7.3 | Re-run Implement on the same task | Idempotent: branch force-updated / existing PR reused — no duplicate PRs | |

## Journey 8 — AI review loop (needs 6/7)

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 8.1 | After the agent PR opens (or a manual linked PR) | Auto-review fires (see :8288); Review vN stored; summary + inline comments posted **on GitHub** | |
| 8.2 | Review content | Issues categorized Blocking/Non-blocking with explanations of *why* + suggested fixes — not lint nitpicks | |
| 8.3 | If blocking issues exist | Feature → `FIX_NEEDED`; FixNeededPanel lists them prominently | |
| 8.4 | Push a commit addressing a blocking issue | Auto **re-review** (v2) fires on the push; prior issues verified rather than re-flagged | |
| 8.5 | Converge to zero blocking issues | Feature exits to `IN_REVIEW` | |
| 8.6 | `/reviews` list + review detail + per-feature history timeline | Filters work; GitHub deep-links open the right comments | |
| 8.7 | Manual **Review now** on an already-reviewed SHA | Doesn't double-run wastefully / dedupes in-flight | |

## Journey 9 — Release & billing (Razorpay test keys for the paid parts)

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 9.1 | `/approvals` | Feature in `IN_REVIEW` listed as awaiting decision | |
| 9.2 | Release screen: gate checklist | Conditions (approved PRD, no blocking issues, state) accurately reflect reality | |
| 9.3 | Assess readiness on FREE plan | Gated as premium with an upgrade prompt | |
| 9.4 | **Reject** with a reason | State → `FIX_NEEDED`; decision + reason recorded | |
| 9.5 | Approve & ship (try with merge toggle on) | PR merges on GitHub (or graceful reason if blocked); state → `SHIPPED`; only owner/admin can | |
| 9.6 | Billing: upgrade to PRO via Razorpay test checkout | Checkout opens; test payment succeeds; plan flips; credits granted; webhook event visible in Razorpay dashboard → reconciles | |
| 9.7 | Burn credits down (reviews/implements) to zero | Trigger blocked with an upsell — never silently overspends; auto-review skips with out-of-credits | |
| 9.8 | Cancel subscription (cycle-end + immediate) | Status reflects; immediate → back to FREE limits | |
| 9.9 | Credit ledger | Every AI run debited the documented cost, exactly once (check after a retried/failed run too — failures must not charge) | |

## Journey 10 — Degraded modes & cross-cutting

| # | Step | Expect | ✅/❌ |
|---|------|--------|------|
| 10.1 | Stop the Inngest dev server → trigger Generate PRD | Run turns `FAILED` with "background job service is unreachable" — **no phantom stuck run** (Phase-1 fix) | |
| 10.2 | Unset `OPENAI_API_KEY` → restart → trigger an AI action | Clear failure surfaced in the run/UI, not a hang | |
| 10.3 | With GitHub env unset | Integrations page shows a not-configured notice; Implement/connect gated with `PRECONDITION_FAILED`-style messages, no 500s | |
| 10.4 | With Razorpay env unset | Billing shows unconfigured state; upgrades hidden | |
| 10.5 | Nonexistent URLs: `/feature-requests/garbage`, `/projects/garbage`, `/nope` | 404s — note they're currently **unbranded** (known, fixed in enhancement Phase 3) | |
| 10.6 | Phone width (~375px) | Note what's unusable — mobile nav is known-missing (Phase 3); log anything worse | |
| 10.7 | Every toast/error message you saw | No raw stack traces or `TRPCError` internals shown to users | |

---

## Findings log

Copy defects here (and mirror the important ones into enhancement.md Phase 2).

| # | Journey | Defect | Severity (blocker/major/minor) | Status |
|---|---------|--------|-------------------------------|--------|
| 1 | | | | |
