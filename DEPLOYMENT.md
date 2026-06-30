# ZenBuild — Deployment runbook

A step-by-step guide for deploying ZenBuild to production:
**Vercel** (web + route handlers) · **Neon** (Postgres) · **Inngest Cloud**
(async) · **GitHub App** (prod) · **Razorpay** (test mode).

Work top to bottom. Anything marked **(blocker)** must be done or the build/app
fails; everything else degrades gracefully if skipped.

---

## 0. Prerequisites

- The GitHub repo is **public** and pushed (mandatory deliverable). ✅
- Accounts: [Vercel](https://vercel.com), [Neon](https://neon.tech),
  [Inngest](https://www.inngest.com), [OpenAI](https://platform.openai.com),
  a GitHub account (for the App), and a [Razorpay](https://razorpay.com) test
  account.
- Decide your production URL up front (e.g. `https://zenbuild.vercel.app` or a
  custom domain). It's referenced as `{APP_URL}` throughout.

---

## 1. Database — Neon  **(blocker)**

1. Create a Neon project; copy the **pooled** connection string.
2. Set it as `DATABASE_URL` (must include `?sslmode=require`).
3. Apply migrations from your machine (or a CI step) against the prod DB:
   ```bash
   DATABASE_URL="postgres://…neon…" pnpm --filter @zenbuild/db db:migrate:deploy
   ```
4. (Optional) seed a demo org: `pnpm --filter @zenbuild/db db:seed`.

> **Prisma client generation is handled automatically.** The generated client is
> *not* committed (it's gitignored); `packages/db` has a `postinstall: prisma
> generate`, so Vercel's `pnpm install` regenerates it on every build. Nothing to
> do here — just don't remove that postinstall.

---

## 2. Web app — Vercel  **(blocker)**

This is a **pnpm + Turborepo monorepo**. Recommended Vercel project settings:

| Setting | Value |
|---------|-------|
| **Framework preset** | Next.js |
| **Root Directory** | `apps/web` (enable "Include files outside root directory" / monorepo) |
| **Install Command** | leave default (`pnpm install`) — Vercel detects the workspace and installs at the repo root |
| **Build Command** | leave default (`next build`) |
| **Output Directory** | leave default (`.next`) |
| **Node version** | 20.x or later |

Vercel auto-detects `pnpm-workspace.yaml` and `pnpm-lock.yaml`. The
`postinstall` in `packages/db` runs during install and generates the Prisma
client; the web app consumes the other workspace packages directly as source, so
no extra build wiring is needed. (Verified locally with
`pnpm install --frozen-lockfile` + `pnpm --filter web build`.)

### Environment variables (Vercel → Project → Settings → Environment Variables)

Set for **Production** (and Preview if you want PR previews). Mirror
[`.env.example`](.env.example).

**Required (blocker):**
- `DATABASE_URL`
- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`
- `BETTER_AUTH_URL` = `{APP_URL}`
- `NEXT_PUBLIC_APP_URL` = `{APP_URL}`

**AI (required for the AI features):**
- `OPENAI_API_KEY`

**Async (Inngest Cloud — see §3):**
- `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`

**GitHub App (see §4):**
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_WEBHOOK_SECRET`

**OAuth login (optional):**
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Email (optional — console fallback if unset):**
- `RESEND_API_KEY`, `EMAIL_FROM`

**Billing (see §5):**
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_ID_PRO`, `RAZORPAY_PLAN_ID_TEAM`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` (= `RAZORPAY_KEY_ID`)

**Observability (optional):**
- `SENTRY_DSN`

> Tip: `GITHUB_APP_PRIVATE_KEY` is a multi-line PEM. Paste it with newlines as
> literal `\n`, or paste the raw PEM into Vercel's multi-line value box.

Deploy. The first build will run `pnpm install` (→ Prisma generate) then
`next build`.

---

## 3. Async — Inngest Cloud

1. Create an Inngest app; from **Manage → Keys** copy the **Event Key** and
   **Signing Key** → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` in Vercel.
2. Register the serve endpoint: **`{APP_URL}/api/inngest`** (Inngest → Apps →
   Sync). Inngest will discover all functions in `packages/jobs`.
3. Redeploy after setting the keys so the serve handler is signed.

---

## 4. GitHub App (production)

Create a GitHub App (Settings → Developer settings → GitHub Apps → New):

- **Homepage URL:** `{APP_URL}`
- **Webhook URL:** `{APP_URL}/api/github/webhook`
- **Webhook secret:** a random string → `GITHUB_WEBHOOK_SECRET`
- **Callback URL** (for the install flow): `{APP_URL}/api/github/callback`
- **Permissions (least privilege):**
  - Repository → **Contents**: Read & write (coding agent branches/commits)
  - Repository → **Pull requests**: Read & write
  - Repository → **Metadata**: Read-only
- **Subscribe to events:** `pull_request`, `pull_request_review`, `push`,
  `installation`
- Generate a **private key** (PEM) → `GITHUB_APP_PRIVATE_KEY`
- Note the **App ID** → `GITHUB_APP_ID` and the **app slug** (from its public
  page URL) → `GITHUB_APP_SLUG`

Set those four env vars in Vercel and redeploy. In-app, an org owner/admin then
installs the App from **Settings → Integrations**.

> "Sign in with GitHub" (OAuth) is a **separate** credential pair
> (`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`) from a GitHub OAuth App, with
> callback `{APP_URL}/api/auth/callback/github`. Optional.

---

## 5. Billing — Razorpay (test mode)

1. In the Razorpay dashboard (test mode): **Settings → API Keys** → generate
   test keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (and
   `NEXT_PUBLIC_RAZORPAY_KEY_ID` = the key id).
2. **Subscriptions → Plans** → create one plan per paid tier and copy their ids
   → `RAZORPAY_PLAN_ID_PRO`, `RAZORPAY_PLAN_ID_TEAM`. (Prices: Pro ₹999/mo,
   Team ₹2,499/mo — see `packages/billing/src/plans.ts`.)
3. **Settings → Webhooks** → add `{APP_URL}/api/razorpay/webhook`, set a secret
   → `RAZORPAY_WEBHOOK_SECRET`, and subscribe to the **`subscription.*`** events.
4. Redeploy. Leaving these blank keeps the app on the Free plan only (the billing
   UI shows an "unconfigured" state).

---

## 6. OAuth & email (if used)

- **Google:** add authorized redirect URI `{APP_URL}/api/auth/callback/google`.
- **Resend:** verify your sending domain and set `EMAIL_FROM` to a verified
  sender; otherwise emails log to the server console.

---

## 7. Post-deploy smoke test

Walk the core loop on the live URL:

1. Sign up → verify email (OTP) → onboarding (pick account type + plan).
2. Create a project; connect a GitHub repo (install the App).
3. Create a feature request → clarify → generate PRD → edit → **approve**.
4. Generate tasks → **approve plan** → implement a task (coding agent opens a PR).
5. Confirm the **AI review** posts to GitHub and shows in ZenBuild; push a fix →
   auto re-review.
6. Open the **release** screen → AI readiness verdict → **approve & ship**.
7. (If billing configured) upgrade via Razorpay Checkout and confirm the webhook
   updates the subscription.

---

## 8. Final deliverables checklist

- [x] Public GitHub repo (pushed)
- [ ] Live deployed URL — add it to [`README.md`](README.md)
- [ ] Demo video of the full core loop — add the link to `README.md`
- [x] Complete README (overview, stack, architecture, setup, env, schema,
      GitHub setup, Inngest workflows, AI features)
- [ ] Production env vars + webhook URLs configured (this runbook)
