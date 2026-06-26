# FMS Backend — Cloudflare Workers API

Serverless REST API built with **Hono** on **Cloudflare Workers**, backed by **Supabase** (PostgreSQL + Auth). Local dev runs through `wrangler`.

## Prerequisites
- Node.js ≥ 20, npm ≥ 10
- A Supabase project (database + auth)
- A Cloudflare account (`wrangler` handles the rest; no separate runtime install)

## Setup

```bash
cd backend
npm install
```

### 1. Database
In the Supabase dashboard → **SQL Editor**, paste and run [`schema.sql`](./schema.sql). This creates all tables and constraints on a fresh project.

### 2. Local secrets
Wrangler reads local secrets from `.dev.vars` (the Workers equivalent of `.env`).

```bash
cp .dev.vars.example .dev.vars
```

Then open `.dev.vars` and fill in every value. At minimum you need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API). The other variables enable email, AI features, web push, and cron auth — see the comments in the file for where to obtain each.

Non-secret config (environment, allowed CORS origins, KV namespace id) lives in [`wrangler.toml`](./wrangler.toml). Create your own KV namespace and paste its id there:

```bash
npx wrangler kv namespace create FMS_CACHE
```

### 3. Run

```bash
npm run dev      # serves at http://127.0.0.1:8787
```

Health check: <http://127.0.0.1:8787/health> → `{ "status": "ok" }`

### 4. Seed sample data + test accounts
With `.dev.vars` filled in (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):

```bash
node scripts/seed.js
```

This creates a sample company, clients, a project template, and four login-able accounts (`superadmin@example.com`, `admin@example.com`, `controller@example.com`, `member@example.com` — password `Password123!`). The required dependencies (`@supabase/supabase-js`, `dotenv`) are already in `package.json`, so they install with `npm install`.

### 5b. Seed live workload data (instances, tasks & submissions)
For features that need live execution data (e.g. the Workload Management module), also run:

```bash
node scripts/seed-workload.js            # targets today (IST)
node scripts/seed-workload.js 2026-06-22 # or a specific working day
```

This creates a live instance plus a realistic spread of tasks and submissions for one working day: a team of worker members (copywriter / designer / reviewer / marketer), completed tasks (with actual vs estimated times), in-progress, pending-approval, locked, a rejected task with a reason, an overdue task, and manual tasks — producing overloaded / on-time / ahead / delayed members. Re-runnable (it cleans up its own previously-seeded rows). Open Workload Management as a Controller or Admin and view the seeded date.

## Project layout

```
src/
  index.js                 # Worker entry — registers routes, CORS, cron handlers
  config/                  # Supabase clients, Sentry init
  middleware/              # Global error handler
  modules/                 # One folder per domain: routes + controller + service
    auth/ users/ company/ projects/ tasks/ instances/ client/
    client-approvals/ holidays/ notifications/ performance/ reports/
    dashboard/ superadmin/ onboarding/ chat/ ai-* / push/ heartbeat/ sla-extension/
  workflow/                # Daily follow-up cron handler
migrations/                # Incremental SQL (already folded into schema.sql)
scripts/seed.js            # Sample-data seeder
```

## Deploy (optional)
```bash
npx wrangler login
# set production secrets: wrangler secret put SUPABASE_URL  (etc.)
npm run deploy
```
