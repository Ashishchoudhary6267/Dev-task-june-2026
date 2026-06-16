# FMS — Instance & Workflow Engine

## What is an Instance?

An **Instance** is a live, deployed execution of a Project Template. When a Controller "spawns" an instance, the system creates a real set of tasks from the template's blueprint. Each task moves sequentially through the workflow.
A Controller (or Admin) can create an instance by clicking on 'Create Instance' on the instance page. **Members CANNOT create instances**; they can only work on tasks assigned to them within an active instance.

**Instance Statuses:**
- `SCHEDULED` — Created but not yet started (start date is in the future)
- `ONGOING` — Actively running, tasks are being worked on
- `PAUSED` — All task work is halted by a Controller (tasks remain in their current status)
- `COMPLETED` — All tasks in the instance have reached `COMPLETED` status

---

## Micro-Templates & Quick Spawn

**Micro-Templates** are a special template category (`type = 'micro'`) designed specifically for ad-hoc, lightweight client requests (e.g., "Design a banner", "Write copy"). They are created by Admins and triggered by Controllers.

- **Purpose:** Bypasses the bulky setup process of standard project instances.
- **Workflow:** Controllers trigger these templates via the **⚡ Quick Task** button on the Instances tab. This bypasses the heavy `CreateInstanceModal` and instead opens a streamlined `QuickSpawnModal`.
- **Task Mapping:** Micro-Templates can contain one or multiple tasks. When spawned, the controller maps users to every individual task immediately. If a task requires an approval flow, the modal dynamically maps those approval levels just like the standard workflow. 
- **Execution:** Once spawned, the tasks immediately drop into the standard `IN_PROGRESS` conveyor belt, adopting standard SLA times, approval processes, and sequential unlock logic.

---

## Task State Machine

Every task follows this exact state machine:

```
LOCKED → IN_PROGRESS → PENDING_APPROVAL → COMPLETED
                   ↘ (no approval)  ↗
                         ↑
                      REJECTED (loops back to IN_PROGRESS)
```

### Task Statuses Explained

| Status | Meaning |
|---|---|
| `LOCKED` | Task is waiting for the previous task to complete. The member cannot act on it. |
| `IN_PROGRESS` | Task is unlocked and assigned. The member can check off items and submit. |
| `PENDING_APPROVAL` | Member has submitted. Now awaiting reviewer approval at current `current_level`. |
| `COMPLETED` | All approval levels passed (or approval not required). Triggers next task unlock. |
| `REJECTED` | A reviewer rejected the submission. Task returns to `IN_PROGRESS` with a rejection comment. |

---

## Sequential Unlock Logic

1. When an *Instance* is created (or set to `active`), **Task 1 only** is set to `IN_PROGRESS`. All others are `LOCKED`.(It follows an approach of tasks are the steps of instances)
2. When Task N reaches `COMPLETED`, the system automatically:
   - Finds Task N+1 (same `instance_id`, `task_order = N+1`)
   - Sets its status from `LOCKED` → `IN_PROGRESS`
   - Sets `assigned_at` timestamp
   - Calculates and sets `due_date` based on `turnaround_minutes` (excluding holidays)
   - Sends an in-app notification to the newly assigned user

---

## Approval Flow (Multi-Level)

When a task has `approval_required = true` and `approval_levels = N`:

1. Member submits → task → `PENDING_APPROVAL`, `current_level = 1`
2. Reviewer at Level 1 **approves** → if `N > 1`, `current_level` increments to 2; if `N = 1`, task → `COMPLETED`
3. Each level must be approved sequentially
4. Any reviewer can **reject** → task reverts to `IN_PROGRESS`, rejection comment saved in `task_approval_history`
5. Up to 5 levels supported (L1–L5)

---

## Instance API Endpoints

All routes: `Authorization: Bearer <token>` required.

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/instances` | Create a new instance from a template |
| `GET` | `/api/instances` | Fetch all instances (filterable by company/status) |
| `GET` | `/api/instances/:id` | Get instance details including all tasks |
| `GET` | `/api/instances/tasks/:task_id` | Get the instance that contains a specific task |
| `PATCH` | `/api/instances/:id/pause` | Pause instance (halts task work) |
| `PATCH` | `/api/instances/:id/resume` | Resume a paused instance |
| `PATCH` | `/api/instances/:id/active` | Activate a SCHEDULED instance immediately |

---

## Task API Endpoints

Base path: `/api/tasks`

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Fetch tasks by project ID |
| `GET` | `/member` | Fetch tasks for a specific member user |
| `GET` | `/my-tasks` | Fetch the current logged-in user's tasks |
| `POST` | `/:id/submit` | Member submits completed task |
| `POST` | `/:id/approve` | Reviewer approves a task at current level |
| `POST` | `/:id/reject` | Reviewer rejects a task (with optional comment) |
| `PATCH` | `/:id/checklist/:itemId` | Toggle a checklist item on/off |
| `POST` | `/:id/reassign` | Controller reassigns task to a different user |
| `POST` | `/:id/reassign-approver` | Controller changes the approver for a level |
| `POST` | `/:id/bypass` | Controller bypasses a task (force-completes it) |
| `PUT` | `/:id/extend-sla` | Controller extends the due date of a task |
| `POST` | `/:id/comments` | Add a comment to a task |
| `POST` | `/:id/manual-unlock` | Controller manually unlocks a LOCKED task |

### Manual Tasks
| Method | Route | Description |
|---|---|---|
| `POST` | `/manual` | Create an one-off task not tied to an instance |
| `GET` | `/manual` | Fetch all manual tasks for the company |
| `PUT` | `/manual/:id` | Update a manual task |
| `DELETE` | `/manual/:id` | Delete a manual task |

---

## Common Issues & Resolutions

| Problem | Root Cause | Resolution |
|---|---|---|
| Task is stuck in `LOCKED` | Previous task in chain not completed yet | Check task N-1 — it must reach `COMPLETED` first. Use Controller's "Manual Unlock" as override. |
| Task stuck in `PENDING_APPROVAL` | Approver has not acted, or approver is wrong | Controller can reassign approver via `POST /:id/reassign-approver` |
| Instance shows `SCHEDULED` but should be running | Start date is in future or `active` was not triggered | Use `PATCH /instances/:id/active` to force-activate |
| Submit button disabled for member | Not all required checklist items are checked | Member must check all checklist items before submitting |
| Task was rejected, member doesn't see the comment | `last_rejection_comment` field in task | Comments appear in task detail modal on the member portal |
| Member bypass completed task, next task not unlocking | Sequential unlock trigger failed | Check backend logs. The trigger runs after `COMPLETED` status is set. |

---

## Client Revision — Reopening a Completed Task

### Overview

After a task (or even the entire instance) has been marked `COMPLETED`, the client may return with change requests. Rather than cloning the instance or manually editing the database, a **Controller** can use the **"Unlock Task"** action on any completed task to formally reopen it for revision.

---

### When to Use

Use this feature when:
- A client reviews the final output and requests specific changes on a step that is already `COMPLETED`.
- The instance may itself be `COMPLETED` (all tasks done), but the client is not satisfied.
- You need to roll back the workflow to a specific step and restart from there.

---

### State Machine — Client Revision Path

```
COMPLETED  →  (Client Revision Triggered)  →  IN_PROGRESS
                                                     ↓
                              All downstream tasks → LOCKED
                                                     ↓
                          Instance (if COMPLETED)  → ONGOING
```

After the revision is done, the standard flow resumes:

```
IN_PROGRESS → PENDING_APPROVAL → COMPLETED → (next task unlocks)
```

---

### Exact State Changes

When a Controller triggers "Reopen for Revision" on Task N:

| Target | Before | After |
|---|---|---|
| Task N (the selected task) | `COMPLETED` | `IN_PROGRESS` — fresh `due_date` calculated from `turnaround_minutes` |
| Task N — approval levels | `APPROVED` | All reset to `PENDING` — the full review chain restarts |
| Task N — checklist items | Mixed (some checked) | All reset to **unchecked** |
| Task N — `submitted_at` | Set | `null` |
| Task N — `last_rejection_comment` | Previous value | Set to **client's feedback** (visible to member) |
| Tasks N+1, N+2, … (downstream) | Any status | `LOCKED` — `due_date`, `assigned_at`, `submitted_at` cleared |
| Downstream approval levels | Mixed | All reset to `PENDING` |
| Downstream checklist items | Mixed | All reset to **unchecked** |
| Instance | `COMPLETED` or `ONGOING` | `ONGOING` (if it was `COMPLETED`, it reverts) |

---

### API Endpoint

```
POST /api/tasks/:id/reopen-for-revision
Authorization: Bearer <token>
Role required: controller, admin, superadmin
```

**Request Body:**

```json
{
  "reason": "Client requested redesign of the header section",
  "client_comment": "The client specifically said: 'The font is too small and the CTA button colours don't match brand.'"
}
```

| Field | Required | Description |
|---|---|---|
| `reason` | ✅ Yes | Internal reason — written to `task_bypass_logs` for the audit trail. |
| `client_comment` | ❌ No | The client's exact feedback. Stored as `last_rejection_comment` on the task so the member sees it inside the task detail view. |

**Success Response (200):**

```json
{
  "message": "Task reopened for client revision. All subsequent tasks have been locked.",
  "task": { "...updatedTaskObject" },
  "locked_downstream": 2
}
```

**Error Responses:**

| Status | Reason |
|---|---|
| `400` | Reason is empty, or task is not in `COMPLETED` status |
| `404` | Task not found or does not belong to this company |
| `500` | Internal server error |

---

### Audit Trail

Every "Reopen for Revision" action is logged in `task_bypass_logs` with:

```json
{
  "action": "CLIENT_REVISION",
  "from_step": <task_order>,
  "to_step":   <task_order>,
  "performed_by": "<controller_id>",
  "reason": "<internal reason>"
}
```

This appears in the task's action dropdown badge as **"Bypassed"** (reusing the existing audit badge), ensuring full accountability.

---

### UI Walkthrough (Controller)

1. Open the **Instance Details** modal from the Instances tab.
2. In the task table (or mobile card view), locate the `COMPLETED` task you want to reopen.
3. Click the **⚙ Actions** menu (gear icon) on that task row.
4. Choose **Unlock Task** — this option only appears for tasks with status `COMPLETED`.
5. The **Client Revision Request** dialog opens with:
   - **Internal Reason** *(required)* — written to audit log only, not shown to member.
   - **Client's Feedback** *(optional)* — shown to the member inside their task as a rejection comment.
6. Click **Reopen for Revision** (orange button).
7. The modal closes, the task list refreshes, and the target task is now `IN_PROGRESS` again. All subsequent tasks show `LOCKED`.

---

### Notification

The member assigned to the reopened task receives an in-app notification:

> **"Task Reopened — Client Revision Required"**
> `"<Task Title>"` in `"<Instance Name>"` has been reopened. The client has requested changes. Please restart the task.

---

### Edge Cases & Rules

| Scenario | Behaviour |
|---|---|
| Task is `IN_PROGRESS` or `LOCKED` | ❌ Not allowed — only `COMPLETED` tasks can be reopened. |
| Task is the last in the instance, instance is `COMPLETED` | ✅ Instance is automatically reverted to `ONGOING`. |
| Downstream tasks are already `LOCKED` | Skipped — only unlocked downstream tasks are affected. |
| Approval levels already `APPROVED` | All approval levels are reset to `PENDING` so the full chain restarts. |
| Checklist items | All reset to **unchecked** so the member must re-complete them. |
| Recurring instance with recurrence_interval | The revision does **not** affect the recurrence schedule — the next scheduled clone is unaffected. |


# Recurring Instances Documentation

This document describes the implementation, configuration, and operation of the **Recurring Instances** feature in the FMS (Fluid Management System).

---

## 1. Overview
The Recurring Instances feature allows controllers to set up work cycles that automatically "repeat" themselves. When an instance with a repeat interval is completed, the system automatically clones it and schedules a new occurrence for the future.

### Key Capabilities:
- **Repeat Options**: Weekly, Monthly, 3-Monthly, 6-Monthly.
- **Auto-Activation**: A midnight cron job automatically activates "Scheduled" instances when their date arrives.
- **Full Cloning**: New instances inherit all tasks, checklist items, and assigned reviewers/approvers from the parent instance.
- **End Dates**: Support for an optional "End Repeat" date to terminate the cycle.

---

## 2. Implementation Architecture

### Database Schema (Supabase)
The `public.instances` table includes the following new columns:
| Column | Type | Description |
| :--- | :--- | :--- |
| `recurrence_interval` | `text` | The frequency of repetition (e.g., '1 month'). |
| `recurrence_end_date` | `date` | Optional date after which no more instances will be spawned. |
| `parent_instance_id` | `uuid` | Reference to the previous instance in the chain. |

---

## 3. Setup Instructions

### Step 1: SQL Migration
The following objects must be created in the Supabase SQL Editor:
1. **Schema Update**: Alter the `instances` table to add the recurrence columns.
2. **Function**: `public.activate_scheduled_instances()` — This function logic handles both the activation of "Today's" scheduled instances and the logic for spawning the **next** occurrence.

### Step 2: Cron Job Configuration
To automate the system, you must register a cron job in the **Supabase Dashboard → Project Settings → Database → Cron Jobs**:
- **Name**: `activate_instances_midnight`
- **Schedule**: `0 0 * * *` (Every night at midnight UTC)
- **Type**: `SQL Snippet`
- **Command**: `SELECT public.activate_scheduled_instances();`

---

## 4. How the "Spawning" Logic Works

### Creation
When a controller creates an instance in the UI and selects a **Repeat** interval, the data is sent to the `/instances` API. The backend stores the interval and the optional end date.

### Completion (The Trigger)
The system uses a "Chain" approach:
1. When the **last task** of an instance is marked **COMPLETED**, the `task.helper.js` script in the Cloud Function is triggered.
2. It detects if the instance has a `recurrence_interval`.
3. If yes, it calculates the `next_scheduled_at` date: `Current Date + Interval`.
4. It verifies the date is before the `recurrence_end_date`.
5. It performs a **Deep Clone**:
    - Creates a new instance record with status `SCHEDULED`.
    - Clones all tasks belonging to the instance.
    - Clones all checklist items for each task.
    - Clones all approval levels and assigned approver IDs.

### Activation
Every night at midnight, the **Supabase Cron Job** scans the database for `SCHEDULED` instances where `scheduled_at <= CURRENT_DATE`. It sets them to `ONGOING` and unlocks the first task for the assigned user.

---

## 5. UI Components
- **Modal**: `CreateInstanceModal.tsx` contains the "Repeat" dropdown and "End Date" logic.
- **Store**: `useInstanceStore` handles the API payload delivery.
- **Icons**: Uses `Lucide-React`'s `Repeat` icon for visual identification.

---

## 6. Troubleshooting & Maintenance
- **Skip a Cycle**: To stop a specific recurrence, you can manually set the `status` of the next `SCHEDULED` instance to `CANCELLED`.
- **Change Interval**: To change the frequency of an existing chain, update the `recurrence_interval` on the *most recent* active instance.
- **Logs**: Cron job execution logs can be found in Supabase under `cron.job_run_details`.
