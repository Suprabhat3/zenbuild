# ZenBuild — Frontend Redesign Plan (from scratch)

> **Status: implemented 2026-07-02 (Phases A–E complete; F code-side done, visual QA pending owner walkthrough).**
> Deviations from spec, all intent-preserving: landing classes were scoped
> under `.landing` instead of renamed to `.lp-*`; app/auth/legal styles stay
> unlayered (layering would flip specificity against Tailwind utilities);
> the global `/reviews` list survives as a direct-URL page instead of a
> `?view=reviews` redirect; review detail stays a focused sub-view page with
> its breadcrumb re-parented to the request workspace.
> Written 2026-07-02 after a full codebase inventory + breakage audit.
> Supersedes Phases 3.5–6 of [enhancement.md](enhancement.md). Phases 1–3 of that
> doc (stability fixes, loading/error/404 states) remain valid and landed.
> Optimized for: **solo builder, desktop-first** (mobile = usable, not primary).

---

## 1. Diagnosis — why the current UI fails QA

The frontend's data layer is healthy (typecheck clean, tRPC wiring correct, the
`lib/feature-request.ts` state machine covers all 12 statuses). The failure is
concentrated in three architectural problems:

| # | Problem | Effect in QA |
|---|---------|-------------|
| D1 | **Theme is gated on one wrapper div.** All warm-palette shadcn tokens live only on `.appx` ([app.css:31-57](../apps/web/src/styles/app.css)); `globals.css` defines a *different grayscale* token set on `:root`. Anything rendered outside `(app)/layout.tsx` — onboarding, 404s, any future page — silently renders in the wrong theme. | "Visually broken" — the product looks like two different apps depending on the route. |
| D2 | **Four stylesheets (~3,000 lines) all load globally**, scoped only by naming convention. `landing.css` exports generic global classes (`.btn`, `.display`, `.eyebrow`, `.tile`, `.plan`…) that leak onto every page. Fonts are triple-wired: the Tailwind `font-heading` utility is dead (resolved at build time to sans), and headings only get the serif via hand-written `font-family` rules. | Unpredictable styling; any new component is one `className="btn"` away from inheriting marketing styles. |
| D3 | **Half-migrated feature-request workspace.** A tab shell (Overview / Tasks / Reviews / Ship) was added, but the Overview page still renders the *entire* monolithic panel stack (Discovery, PRD editor, Planning, Review, Release). Every surface exists in two places at once. | "Confusing / functionally broken" — the same feature appears twice, pages are enormous, and the user can't tell where anything canonically lives. |

Plus structural UX debt: navigation is a flat list of 7 peers with no hierarchy
(Approvals duplicates the dashboard queue for a solo user), deep pages have no
breadcrumbs, and duplicate server fetches slow every feature-request page.

**Design consequence:** the redesign is not "make pages prettier." It is
(1) one global theme, (2) one navigation model with a clear hierarchy, and
(3) one canonical home for every feature — a **stage-driven workspace**.

---

## 2. What we keep (verified solid)

- **`apps/web/src/lib/feature-request.ts`** — status labels, badge variants,
  7 pipeline stages, per-status `NEXT_ACTION`. This is the product's spine and
  drives everything below, unchanged (one fix: terminal-status rendering, §5.3).
- **The warm-editorial token *values*** — cream/ink/rose/gold/sage palette,
  Instrument Serif + Schibsted Grotesk, radius/shadow scale. We keep the values,
  rebuild where they live.
- **Presentational components** — `PipelineStepper`, `FeatureRequestTabs`,
  `MobileNav`, `StatCard`, `PageHeader`, `EmptyState` are clean and accessible;
  they get re-homed onto the new CSS architecture, not rewritten.
- **Data discipline** — server-first pages, try/catch → `EmptyState`,
  `notFound()`, `initialData` hydration in client managers.
- **shadcn/base-ui primitives** in `components/ui/*`.

Everything else — the stylesheet structure, the navigation model, the page
compositions — is redesigned.

---

## 3. Design principles

1. **One question per screen.** Every page answers exactly one question
   ("what needs me?", "where is this request?", "what did the review find?").
   If a page answers two, split it.
2. **The pipeline is the product.** `FeatureRequestStatus` is the organizing
   spine. The user should always see *where a request is* and *what happens
   next* — and the next action is always the most prominent element on screen.
3. **Canonical home for every feature.** Each capability renders in exactly one
   place; everywhere else links to it. No duplicated panels, ever.
4. **The system prevents drift.** Theme correctness must not depend on wrapper
   divs or naming discipline. Global tokens, layered CSS, documented patterns —
   a new page built lazily should still look right.
5. **Desktop-first, mobile-usable.** Layouts are designed at 1440px, verified at
   1024px, and degrade gracefully to a single column with drawer nav at ≤768px.
   No feature is desktop-only, but density optimizes for desktop.

---

## 4. Information architecture

### 4.1 Navigation model — 5 primary items, not 7

For a solo builder, **Approvals** as a separate inbox is redundant (you approve
your own work — the dashboard queue already routes you) and **Reviews** as a
top-level peer overweights one pipeline stage. New sidebar:

```
ZenBuild                    ← wordmark → /dashboard
[Workspace switcher]

  Home                      /dashboard
  Requests                  /requests        ← renamed from /feature-requests
  Projects                  /projects
  ────────────
  Billing                   /billing
  Settings                  /settings
```

- **Approvals** → folded into Home as the "Needs your decision" queue (§5.1),
  and available as `/requests?attention=1` filter. The `/approvals` route
  becomes a redirect (kept so old links don't 404).
- **Reviews** (org-wide list) → moves to `/requests/[id]/reviews` (canonical)
  plus a "Recent reviews" module on Home. The global `/reviews` list survives
  as a redirect to `/requests?view=reviews` — a filterable activity view —
  because cross-request review browsing is a real (secondary) need.
- **Rename `feature-requests` → `requests`** everywhere (routes, nav, copy).
  Shorter, matches how the UI already talks ("New request"). Old paths 301 via
  `next.config` redirects.

### 4.2 URL hierarchy (final)

```
/                           marketing landing
/sign-in /sign-up /verify-email /accept-invite/[id]
/onboarding

/dashboard                  Home — action queue + pipeline overview
/requests                   list (filters: status, project, attention, search)
/requests/[id]              workspace shell → redirects to current stage tab
/requests/[id]/discovery    stage: clarification chat + intake payload
/requests/[id]/prd          stage: PRD editor/view + versions + approve
/requests/[id]/plan         stage: Kanban board + generate/approve plan
/requests/[id]/build        stage: coding agent runs + PRs
/requests/[id]/reviews      stage: review timeline + issues (+ /[reviewId] detail as a focused sub-view)
/requests/[id]/ship         stage: readiness + approve/reject decision
/projects                   grid
/projects/[id]              detail: repo, requests in project, edit
/billing
/settings  /settings/members  /settings/integrations  /settings/intake
```

**The key structural move:** the feature-request workspace stops being
"Overview page with everything + 3 satellite tabs" and becomes **one tab per
pipeline stage** — the stepper and the tab bar merge into a single navigation
element (§5.3). `/requests/[id]` has no content of its own; it redirects to the
tab for the request's *current* stage. Every stage surface has exactly one home.
D3 is eliminated by construction, not by slimming a page.

---

## 5. Page-by-page specification

### 5.1 Home (`/dashboard`) — "What needs me?"

Layout (desktop, two columns ~ 2fr/1fr):

```
┌─ PageHeader: "Home" · [+ New request] ────────────────────────────┐
├───────────────────────────────┬───────────────────────────────────┤
│ NEEDS YOUR DECISION           │ PIPELINE                          │
│ (gate queue, urgency-ordered) │ 7 stage rows w/ counts —          │
│ each row: title · stage badge │ each row links to filtered        │
│ · one CTA ("Approve PRD",     │ /requests?status=…                │
│ "Review & ship", "Fix issues")│                                   │
│ → deep-links to stage tab     ├───────────────────────────────────┤
├───────────────────────────────┤ IN FLIGHT                         │
│ RECENT ACTIVITY               │ live WorkflowRuns w/ progress %,  │
│ (audit log, last 10)          │ humanized type, link to request   │
└───────────────────────────────┴───────────────────────────────────┘
```

- Stat cards (4 across, top) stay but shrink to a single compact row; each is a
  link (already built).
- **"Needs your decision" is the absorbed Approvals inbox** — same grouping
  logic as the current `approvals/page.tsx` (ship decisions, approved-unshipped,
  fix-needed, plan gate, PRD gate) but rendered as one urgency-ordered queue
  with per-row CTAs instead of a separate page.
- Empty state (first run) teaches the loop: "Create a project → connect a repo
  → submit your first request" as three linked steps with completion checkmarks.

### 5.2 Requests list (`/requests`)

- Keep the current manager's server-side `?status=` / `?projectId=` filters,
  client search, `?new=1` create-dialog deep-link — all recently built and sound.
- Each row: title · **stage chip** (colored by pipeline stage, not raw status)
  · project · priority · updated-at · **next-action hint** (subdued text from
  `NEXT_ACTION`, e.g. "awaiting PRD approval").
- Row click → `/requests/[id]` (lands on current stage).
- Filter bar: stage chips (7, from `PIPELINE_STAGES`) + project select +
  "Needs attention" toggle + search. One line, not a filter panel.

### 5.3 Request workspace (`/requests/[id]/*`) — the centerpiece

**Shell** (`[id]/layout.tsx`, rebuilt):

```
┌ ← Requests / {Project name}                                      ┐
│ {Request title}                          [status badge] [priority]│
│                                                                    │
│ ●──────●──────●──────◉──────○──────○──────○                        │
│ Intake  Disc.  PRD   Plan   Build  Review Ship    ← stepper = nav │
│                                                                    │
│ ┌ NEXT ACTION banner (only when a human gate is open) ──────────┐ │
│ │ "The PRD is drafted — review and approve it."   [Approve PRD] │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ {stage surface — the active tab's content}                         │
└────────────────────────────────────────────────────────────────────┘
```

- **The stepper IS the tab bar.** Each stage node is a link to its stage route.
  Completed stages: filled, clickable (view artifacts read-only where the gate
  has passed). Current stage: highlighted. Future stages: dimmed but clickable,
  landing on an explanatory empty state ("Tasks are generated after the PRD is
  approved" + link back to the current gate). This replaces both the current
  `PipelineStepper` *and* `FeatureRequestTabs` — one element, one mental model.
- **Terminal statuses** (`REJECTED`, `DECLINED_DUPLICATE`): the stepper renders
  a neutral "Closed — {reason}" banner instead of a red ✗ on an arbitrary stage
  (fixes the current mis-rendering of duplicates as Discovery failures).
- **Stage surfaces** (each is the *only* home of its panels):
  - **Discovery** — clarification chat (`DiscoveryPanel`), intake payload in a
    collapsible, "Generate PRD" CTA when clarification resolves.
  - **PRD** — `PrdEditor`/`PrdView`, section regenerate, version history +
    restore (currently buried — gets a visible "Versions" affordance), approve
    button (role-gated), post-approval lock state.
  - **Plan** — the Kanban board moves here (`/board` route retired via
    redirect). Generate tasks, full card CRUD, approve-plan gate.
  - **Build** — new thin surface: coding-agent runs (`coding.taskStatus`),
    linked PRs with status, "Implement" triggers. Today this is smeared across
    the board and review panels; it gets its own home.
  - **Reviews** — `ReviewHistoryTimeline` + issue list; individual review
    detail renders in-context (master-detail on desktop) instead of jumping to
    the global `/reviews/[reviewId]` page.
  - **Ship** — readiness assessment (premium-gated), approve & ship / reject,
    release decision record.
- **Fix the duplicate fetches:** wrap `featureRequest.byId` in `React.cache`
  (per-request dedupe) so layout + page share one query.

### 5.4 Projects

- Grid + create/edit/delete dialogs: keep as recently built.
- Project detail becomes a **mini-dashboard**: repo connection card, request
  list filtered to the project (reusing the list component), "New request"
  pre-filled with the project.

### 5.5 Billing, Settings

- Keep the recently-themed managers; migrate onto the global token system and
  shared `PageHeader`/section-card patterns (mechanical once Phase A lands).
- Settings sub-nav stays as underline tabs (General / Members / Integrations /
  Intake).

### 5.6 Onboarding, auth, marketing

- Unchanged in structure, but they inherit the **global** theme after Phase A —
  which fixes the current mis-theming of onboarding/404s for free.

---

## 6. CSS & theming architecture (the drift-proofing)

Replace the 4-global-stylesheet system with **one token source + layered,
namespaced surface styles**:

1. **Tokens to `:root`** in `globals.css`: the `--zb-*` warm palette and the
   full shadcn token bridge move from `.appx` to `:root`. Delete the grayscale
   oklch defaults and the dead `.dark` block. The `.appx`/`.authx` wrappers are
   deleted — the theme is simply *the* theme, everywhere (D1 fixed).
2. **One font mapping.** Drop Geist entirely. `--font-body` (Schibsted
   Grotesk) and `--font-display` (Instrument Serif) wired through Tailwind
   `@theme` so `font-heading`/`font-sans` utilities actually work; remove the
   hand-written `font-family` workarounds as components migrate.
3. **Layered structure** via CSS `@layer tokens, base, components, surfaces`:
   - `tokens` — custom properties only.
   - `base` — element defaults, typography scale.
   - `components` — the shared `.app-*` component classes (kept — they're
     good), audited for the dead rules (`ring: none` etc.).
   - `surfaces` — landing/auth/legal styles, **renamespaced** (`.landing .btn`
     → `.lp-btn`, `.tile` → `.lp-tile`, …) so nothing generic is global (D2
     fixed). Marketing pages keep their look; they just can't leak.
4. **Budget:** total CSS should shrink (dead dark block, Geist, duplicate token
   sets, workaround rules removed). Target ≤ 2,400 lines across all files.
5. **Document it**: a short `apps/web/src/styles/README.md` — where tokens
   live, when to write a `.app-*` class vs Tailwind utilities, the namespace
   rules. (Fulfills enhancement.md Phase 4's intent.)

---

## 7. Interaction & state conventions (applied everywhere)

- **Every mutation**: pending state on the trigger (spinner-in-button, never a
  frozen UI) → success/error toast → optimistic update where safe (board
  already does this).
- **Every route**: themed `loading.tsx` skeleton (exists — verify coverage per
  new routes), `error.tsx` with retry, branded 404.
- **Every list**: a designed empty state that says what the thing is and offers
  the first action — never bare "No items."
- **Every async workflow** (`WorkflowRun`): visible progress (the in-flight
  module on Home; inline progress on the owning stage surface) and a clear
  failure state with retry, so "the AI is working" is never a blank screen.
- **Degraded modes**: every integration-gated surface (GitHub, Razorpay,
  Resend, OpenAI unconfigured) shows an instructive notice, never a 500 —
  re-verified in the final QA pass.
- **Keyboard/a11y**: focus-visible everywhere, `aria-current` on nav,
  icon-only buttons labeled, dialogs trap focus (base-ui handles most; audit).

---

## 8. Implementation phases

Ordered so the app is never *more* broken mid-migration; each phase ends green
(`pnpm -r typecheck` + `pnpm --filter web build`) and navigable.

| Phase | Scope | Key files | Exit criterion |
|-------|-------|-----------|----------------|
| **A. Theme foundation** | Tokens to `:root`, delete `.appx`/grayscale/`.dark`/Geist, `@layer` restructure, renamespace landing/auth/legal classes, styles README | `globals.css`, `styles/*`, root + `(app)` layouts, landing/auth components (class renames) | Every route — including onboarding & 404s — renders the warm theme; no generic global classnames remain; build green |
| **B. Navigation & shell** | 5-item sidebar, `feature-requests→requests` rename + redirects, `/approvals`→Home fold + redirect, breadcrumbs, mobile drawer re-check | `nav-config.ts`, `(app)/layout.tsx`, `next.config` redirects, route folder rename | All old URLs redirect; nav has 5 items; every deep page shows a breadcrumb |
| **C. Request workspace** | Stage-route structure (`discovery/prd/plan/build/reviews/ship`), stepper-as-nav component, `/requests/[id]` current-stage redirect, slim each stage to its own surface, Build surface (new), terminal-status treatment, `React.cache` dedupe | `requests/[id]/**`, `pipeline-stepper.tsx` (rebuilt), panel components (re-homed, not rewritten) | No panel renders in two places; landing on a request always shows the current stage + next action; duplicate fetches gone |
| **D. Home** | Absorb approvals queue, two-column layout, pipeline module, in-flight module, first-run teaching empty state | `dashboard/page.tsx`, `approvals/*` (redirect), new queue component | Solo user can reach any open gate in 1 click from Home |
| **E. Secondary surfaces** | Projects mini-dashboard, requests-list stage chips + attention filter, Billing/Settings onto shared patterns, review detail in-context | `projects/[id]`, `feature-requests-manager` → `requests-manager`, `billing-manager`, `settings/**`, `reviews/*` | Side-by-side, every page reads as one product |
| **F. Conventions & QA** | §7 sweep (mutations, empty states, degraded modes, a11y), 1440/1024/768/375 px pass, microcopy pass, walk all 10 QA journeys from [qa-walkthrough.md](qa-walkthrough.md) | app-wide | Full QA walkthrough passes; first-time user goes request → shipped without docs |

Suggested review checkpoints: after **A** (theme everywhere — biggest visual
delta), after **C** (the centerpiece), and after **F** (final QA).

---

## 9. Explicitly out of scope

Unchanged from enhancement.md's hardening backlog: CI, Sentry, rate limiting,
tests, pagination, ESLint. Also out: dark mode (single light theme is a locked
decision), marketing-page redesign (only re-namespacing), and any backend/API
changes beyond adding route redirects and the `React.cache` dedupe.
