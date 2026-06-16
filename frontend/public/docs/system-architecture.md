# FMS — System Architecture

## Platform Overview

The **Flow Management System (FMS)** is a multi-tenant SaaS platform that enforces structured, sequential workflows for agencies. Work moves step-by-step through tasks defined by reusable templates. Approvals, deadlines, and escalations are enforced automatically.

---

## Tech Stack (Actual)

| Layer | Technology |
|---|---|
| **Frontend (SuperAdmin)** | Next.js 15 (App Router), React 19, TypeScript |
| **Frontend (Member)** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, custom `cn()` utility |
| **State Management** | Zustand v5 (persisted via `localStorage`) |
| **HTTP Client** | Axios with auto token refresh interceptor (`src/lib/api.ts`) |
| **Backend** | Cloudflare Workers (Hono framework, ES Modules) |
| **Database** | Supabase (PostgreSQL via Supabase JS client) |
| **Auth** | Supabase Auth — JWT (Bearer tokens attached per request) |
| **AI** | Groq API (`llama-3.3-70b-versatile`) via secure backend proxy |
| **Email** | Gmail OAuth2 (via existing OAUTH_ env variables) |

---

## Deployment Architecture

```
[SuperAdmin Browser]  ──────▶  [Cloudflare Worker: fms-backend]
[Member Browser]      ──────▶           │
                                        ▼
                              [Supabase: PostgreSQL]
                                        │
                Cloudflare Worker also calls:
                   - Groq API (AI assistant + AI copywriter)
                   - Gmail OAuth2 (email notifications)
```

- **Backend URL (local)**: `http://127.0.0.1:8787/api`
- **Backend URL (production)**: Cloudflare Worker deployed via `wrangler deploy`
- **All routes** prefixed with `/api` and protected by `Authorization: Bearer <jwt_token>`

---

## Repository Structure

### Backend (`fms_backend_cloud/`)
```
src/
  index.js                      # Hono app: CORS setup + all route registrations
  config/
    supabase.js                 # Supabase client factory — reads env vars
  middleware/
    auth.middleware.js          # JWT verification (Supabase Auth)
    role.middleware.js          # RBAC guards (requireAdmin, requireController)
  modules/
    auth/                       # Login + session management
    users/                      # User CRUD + directory
    company/                    # Company/workspace settings
    client/                     # CRM — client directory
    projects/                   # Template management + template task definitions
    instances/                  # Live workflow instance lifecycle
    tasks/                      # Core workflow execution (submit/approve/reject)
    holidays/                   # Business calendar (SLA-aware non-working days)
    notifications/              # In-app alerts
    performance/                # SLA tracking + analytics
    reports/                    # Exportable report generation
    superadmin/                 # Cross-company management (SuperAdmin only)
    dashboard/                  # Role-based dashboard aggregate endpoints
    chat/                       # Internal messaging
    onboarding/                 # Company onboarding flow
    ai-copy/                    # AI-powered email/marketing copy generation (Groq)
    ai-assistant/               # Platform Intelligence AI — chat + issue reports
wrangler.toml                   # Cloudflare Workers config (name=fms-backend)
.dev.vars                       # Local secrets (GROQ_API_KEY, SUPABASE_*, etc.)
```

### SuperAdmin Frontend (`fms--frontend-superadmin/src/`)
```
app/
  dashboard/
    superadmin/page.tsx         # Cross-company analytics + company management
    superadmin/ai-assistant/    # Platform Intelligence AI chat interface
    admin/page.tsx              # Per-company user/template/config management
    controller/page.tsx         # Instance management + task monitoring
    controller/templates/       # Template builder
    controller/manual-tasks/    # Off-workflow task management
    controller/own-tasks/       # Controller's own assigned tasks
    controller/performance-metrics/ # Team performance analytics
    member/page.tsx             # Member task execution portal
    chat/                       # Internal messaging
    plans/                      # Subscription plan management
components/
  instances/                    # Create/pause/resume instance modals
  tasks/                        # Task detail, checklist, approval UI
  projects/                     # Template builder components
  shared-components/
    sidebar/sidebar.tsx         # Role-aware navigation sidebar
lib/
  api.ts                        # Axios: base URL + Bearer token + auto-refresh
  types/auth.ts                 # All TypeScript interfaces (User, Task, Instance...)
  zustand/                      # Global stores
    user/user.ts                # Auth state (login, session, platform_role)
    tasks/tasks.ts              # Task fetching + workflow actions
    instances/instances.ts      # Instance lifecycle state
    projects/createproject.ts   # Template + project state
```

---

## Authentication Flow

1. User POSTs email/password to `POST /api/login`
2. Backend verifies via Supabase Auth → returns `access_token` + `refresh_token` + user profile
3. Frontend stores session in Zustand (persisted to `localStorage` via key `auth-storage`)
4. Axios interceptor reads `access_token` from Zustand and injects `Authorization: Bearer <token>` on every request
5. On 401 response: Axios auto-calls Supabase `/auth/v1/token?grant_type=refresh_token` to get a new token — if fails, logs user out and redirects to `/login`

---

## Known Issues & Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| All API calls return 401 | Expired or missing access token in `localStorage` | Clear `auth-storage` from localStorage and log in again |
| Dashboard loads empty | CORS error or wrong `NEXT_PUBLIC_API_URL` | Check the `.env` file — must point to `http://127.0.0.1:8787/api` locally |
| AI Assistant shows no response | Backend GROQ_API_KEY not set | Add `GROQ_API_KEY=gsk_...` to `.dev.vars` and restart worker |
| Notifications not arriving | Email OAuth tokens expired | Re-authenticate Gmail OAuth or check OAUTH_ vars in `.dev.vars` |