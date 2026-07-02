# ZenBuild — Enhancement Plan (MVP → Industry-Ready)

> Tracks the post-MVP effort to make ZenBuild feel like a polished, trustworthy product.
> Grounded in two full codebase audits (UI consistency + reliability) run on 2026-07-02.
> Keep the status tables in sync as work lands — same convention as
> [implementation-plan.md](implementation-plan.md).

## Decisions locked

| Area | Decision |
|------|----------|
| **Visual direction** | Extend the existing **warm editorial** theme (`--zb-*` palette, Instrument Serif display + Schibsted Grotesk body) to *every* surface. No default-shadcn look anywhere. |
| **Order of work** | **Broken features first**, then the UX overhaul. A beautiful broken app is still broken. |
| **Dark mode** | **Single light theme.** Remove the dead `.dark` token block and the theme-mismatch risk it creates (toasts). |
| **Hardening scope** | This effort covers usability, polish, and functional fixes. Tests / Sentry / rate limiting / CI are tracked in the [Hardening backlog](#hardening-backlog-deferred) below but **not scheduled** here. Exception: fixes required for features to *work reliably* (e.g. stranded workflow runs) are in scope. |

## Progress tracker

| Phase | Title | Status |
|-------|-------|--------|
| 1 | Stabilize: fix what's broken | ✅ Done |
| 2 | Full core-loop QA walkthrough | 🚧 In progress |
| 3 | Structural UX: loading, error, 404, mobile nav | ✅ Done |
| 3.5 | **Navigation redesign: pipeline-first UX** (owner request, 2026-07-02) | 🚧 In progress |

### Phase 2 QA findings (fixed as found)

| # | Finding | Root cause | Fix |
|---|---------|-----------|-----|
| 2.1 | Every page except Dashboard returned **HTTP 500** for a fresh session ("sections do not load", perceived as 404s) | Sessions created before onboarding carry `activeOrganizationId: null`; `orgProcedure` threw FORBIDDEN on every org-scoped call, and only Dashboard swallowed it | `orgProcedure` now falls back to the user's first membership when the session pointer is null/stale (`packages/api/src/trpc.ts`) — same rule as the session-create hook and app shell |
| 2.2 | Errors/unknown URLs showed the unbranded default Next.js pages | No `not-found.tsx` / `error.tsx` / `global-error.tsx` / `loading.tsx` existed anywhere | Added branded global + `(app)`-segment 404 and error pages, `global-error.tsx`, and an `(app)/loading.tsx` skeleton |
| 2.3 | GitHub OAuth sign-in failed with "State mismatch: State not persisted correctly" | State row exists in DB unconsumed — the browser returned to the callback without the state cookie because the flow started on a different host (LAN IP / deployed site) than `BETTER_AUTH_URL` | Operational: always start sign-in from `http://localhost:3000` exactly; register the localhost callback URL on the GitHub App (see below) |
| 2.4 | `.env` misconfigured: uncommented comment line, raw multi-line PEM (only first line loaded), empty `GITHUB_WEBHOOK_SECRET` | dotenv can't parse unquoted multi-line values | Fixed in place: commented the line, PEM as single line with `\n` escapes, generated a webhook secret (must be mirrored in GitHub App settings) |
| 4 | Design-system consolidation | ⬜ Not started |
| 5 | Theme the neglected surfaces (Settings, Billing, Reviews) | ⬜ Not started |
| 6 | Flow & polish pass | ⬜ Not started |

> Legend: ✅ Done · 🚧 In progress · ⬜ Not started

---

## Audit summary (what we found)

**UI (apps/web).** The warm-editorial theme is well-executed on landing, auth,
onboarding, dashboard, projects, the feature-request flow, the Kanban board, and
legal pages. The inconsistency is concentrated in **Settings (all four sub-pages),
Billing, and Reviews**, which are raw shadcn and inherit warm colors only through
the token bridge — same palette, none of the editorial typography/cards/spacing.
Structural gaps: no `loading.tsx` anywhere (route transitions block with zero
feedback), no `error.tsx`/`not-found.tsx` (failures land on Next's unstyled
defaults), and **no mobile navigation** (the sidebar is `display:none` under
768 px with no hamburger replacement).

**Reliability (packages/).** Domain code is clean: strict TS, timing-safe webhook
signature verification (GitHub, Razorpay, intake), consistent org-scoping via
`orgProcedure`. Gaps are operational: zero tests/CI, Sentry declared in env but
never initialized, production tRPC errors logged nowhere, no rate limiting,
workflow runs can strand in `QUEUED` forever if the Inngest send fails, and most
list endpoints are unpaginated.

---

# Phase 1 — Stabilize: fix what's broken

**Goal:** every known-broken thing found by the audits is fixed. These are
confirmed defects, not suspicions.

| # | Fix | Evidence | Status |
|---|-----|----------|--------|
| 1.1 | **Dead "Approvals" nav link** — sidebar linked to `/approvals`, which didn't exist → unstyled 404. Built a real approvals queue: features `IN_REVIEW` (awaiting decision) and `APPROVED` (not yet shipped), each linking to its release screen. | `apps/web/src/app/(app)/approvals/page.tsx` (new) | ✅ |
| 1.2 | **Removed leftover `/status` debug page** — Phase-1 smoke-test page, off-theme, publicly routable. | `apps/web/src/app/status/page.tsx` (deleted) | ✅ |
| 1.3 | **Dashboard swallowed errors as "Loading your workspace…"** — now renders a themed error state (`EmptyState`) with a retry link. | `apps/web/src/app/(app)/dashboard/page.tsx` | ✅ |
| 1.4 | **Stranded workflow runs** — all five run-creating triggers (discovery/PRD/tasks, coding ×2, release readiness, PR review) now send via `sendWorkflowEvent`, which marks the run `FAILED` if the Inngest send throws. New `workflow-reconcile` cron (every 15 min) fails runs stuck `QUEUED` >15 min or `RUNNING` >60 min. `github.connect` follow-ups (backfill + analyze) are now best-effort so a queue failure can't fail an already-committed connect. | `packages/jobs/src/sendRunEvent.ts`, `packages/jobs/src/functions/workflowReconcile.ts` (new); `packages/api/src/lib/{discovery,coding,release}.ts`, `packages/jobs/src/triggerReview.ts`, `packages/api/src/routers/github.ts` | ✅ |
| 1.5 | **Toast theme mismatch** — `Toaster` resolved `useTheme()` to `"system"` with no provider, so toasts could render dark on an always-light app. Pinned to `light`; removed the dead `.dark` token block (kept the class-based `@custom-variant` so `dark:` utilities stay inert). | `apps/web/src/components/ui/sonner.tsx`, `apps/web/src/app/globals.css` | ✅ |
| 1.6 | ~~False rate-limit claim in shipped copy~~ — **invalid (audit false positive)**: the "3 per hour" line is fictional demo content inside the landing page's sample PRD mock, and the terms mention is standard don't-circumvent language. No product claim is made. Real rate limiting remains in the hardening backlog. | `apps/web/src/components/landing/Product.tsx:53` | ✅ N/A |
| 1.7 | **Razorpay orphan-subscription window** — `createSubscription` now verifies the local subscription row exists *before* creating the remote subscription, wraps the Razorpay call with a friendly `BAD_GATEWAY` error, and best-effort-cancels the remote subscription if persisting `razorpaySubId` fails. | `packages/api/src/routers/billing.ts` | ✅ |
| 1.8 | **Stale nav comment** claiming routes are placeholders. | `apps/web/src/components/app/nav-config.ts` | ✅ |

**Done when:** every row above is ✅ and `pnpm -r typecheck` + `pnpm --filter web build` are green.

---

# Phase 2 — Full core-loop QA walkthrough

**Goal:** exercise the entire product end-to-end as a real user and log every
defect found. The owner reports "some features break if we test it fully" — this
phase finds them all.

**Method:** run the app locally (web + Inngest dev server, live keys) and walk
each journey below, recording defects in a findings table appended to this phase.
Fix as we go for small issues; batch larger ones.

> **The detailed step-by-step script lives in [qa-walkthrough.md](qa-walkthrough.md)**
> (10 journeys, ~70 checks, expected results, Inngest primer, findings log).

**Journeys to walk:**

1. **Auth & onboarding**: sign-up → OTP verify → onboarding (individual + org paths, each plan) → sign-in, sign-out, unverified-email re-send, terms consent, OAuth buttons (configured/unconfigured states).
2. **Workspace**: create org, switch org, invite member (email delivery + accept-invite flow), role changes, remove member, last-owner protection.
3. **Intake → Discovery**: create request via form *and* via signed `POST /api/intake`; clarification chat (ASK / EDUCATE / PROCEED branches); answer questions; PRD generation with live progress.
4. **PRD editor**: edit every section type, regenerate a section with instruction, preview, save version, version history + restore, approve (role-gated), post-approval lock.
5. **Planning**: task generation, Kanban drag-and-drop (mouse + keyboard), card menu actions, create/edit/delete/assign, approve plan.
6. **GitHub**: app install flow, connect/disconnect repo, repo limit enforcement, PR ingestion from a real push, coding-agent Implement flow end-to-end.
7. **Review loop**: auto review on PR open/sync, manual "Review now", blocking → `FIX_NEEDED`, push fix → auto re-review → converge; review history timeline + GitHub links.
8. **Release**: readiness assessment (premium gating on Free), approve & ship (with/without merge), reject with reason.
9. **Billing**: upgrade via Razorpay test checkout, webhook reconciliation, credit gating when exhausted (upsell surfaces correctly), cancel, downgrade behavior.
10. **Degraded modes**: each optional service unconfigured (GitHub, Razorpay, Resend, OpenAI) — every gated surface shows a helpful notice, nothing 500s.

**Findings log:** *(append rows as discovered)*

| # | Area | Defect | Severity | Status |
|---|------|--------|----------|--------|
| — | — | *(none logged yet)* | — | — |

**Done when:** all journeys pass clean or every logged defect is fixed/triaged.

---

# Phase 3 — Structural UX: loading, error, 404, mobile nav

**Goal:** the app never shows an unbranded or blank screen, on any device.

1. **Route-level loading states**: `loading.tsx` with themed skeletons for every
   route group (dashboard, projects, feature-requests + subpages, reviews,
   billing, settings). Every page is `force-dynamic` and awaits tRPC server-side,
   so today navigation blocks with *nothing* — this is the single biggest felt-UX win.
2. **Error boundaries**: root `error.tsx` + `global-error.tsx` in the warm theme
   with a retry action; per-section boundaries where a panel can fail
   independently (feature-request detail's seven panels).
3. **Branded `not-found.tsx`**: app-shell-aware 404 for the authed segment plus a
   public one; detail pages already call `notFound()` — they just land on Next's
   default today.
4. **Mobile navigation**: hamburger → slide-over drawer with the full sidebar nav
   + org switcher under 768 px. Audit every page at 375 px and fix overflow.
5. **Toast + async feedback conventions**: every mutation gets pending/success/
   error feedback; no silent failures.

**Done when:** throttled navigation always shows a skeleton; forced errors and bad
URLs render branded screens; the full app is navigable on a phone.

---

# Phase 3.5 — Navigation redesign: pipeline-first UX

**Goal (owner request, 2026-07-02):** redesign the frontend around what the
backend can actually do — the delivery pipeline — instead of a collection of
disconnected pages. "User can easily do the things, easy access to the primary
things."

**The organizing idea:** `FeatureRequest.status` is the spine of the product
(Intake → Discovery → PRD → Plan → Build → Review → Ship, with three human
gates). Every status now maps to a **stage** and a single **next action**
(`apps/web/src/lib/feature-request.ts`: `PIPELINE_STAGES`, `STATUS_STAGE_INDEX`,
`NEXT_ACTION`) — and that one model drives the stepper, the dashboard queue,
and the approvals inbox.

| # | Change | Files |
|---|--------|-------|
| 3.5.1 | **Feature-request workspace**: shared layout with persistent header + **pipeline stepper** (7 stages, next-action CTA banner) + tab bar (Overview · Tasks · Reviews · Ship) across all four surfaces; sub-pages stripped of duplicated headers; raw intake-payload JSON demoted to a collapsible | `feature-requests/[id]/layout.tsx` (new), `pipeline-stepper.tsx`, `feature-request-tabs.tsx` (new); `[id]/{page,board,reviews,release}/page.tsx` |
| 3.5.2 | **Actionable dashboard**: "Needs your attention" queue (requests blocked on a human, urgency-ordered, deep-links to the right stage), clickable stat cards, pipeline chips filter the request list, in-flight runs link to their request, run types humanized | `dashboard/page.tsx`, `stat-card.tsx` (href prop) |
| 3.5.3 | **Approvals = decision inbox**: one group per human gate (ship decisions, approved-unshipped, blocked on fixes, plan sign-off, PRD sign-off), each row deep-links to its decision surface | `approvals/page.tsx` |
| 3.5.4 | **Mobile navigation**: hamburger → slide-over drawer with full primary nav (there was previously *no* nav below 768 px) | `mobile-nav.tsx` (new), `(app)/layout.tsx`, `app.css` |
| 3.5.5 | **Request list filters**: `?status=` / `?projectId=` server-side filters, status chips, project select, client search, `?new=1` deep-link opens the create dialog (used by dashboard/projects CTAs) | `feature-requests/page.tsx`, `feature-requests-manager.tsx` |
| 3.5.6 | **Projects**: edit dialog (first UI for `project.update`), dialog-based delete confirm (was native `confirm()`), "New feature request" CTA on project detail | `projects-manager.tsx`, `projects/[id]/page.tsx` |
| 3.5.7 | **Editorial theming for neglected surfaces** (pulled forward from Phase 5): Settings ×4, Billing (serif plan cards, usage meters, ledger EmptyState), Reviews list + detail | `settings/**`, `billing-manager.tsx`, `reviews-manager.tsx`, `reviews/[reviewId]/page.tsx` |

**Done when:** a first-time user can land on the dashboard and reach any stage
of any request in ≤2 clicks, always knowing what to do next; full nav works on
mobile; typecheck + build green.

---

# Phase 4 — Design-system consolidation

**Goal:** one theme system, one set of composition patterns — so Phase 5 is
mechanical and future pages can't drift.

1. **Promote the `.appx` token bridge to the real theme**: today the warm palette
   only exists scoped inside `.appx`/`.authx`/`.landing`/`.legal` overrides on top
   of stock shadcn grays in `globals.css`. Restructure so `--zb-*` tokens are the
   single source of truth feeding shadcn tokens globally; drop the dead `.dark`
   block; reconcile the four stylesheets (2,782 lines) into a layered structure
   (tokens → base → per-surface).
2. **Font cleanup**: Geist is loaded but the themed surfaces use Instrument Serif +
   Schibsted Grotesk — drop the unused weight/family cost.
3. **Canonical composition components**, replacing today's duplicated idioms:
   - `PageHeader` used everywhere (6+ pages hand-roll their own header today).
   - One `EmptyState` convention (today: shared component vs inline `<p>` vs ad-hoc `<Card>`).
   - Themed table, section-card, and settings-row patterns for the Phase-5 surfaces.
   - Breadcrumbs component for deep pages (board, release, reviews, review detail).
4. **Document the system**: short `apps/web/README` section — tokens, when to use
   which pattern, do/don't.

**Done when:** a new page built only from documented patterns is
indistinguishable in polish from the feature-request detail page.

---

# Phase 5 — Theme the neglected surfaces

**Goal:** the surfaces the audits flagged as raw shadcn get the full editorial
treatment, using the Phase-4 patterns.

| Surface | Components | Status |
|---------|-----------|--------|
| Settings → General | `general-settings-form` | ✅ (Phase 3.5) |
| Settings → Members | `members-manager` (table, invite dialog, role menus) | ✅ (Phase 3.5) |
| Settings → Integrations | `github-integration-card`, `repo-connect-card` | ✅ (Phase 3.5) |
| Settings → Intake | `intake-key-card` | ✅ (Phase 3.5) |
| Billing | `billing-manager` (plan cards, usage meters, ledger table, checkout dialogs) | ✅ (Phase 3.5) |
| Reviews list | `reviews-manager` (filters, feed, shared `EmptyState`) | ✅ (Phase 3.5) |
| Review detail | `reviews/[reviewId]` issue list | ✅ (Phase 3.5) |
| Review history | `review-history-timeline` | ⬜ |

**Done when:** no authed page reads as "default shadcn"; side-by-side with the
dashboard, every surface looks like the same product.

---

# Phase 6 — Flow & polish pass

**Goal:** the product *guides* the user through the core loop instead of assuming
they know it.

1. **Pipeline orientation**: a persistent stepper on the feature-request detail
   page showing where the request is in
   `Request → PRD → Tasks → Code → Review → Approval → Ship`, with the current
   stage's next action surfaced as the primary CTA.
2. **First-run experience**: empty dashboard/projects states that teach the loop
   and deep-link to the first action (create project → create request → start
   discovery), instead of bare "nothing here yet" text.
3. **Microcopy pass**: button labels, empty states, error messages, confirmation
   dialogs — consistent voice, no developer-speak leaking to users.
4. **Accessibility pass**: `aria-label` coverage on icon-only buttons (org
   switcher, member row menus), skip-link, focus-visible audit, landmark roles,
   keyboard walk of every dialog and menu.
5. **Perceived performance**: optimistic updates where safe (board already has
   them), prefetch on sidebar hover, and pagination for the unbounded lists that
   will get slow (feature requests, reviews) — the UX half of the backlog item.
6. **Final sweep**: 375 px / 768 px / 1440 px pass on every page; favicon/OG
   metadata; landing copy accuracy vs. actual product.

**Done when:** a first-time user can go request → shipped without reading docs,
on any screen size.

---

## Hardening backlog (deferred)

Explicitly **out of scope** for this effort (owner decision, 2026-07-02) but
tracked so it isn't lost. Ordered by leverage:

1. **CI** — `.github/workflows` running typecheck + build on every PR (lint
   scripts are currently stubs: `echo "(eslint to be configured)"`).
2. **Sentry** — `SENTRY_DSN` exists in env but is never initialized; production
   tRPC `onError` only logs in development, so server errors vanish. Wire tRPC,
   webhook handlers, and Inngest `markFailed` to report unconditionally.
3. **Rate limiting** — none anywhere; priority on unauthenticated `/api/intake`
   (token enumeration is unthrottled) and auth routes. Then restore the honest
   version of the landing/terms claim (see 1.6).
4. **Test suite** — Vitest at the highest-leverage seams that already exist
   (signature verification, `WorkflowRun` state helpers, `orgProcedure`
   isolation, billing credit accounting), then Playwright E2E for the core loop.
5. **Pagination/back-pressure** — cursor pagination for `featureRequest.list`,
   `review.list` + history aggregations, `project.list`, `member.list`, GitHub
   repo lists (the `take` pattern already exists in `dashboard` and
   `billing.ledger`).
6. **ESLint for real** — replace the stub lint scripts with a shared flat config.
7. **`SKIP_ENV_VALIDATION` footgun** — bypasses *all* env validation when set;
   scope it to build-time only.
8. **Brittle cast** — `packages/github/src/client.ts:120` raw-diff
   `as unknown as string`; add a runtime type guard.
