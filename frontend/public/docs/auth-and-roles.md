# FMS — Auth, Roles & Permissions

## Platform Roles

Every user has a `platform_role` that determines what sections of the dashboard they can access.

| Platform Role | Dashboard Route | Primary Responsibilities | Restrictions (What they CANNOT do) |
|---|---|---|---|
| `superadmin` | `/dashboard/superadmin` | Manages all companies. Views cross-company analytics. Accesses AI. | Cannot execute daily workflow tasks. |
| `admin` | `/dashboard/admin` | Manages users, templates, clients, forms, and config. | Cannot execute tasks or approve tasks (unless also assigned). |
| `controller` | `/dashboard/controller` | Spawns/pauses/resumes instances. Reassigns, bypasses, unlocks tasks. | Cannot create users, create templates, or edit company settings. |
| `member` | `/dashboard/member` | Executes assigned tasks, checks items, submits work, reviews tasks. | **CANNOT create instances**, pause instances, override tasks, or manage users/templates. |

---

## Workflow Roles

**Workflow roles** define what kind of work a Member is responsible for within the task sequence. Set by Admin per user.

Common values: `copywriter`, `designer`, `reviewer`, `final_reviewer(interim_manager)`

- Used to **auto-assign tasks** when an instance is created (the task's `assigned_role` matches a user's `workflow_role`)
- A user can have both a `platform_role` of `controller` and still be assigned tasks

---

## User Data Shape

```typescript
interface User {
  id: string;
  name: string;
  company_id: string;        // Multi-tenant isolation key
  platform_role: string;     // 'superadmin' | 'admin' | 'controller' | 'member'
  workflow_role: string;     // 'copywriter' | 'designer' | etc.
  email?: string;
  permissions?: any[];       // Currently reserved for future granular ACLs
}
```

---

## Auth API Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/login` | None | Email + password login. Returns access_token, refresh_token, and user profile. |
| `POST` | `/api/logout` | Bearer | Invalidate session |
| `GET` | `/api/users/me` | Bearer | Fetch current user profile + permissions |

---

## User Management (Admin Only)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/users` | Fetch all users in the company |
| `POST` | `/api/users` | Create a new user (Admin sets platform_role + workflow_role) |
| `PUT` | `/api/users/:id` | Update user profile, role, or status |
| `DELETE` | `/api/users/:id` | Remove user from company |

---

## Role-Based Route Guards

In the backend, routes are protected by two middleware layers:

1. **`authenticate`** — Verifies the `Authorization: Bearer <token>` header using Supabase Auth. Required on all non-login routes.
2. **`requireAdmin`** — Applied on project/template management routes. Rejects requests from non-admin users.

In the frontend, the sidebar renders different navigation items based on `user.platform_role`:
- `superadmin` sees: Cross-company overview, Companies, AI Assistant
- `admin` sees: Users, Templates, Clients, Settings
- `controller` sees: Instances, Tasks, Performance, Manual Tasks
- `member` sees: My Tasks, My Reviews

---

## Session & Token Management

- **Storage**: Zustand store persisted to `localStorage` under key `auth-storage`
- **Token Auto-refresh**: Axios response interceptor at `src/lib/api.ts` catches `401` responses and calls Supabase token refresh automatically. If refresh fails, user is redirected to `/login`.
- **Token Format**: JWTs issued by Supabase Auth with `service_role` or user-level scope

---

## Company Isolation (Multi-Tenancy)

Every database query is scoped to `company_id`. A user can **only** see data belonging to their own company.

- `superadmin` role users can query across companies via `/api/superadmin/` endpoints
- Row-Level Security (RLS) is enforced at the Supabase level as an additional protection layer

---

## Common Auth Issues & Fixes

| Problem | Likely Cause | Resolution |
|---|---|---|
| Login succeeds but dashboard shows blank | `platform_role` not set in DB for user | Admin must set `platform_role` in database for the user record |
| 403 Forbidden on admin routes | User has `platform_role = 'member'` or `'controller'` | Elevate role to `admin` in user settings |
| User logged out unexpectedly | `access_token` expired, refresh token also expired | User must log in again. Tokens expire per Supabase project settings. |
| Changed role not reflected | Zustand cached the old role | User must log out and log back in to refresh session data |
| New company user cannot log in | No user record in `users` table (only Supabase Auth record) | Run user creation flow or run `node createAdmin.js` to seed first admin |
