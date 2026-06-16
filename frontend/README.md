# FMS Frontend — Next.js Dashboard

The FMS dashboard: **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, **Zustand**. It talks to the FMS backend over REST and uses **Supabase** for auth.

> The original marketing/landing site has been removed from this assignment base; the app opens straight at the login screen.

## Prerequisites
- Node.js ≥ 20, npm ≥ 10
- The **backend** running locally at `http://127.0.0.1:8787` (see `../backend/README.md`)
- The same Supabase project used by the backend

## Setup

```bash
cd frontend
npm install
cp .env.example .env      # then fill in your values
npm run dev               # serves at http://localhost:3000
```

Open <http://localhost:3000> — you'll be routed to `/login`. Use a seed account (e.g. `admin@example.com` / `Password123!`).

### Environment variables
All required keys are listed in [`.env.example`](./.env.example). The essentials:
- `NEXT_PUBLIC_API_URL` — backend base URL (include the `/api` suffix, e.g. `http://127.0.0.1:8787/api`)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Project Settings → API
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_CRON_SECRET` — must match the backend

Optional integrations (Sentry, Mixpanel, Clarity) are disabled when left blank.

> ⚠️ The backend dev server listens on `127.0.0.1`, not `localhost`. Use `127.0.0.1:8787` in `NEXT_PUBLIC_API_URL`.

## Project layout

```
src/
  app/                     # App Router routes
    login/ register/ forgot-password/ reset-password/
    auth/                  # OAuth callback + pending-approval pages
    dashboard/             # admin / controller / member / superadmin / chat / plans
    settings/  project-details/[id]/  landing/ (thin redirect to /login)
  components/              # ui/ (shadcn), auth/, dashboard widgets, shared-components/
  lib/                     # api.ts (axios), supabase.ts, zustand stores, hooks, types
  middleware.ts            # route guards (auth + role-based redirects)
```

## Scripts
```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build
npm start        # serve production build
npm run lint     # eslint
```
