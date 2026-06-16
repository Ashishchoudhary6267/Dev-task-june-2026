# FMS — Flow Management System (Developer Assignment)

A dynamic **workflow execution and task management system**. Work flows through customizable, template-defined steps. Each step can enforce checklists, required roles (e.g. Copywriter, Designer, Reviewer), and up to five sequential approval levels before the next task unlocks. The system tracks SLA / turnaround time against a working-hours calendar.

This repository is a **self-contained base project** for a coding assignment. It contains a backend API and a frontend dashboard. **All credentials and keys have been intentionally removed** — part of the task is to identify what configuration is required and supply your own (see [`TASK.md`](./TASK.md)).

---

## Repository structure

```
FMS-Assignment/
├── backend/      # Cloudflare Workers + Hono REST API (JavaScript, ESM)
│   ├── src/                 # Feature modules (auth, tasks, projects, instances, ...)
│   ├── schema.sql           # Full PostgreSQL schema — run once on a fresh Supabase project
│   ├── scripts/seed.js      # Seeds sample data + login-able accounts
│   ├── wrangler.toml        # Worker config (non-secret vars)
│   └── .dev.vars.example    # Template for local secrets → copy to .dev.vars
│
├── frontend/     # Next.js 16 (App Router) + React 19 + TypeScript dashboard
│   ├── src/app/             # Routes (login, dashboard/*, settings, ...)
│   ├── src/components/      # UI + feature components
│   └── .env.example         # Template for frontend env → copy to .env
│
├── README.md     # (this file)
└── TASK.md       # The assignment brief
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Zustand |
| Backend | Cloudflare Workers, Hono.js, JavaScript (ESM) |
| Database / Auth | Supabase (PostgreSQL + Supabase Auth) |
| Caching | Cloudflare KV |

---

## Prerequisites

- Node.js ≥ 20 LTS and npm ≥ 10
- A free [Supabase](https://supabase.com) project (for database + auth)
- A free [Cloudflare](https://cloudflare.com) account (for `wrangler`, the Workers CLI)

## Setup (high level)

> Full step-by-step instructions are in [`backend/README.md`](./backend/README.md) and [`frontend/README.md`](./frontend/README.md).

1. **Database** — create a Supabase project, open the SQL Editor, paste and run `backend/schema.sql`.
2. **Backend** — `cd backend`, `npm install`, copy `.dev.vars.example` → `.dev.vars` and fill in your keys, then `npm run dev` (serves at `http://127.0.0.1:8787`).
3. **Seed data** — with `.dev.vars` filled, run `node scripts/seed.js` to create sample data and test accounts.
4. **Frontend** — `cd frontend`, `npm install`, copy `.env.example` → `.env` and fill in your keys, then `npm run dev` (serves at `http://localhost:3000`).

## Seed accounts

After running `node scripts/seed.js`, you can log in with (password **`Password123!`** for all):

| Email | Role |
|---|---|
| `superadmin@example.com` | superadmin |
| `admin@example.com` | admin |
| `controller@example.com` | controller |
| `member@example.com` | member |

> These are created by the seed script in **your** Supabase project. Change the password in `scripts/seed.js` before running if you prefer.

---

## A note on missing keys

This base ships with **no API keys or secrets**. Files like `.dev.vars` and `.env` are not included — only their `.example` templates are. The application will not fully run until you create your own Supabase project (and any optional integrations you want) and fill in the templates. Identifying exactly which variables are required is part of the exercise.
