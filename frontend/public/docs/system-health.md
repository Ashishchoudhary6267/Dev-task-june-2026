# System Health — Admin Dashboard

## Overview

The **System Health** indicator on the Admin Dashboard is a real-time composite score (0–100%) that reflects how well your company's workflows, tasks, and team are performing on the FMS platform.

It is **not** a server/infrastructure monitor. Instead it measures **business-process health** using data already tracked by the platform.

---

## How the Score Is Calculated

The health score is a **weighted average of three signals**, each normalized to a 0–100% scale:

| Signal | Weight | Source |
|--------|--------|--------|
| Task SLA Rate | **50%** | `overdueTasks` vs `activeTasks` |
| Workflow Activity | **30%** | `activeInstances` count |
| User Engagement | **20%** | `users` count |

### Formula

```
Health Score = (Task SLA Rate × 50) + (Workflow Activity × 30) + (User Engagement × 20)
```

All values are clamped to the range `[0, 100]`.

---

## Signal Details

### 1. Task SLA Rate (weight: 50%)

Measures the proportion of active tasks that are **not overdue**.

```
taskHealth = 1 - (overdueTasks / activeTasks)
```

- If there are **no active tasks**, this signal defaults to **100%** (nothing to fail).
- If **all active tasks are overdue**, this signal is **0%**.
- A single overdue task out of 10 active = 90%.

> This is weighted most heavily because overdue tasks directly indicate that the team is missing SLA commitments.

---

### 2. Workflow Activity (weight: 30%)

Measures whether **workflow instances are running**.

```
workflowHealth = instances > 0 ? 100% : 50%
```

- If **at least one instance** is active → 100%
- If **no instances** are running → 50% (partial credit — the platform is idle, but not broken)

> A completely idle platform scores 50% on this signal, not 0%, because having no active workflows may simply mean no projects have started yet.

---

### 3. User Engagement (weight: 20%)

Measures team size relative to a healthy minimum.

```
userHealth = min(users / 5, 1)
```

- **5 or more users** → 100%
- **3 users** → 60%
- **1 user** → 20%
- **0 users** → 0%

> Scaled against a target of 5 users, since a functional FMS team typically has at least a few members. Capped at 100%.

---

## Status Labels

| Score | Label | Color |
|-------|-------|-------|
| ≥ 90% | All systems operational | 🟢 Green |
| 70–89% | Minor issues detected | 🟡 Amber |
| 50–69% | Performance degraded | 🟠 Orange |
| < 50% | Critical — needs attention | 🔴 Red |

---

## Example Calculations

| Scenario | Active Tasks | Overdue | Instances | Users | Score |
|----------|-------------|---------|-----------|-------|-------|
| Healthy team | 10 | 0 | 3 | 17 | **100%** ✅ |
| Some overdue | 13 | 5 | 2 | 17 | **81%** 🟡 |
| No instances | 10 | 0 | 0 | 10 | **85%** 🟡 |
| Heavy overdue | 10 | 8 | 1 | 5 | **56%** 🟠 |
| No users, no tasks | 0 | 0 | 0 | 0 | **65%** 🟠 |
| Everything failing | 10 | 10 | 0 | 0 | **15%** 🔴 |

---

## Performance Metrics & Thresholds (Controller Dashboard)

While System Health (above) is for admins to see the company-wide pulse, the **Performance Metrics** dashboard allows Controllers to drill down into individual and team productivity.

### 1. Task Efficiency (SLA Health)

Efficiency is a "negative-variance" metric. It measures what percentage of a member's total workload is failing or has failed SLA.

- **Calculation:** `-( (Late Completions + Active Overdue Tasks) / Total Workload ) * 100`
- **Goal:** `0%` (Perfect efficiency).
- **Lower scores (e.g., -40%)** indicate that a significant portion of the workload is breaching deadlines.

### 2. Quality Score (Weighted Iteration)

Quality is measured by the "rework rate" using data from `task_approval_history`.

| Task Outcome | Quality Points |
|--------------|----------------|
| Approved First-Pass (0 rejections) | 100 |
| Approved with 1 Rework | 75 |
| Approved with 2 Reworks | 50 |
| Approved with 3+ Reworks | 25 |

The **Quality Score** shown on the dashboard is the average of these points across all completed tasks in the period. Members with no completed tasks show as **N/A**.

---

## Underperformance Thresholds

Controllers can configure thresholds to automatically highlight members who need attention. These settings trigger **Warning Badges** on individual cards.

| Metric | Typical Threshold | Meaning |
|--------|-------------------|---------|
| **On-Time %** | `80%` | Flag if less than 80% of tasks are finished on time. |
| **Efficiency %** | `-20%` | Flag if more than 20% of their total volume has breached SLA. |
| **Overdue Count** | `3` | Flag if they have 3 or more currently active overdue tasks. |

> [!NOTE]
> These thresholds are stored in the local session state. Changing them immediately updates the UI highlighting but does not affect the underlying data.

---

## Data Source
... (rest of file)
All data is fetched from the **existing dashboard stats endpoint**:

```
GET /api/dashboard/stats
```

**Response shape:**
```json
{
  "users": 17,
  "projects": 3,
  "activeTasks": 13,
  "overdueTasks": 2,
  "instances": 5
}
```

This data is **company-scoped** — it only reflects data within the logged-in admin's company. The endpoint is cached for 5 minutes via Cloudflare KV (`FMS_CACHE`).

> **No backend changes were required** to implement System Health. The score is computed entirely on the frontend using data already available in the stats store (`useStatsStore`).

---

## Frontend Implementation

**File:** `src/app/dashboard/admin/page.tsx`

**Function:** `computeSystemHealth()`

```ts
const computeSystemHealth = () => {
    if (!stats) return null;

    const { activeTasks = 0, overdueTasks = 0, activeInstances = 0, users = 0 } = stats;

    const taskHealth    = activeTasks > 0 ? Math.max(0, 1 - overdueTasks / activeTasks) : 1;
    const workflowHealth = activeInstances > 0 ? 1 : 0.5;
    const userHealth    = Math.min(users / 5, 1);

    const score = Math.min(100, Math.max(0,
        Math.round(taskHealth * 50 + workflowHealth * 30 + userHealth * 20)
    ));

    // label + color derived from score thresholds
    return { score, label, color, breakdown };
};
```

**Tooltip:** Hovering the System Health card opens a breakdown panel showing each signal's individual score and the mini progress bars, so admins can identify which signal is dragging the score down.

---

## Upgrading This in the Future

If you want more precise health signals, here are easy extensions:

| Future Signal | How to Add |
|---------------|-----------|
| Recent error rate | Track 500 errors in a new table and query in `/dashboard/stats` |
| API response time | Log request durations in middleware, expose P95 via the stats endpoint |
| Login activity | Use `loginCount` field already on the `users` table |
| Storage usage | Query Supabase storage bucket metadata |

All of these would require a new backend query in `dashboard.controller.js` and adding a new weighted term to `computeSystemHealth()`.
