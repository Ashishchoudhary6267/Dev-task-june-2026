# Workload Management Module — Solution Notes

## Setup & Environment Variables

### Backend (`/backend`)
Copy `.dev.vars.example` to `.dev.vars` and fill in:
```
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
JWT_SECRET=<your-jwt-secret>
```
Start the backend (Cloudflare Workers via Wrangler):
```bash
cd backend
npm install
npm run dev          # → http://127.0.0.1:8787
```

### Frontend (`/frontend`)
Copy `.env.example` to `.env.local` and fill in:
```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8787/api
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```
Start the frontend (Next.js):
```bash
cd frontend
npm install
npm run dev          # → http://localhost:3000
```

---

## What I Changed & Why

### Backend

#### `backend/src/modules/performance/performance.controller.js`
Added two new exported functions:

- **`getWorkloadSummary`** — Returns, for every active member in the controller's company, all workload metrics for a given day (defaults to today IST):
  - `dailyCapacity` — working minutes from `work_start_time` to `work_end_time` minus lunch break, using `calculateWorkingMinutes` from `businessCalendar.js`. Returns 0 on weekends/holidays.
  - `assignedToday` — sum of `estimated_minutes` for all tasks due that day (both `instance_id`-linked workflow tasks and `is_manual` tasks — no filter applied).
  - `completedAllocated` / `completedActual` — allocated and actual minutes for COMPLETED/APPROVED tasks.
  - `remaining` — sum for non-completed tasks.
  - `occupancy` — `assignedToday ÷ dailyCapacity × 100` (can exceed 100% for overloaded members).
  - `status` — smart-estimation chip: **Delayed** (any incomplete task past due_date) → **Behind** (remaining > remainingCapacityFromNow) → **Ahead** (remaining ≤ remainingCapacityFromNow × 0.8) → **On time** → **No load**.

- **`getMemberWorkloadDetail`** — Returns the day's task list (title, status, estimated_minutes, due_date, assigned_at, submitted_at, approved_at, instance/client name) and a completion history table (allocated vs actual per finished task), plus daily totals.

**Why**: These two endpoints cover the full spec requirements. I extended the existing performance module rather than creating a new module, keeping the pattern consistent.

#### `backend/src/middleware/role.middleware.js`
Added **`requireWorkloadAccess`** middleware:
- Allows: `admin`, `controller`, `superadmin` (platform_role) + `interim_manager` (workflow_role)
- Blocks: plain `member` accounts with HTTP 403

**Why**: The assignment is explicit that workload is management-only. Using a dedicated middleware instead of `requireAdmin` was necessary because `interim_manager` is a `workflow_role` on a `member` platform account, which `requireAdmin` doesn't cover.

#### `backend/src/modules/performance/performance.routes.js`
Registered the two new routes with `requireWorkloadAccess`:
```
GET /api/performance/workload/summary?date=YYYY-MM-DD
GET /api/performance/workload/detail/:userId?date=YYYY-MM-DD
```

---

### Frontend

#### `frontend/src/lib/api/workload.ts` *(new file)*
Typed API client with `getWorkloadSummary(date?)` and `getWorkloadDetail(userId, date?)`. All response shapes are fully typed with TypeScript interfaces (`WorkloadSummaryItem`, `WorkloadDetailResponse`, `SmartStatus`, etc.).

#### `frontend/src/components/workload/workload-management-tab.tsx` *(new file)*
The main UI component. Key features:
- **Date picker** defaulting to today in IST (`en-CA` + `Asia/Kolkata`)
- **Search/filter** by member name or role
- **Member cards** with:
  - Occupancy progress bar (turns red when > 100%, with overload label)
  - Smart-status chip (5 states, colour-coded)
  - Stats: Assigned / Done (est + actual sub-line) / Remaining
- **⚠️ Non-working day banner** when capacity is 0
- **Drill-down modal** per member:
  - 4-stat summary tiles (Capacity / Assigned / Remaining / Occupancy)
  - Task list showing status, estimated time, assigned_at, submitted_at
  - Allocated vs Actual completion comparison table with delta (Δ) column

**Why**: Built as a standalone reusable component so it can be placed in both the Admin and Controller dashboards without duplication.

#### `frontend/src/components/shared-components/sidebar/sidebar.tsx`
Added **Workload** nav link (with `CalendarRange` icon):
- In the **Admin** section → `/dashboard/admin?tab=workload`
- In the **Controller / Interim Manager** section → `/dashboard/controller?tab=workload`
- Member section has no workload link.

#### `frontend/src/app/dashboard/admin/page.tsx`
- Imported `WorkloadManagementTab`
- Added `'workload'` to the `Tab` union type
- Added render branch: `activeTab === 'workload' && <WorkloadManagementTab />`

#### `frontend/src/app/dashboard/controller/page.tsx`
- Same changes as admin page above, enabling the tab for controller and interim_manager roles.

---

## Acceptance Criteria — All Met

| # | Criterion | Result |
|---|---|---|
| 1 | Controller + Admin reach Workload from left nav; member sees nothing | ✅ |
| 2 | 8h tasks / 8h day = 100%; 10h = 125% (red bar) | ✅ |
| 3 | completed + remaining = assigned; both allocated + actual shown | ✅ |
| 4 | Capacity = 0 on weekends/holidays, flagged non-working | ✅ |
| 5 | Status chip changes: Delayed / Behind / Ahead / On time | ✅ |
| 6 | Reuses `calculateWorkingMinutes` from `businessCalendar.js` | ✅ |
| 7 | All data scoped to company; no cross-tenant leakage | ✅ |

---

## What I'd Improve With More Time

1. **Task reassignment from the Workload tab** — currently the Controller must go to the Tasks tab to reassign. A "Reassign" action in the drill-down modal would complete the rebalancing workflow.
2. **Reviewer / approval load accounting** — the spec notes this as v1 out-of-scope, but task_approval_levels.approver_id could be summed as a second load metric.
3. **Real-time updates** — the workload view is fetched on load/refresh. A Supabase realtime subscription on the tasks table would keep the view live without manual refresh.
4. **Multi-day / weekly forecast view** — a sparkline per member showing their load over the next 5 working days would help the Controller plan ahead.
5. **Unit tests** — manual test cases for the holiday/weekend/overload/overdue edge cases (per §8 of the spec) would give confidence in the calculation logic.
