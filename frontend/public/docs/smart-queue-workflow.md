# FMS — Smart Queue & Auto-Pull Workflow

## 1. Overview & Purpose

When migrating from unstructured tools (like Slack) to a rigid workflow system, a common challenge is the "Push vs. Pull" dilemma:
- **Slack (Pull):** Members pull tasks when they have capacity.
- **Traditional FMS (Push):** When Task A completes, Task B is instantly unlocked and "pushed" to the next member. The SLA clock starts immediately.

**The Problem:** If the next member is already busy with another task, their new task burns SLA time while sitting idle. This unfairly penalizes their performance metrics and causes stress.

**The Solution:** The **Smart Queue (Auto-Pull)** system. We introduce a `QUEUED` state that acts as a buffer. The system automatically enforces Work-In-Progress (WIP) limits, mimicking the "Pull" feel of Slack without requiring manual Controller intervention.

---

## 2. Updated Task State Machine

We are introducing a new task status: `QUEUED`.

```text
LOCKED → QUEUED → IN_PROGRESS → PENDING_APPROVAL → COMPLETED
                      ↗ (no approval)  ↗
                            ↑
               REJECTED (drops instantly to IN_PROGRESS)
```

| Status | Meaning & SLA Behavior |
|---|---|
| `LOCKED` | Waiting for previous steps to complete. **SLA Clock: Off** |
| `QUEUED` | Previous step complete. Waiting for the member's capacity to clear (or for member to self-pull). **SLA Clock: Off** |
| `IN_PROGRESS` | Actively being worked on by the member. **SLA Clock: RUNNING** |
| `PENDING_APPROVAL` | Submitted and waiting for review. **SLA Clock: Paused/Off** |
| `COMPLETED` | Fully approved. |

---

## 3. Database Changes Required

### 3.1 New Column: `queued_at`
Add a `queued_at` timestamp column to the `tasks` table:

```sql
ALTER TABLE tasks ADD COLUMN queued_at TIMESTAMPTZ DEFAULT NULL;
```

- Set to the current timestamp when a task transitions to `QUEUED`.
- Set to `NULL` when the task moves out of `QUEUED` (into `IN_PROGRESS`).
- Used for sorting tasks in the Auto-Pull logic (oldest queued task is pulled first).

### 3.2 Updated Valid Task Statuses
The `status` column on the `tasks` table must now accept the following values:

```
LOCKED | QUEUED | IN_PROGRESS | PENDING_APPROVAL | COMPLETED | REJECTED
```

---

## 4. Core Automation Rules

The Smart Queue operates on a strictly automated rule engine to ensure zero manual effort from the Controller.

### Rule 1: The WIP Limit (Work-In-Progress)
A member is only allowed a maximum of **1 Normal Task** in `IN_PROGRESS` at any given time.
- When a preceding task finishes, the system checks the next member's active task count.
- If the member is busy (`IN_PROGRESS >= 1`), the new task lands in `QUEUED`. The `queued_at` timestamp is recorded.
- If the member is idle (`IN_PROGRESS == 0`), the new task lands immediately in `IN_PROGRESS`. The SLA clock starts.

### Rule 2: Auto-Pull (Next-In-Line)
When a member clicks "Submit" on their active task, their plate clears. The system instantly evaluates their `QUEUED` list and automatically pulls **one** task into `IN_PROGRESS`.

**Sorting Logic:**
1. Tasks marked `is_urgent = true` first.
2. Then tasks with the oldest `queued_at` timestamp (first in, first out).

### Rule 3: The Interrupt Rule (Urgent Override)
If a Controller spawns a Micro-Template or flags a task as **"Urgent/High Priority"**, it bypasses all queue rules.
- It drops instantly into `IN_PROGRESS` and the SLA clock starts immediately.
- It ignores the WIP limit (the member will temporarily have 2 active tasks).
- The system fires a high-priority alert: *"🚨 URGENT TASK ARRIVED."*

### Rule 4: The Rework Rule (Rejected Tasks)
Rejected tasks represent a stalled project and are treated identically to Urgent tasks.
- When a reviewer clicks "Reject", the task does **not** go back to `QUEUED`.
- It drops instantly into `IN_PROGRESS` for the original member.
- It ignores the WIP limit and triggers an alert: *"🚨 Task Rejected: Revisions Required."*

### Rule 5: Frontend Member Priority (Pin to Focus)
To give members psychological control over their day, the frontend allows them to **"Pin" (⭐)** tasks.
- Pinning does not change backend SLAs or deadlines.
- It simply forces the pinned tasks to render at the top of the `QUEUED` section in the member's UI, helping them plan which task to work on next.
- When the member manually self-pulls a task (Rule 6), they will naturally pin the task they intend to pull next, making it visible at the top of the queue.

### Rule 6: Member Self-Pull (Manual Pull from Queue) ⬅ NEW
To restore the Slack-like autonomy members are used to, a member may manually pull a `QUEUED` task into `IN_PROGRESS` themselves via a **"Start Now"** button on each queued task card.

**Conditions for Self-Pull:**
- The member's current `IN_PROGRESS` count must be **0** (their WIP slot is free).
- The task must be in `QUEUED` status and assigned to that member.
- If the member already has a task `IN_PROGRESS`, the "Start Now" button is **disabled/greyed out** — the WIP limit (Rule 1) still applies.

**What happens on Self-Pull:**
- Task status transitions: `QUEUED` → `IN_PROGRESS`.
- `queued_at` is cleared (`NULL`).
- `assigned_at` is set to now.
- SLA clock starts immediately (same behavior as Auto-Pull).
- No Controller action required.

**Why this rule exists:**
This gives members full visibility into their upcoming queue and lets them decide *when* they are ready to begin — exactly matching the pull-based feel of Slack, while keeping all WIP and SLA guardrails intact.

---

## 5. Member Task Dashboard — UI Specification

The member's task view must be divided into **three clearly labelled sections**, rendered in this order:

```
📋 My Tasks

🔴 IN PROGRESS
└── Task X  [SLA running]  ⭐ (pinned)

🟡 QUEUED  (visible to member — plan your day here)
└── Task Z  [queued 1h ago]  ⭐  [▶ Start Now]   ← pinned, floats to top
└── Task Y  [queued 2h ago]      [▶ Start Now]   ← greyed out (already IN_PROGRESS)

🔒 LOCKED
└── Task W  [waiting on upstream member]
```

### Section Behaviour Rules:
| Section | SLA Running? | Member Can Act? | Notes |
|---|---|---|---|
| `IN_PROGRESS` | ✅ Yes | ✅ Yes — submit, checklist | Max 1 task here normally |
| `QUEUED` | ❌ No | ✅ Yes — pin ⭐, Start Now ▶ | Full queue visible. "Start Now" disabled if IN_PROGRESS ≥ 1 |
| `LOCKED` | ❌ No | ❌ No | Upstream not done yet |

### Sorting within QUEUED section:
1. Pinned tasks (⭐) always render first.
2. Then by `queued_at` ascending (oldest first).

---

## 6. Backend Logic Changes

### 6.1 Sequential Unlock Trigger (`task.helper.js`)
When Task N reaches `COMPLETED`, modify the unlock logic as follows:

```
Current logic:
  → Set Task N+1 status = IN_PROGRESS
  → Set assigned_at = now
  → Calculate due_date
  → Notify member

Updated logic:
  → Find Task N+1
  → Check member's IN_PROGRESS count

  IF count == 0 (member is idle):
    → Set Task N+1 status = IN_PROGRESS
    → Set assigned_at = now
    → Calculate due_date from turnaround_minutes
    → Notify member: "New task is ready"

  IF count >= 1 (member is busy):
    → Set Task N+1 status = QUEUED
    → Set queued_at = now
    → Do NOT set assigned_at or due_date yet
    → Notify member: "A new task is waiting in your queue"
```

### 6.2 Submit Endpoint (`POST /api/tasks/:id/submit`)
After the task is marked `COMPLETED` or moves to `PENDING_APPROVAL`, run the Auto-Pull check:

```
After submit:
  → Check member's remaining IN_PROGRESS count

  IF count == 0:
    → Query member's QUEUED tasks, sorted by:
        1. is_urgent DESC
        2. queued_at ASC
    → Pull the first result into IN_PROGRESS:
        → status = IN_PROGRESS
        → assigned_at = now
        → due_date = now + turnaround_minutes (excluding holidays)
        → queued_at = NULL
    → Notify member: "Your next task has started automatically"

  IF count >= 1:
    → No action. Member still has an active task.
```

### 6.3 New Endpoint: Member Self-Pull (`POST /api/tasks/:id/self-pull`) ⬅ NEW
Allows a member to manually pull a queued task into `IN_PROGRESS`.

```
POST /api/tasks/:id/self-pull
Authorization: Bearer <token>
Role required: member (own tasks only)
```

**Validation:**
- Task must be in `QUEUED` status.
- Task must be assigned to the requesting member.
- Member's current `IN_PROGRESS` count must be `0`. If not, return `409 Conflict`.

**On success:**
```json
{
  "message": "Task pulled into progress. SLA clock has started.",
  "task": { "...updatedTaskObject" }
}
```

**Error Responses:**
| Status | Reason |
|---|---|
| `400` | Task is not in QUEUED status |
| `403` | Task is not assigned to this member |
| `404` | Task not found |
| `409` | Member already has a task IN_PROGRESS — WIP limit enforced |
| `500` | Internal server error |

---

## 7. Test Cases & Expected Behaviors

### Test Case 1: The Idle Worker
- **Setup:** Member Alice has 0 active tasks. Task A completes; Task B is next and assigned to Alice.
- **Action:** Task B unlocks.
- **Expected Result:** System sees Alice is idle. Task B skips `QUEUED` and goes directly to `IN_PROGRESS`. SLA clock starts immediately.

### Test Case 2: The Busy Worker
- **Setup:** Member Bob has 1 task (`Task X`) in `IN_PROGRESS`. Task A completes; Task B is next and assigned to Bob.
- **Action:** Task B unlocks.
- **Expected Result:** System sees Bob is busy. Task B goes to `QUEUED` with `queued_at` timestamp set. SLA clock **does not** start. No penalty applies to Bob.

### Test Case 3: The Auto-Pull
- **Setup:** Member Bob has `Task X` in `IN_PROGRESS`. He has `Task Y` (queued 2h ago) and `Task Z` (queued 1h ago) in `QUEUED`.
- **Action:** Bob completes and submits `Task X`.
- **Expected Result:** Bob's active count drops to 0. System instantly pulls `Task Y` (oldest `queued_at`) into `IN_PROGRESS`. `Task Y`'s SLA clock officially starts. `Task Z` remains in `QUEUED`.

### Test Case 4: The Urgent Interrupt
- **Setup:** Member Charlie has `Task X` in `IN_PROGRESS`. An Admin triggers a "High Priority / Urgent" task (`Task U`) assigned to Charlie.
- **Action:** `Task U` is created.
- **Expected Result:** `Task U` completely bypasses the `QUEUED` state. It drops instantly into `IN_PROGRESS` alongside `Task X`. Charlie receives a loud UI notification: *"🚨 URGENT TASK ARRIVED."*

### Test Case 5: The Rejected Rework
- **Setup:** Member Diana has `Task X` in `IN_PROGRESS`. A Reviewer rejects Diana's previously submitted `Task Y`.
- **Action:** `Task Y` is rejected.
- **Expected Result:** `Task Y` does **not** go to `QUEUED`. It drops directly back into `IN_PROGRESS`. Diana now has `Task X` and `Task Y` active, with an alert: *"🚨 Task Rejected: Revisions Required."*

### Test Case 6: Multiple Queued Items Priority
- **Setup:** Member Eve has 3 tasks in `QUEUED`: Task 1 (queued 3h ago), Task 2 (queued 2h ago), Task 3 (queued 1h ago). Eve finishes her active task.
- **Action:** System executes Auto-Pull.
- **Expected Result:** Task 1 (oldest `queued_at`) is automatically pulled into `IN_PROGRESS`.

### Test Case 7: Member Self-Pull — Success
- **Setup:** Member Frank has 0 tasks in `IN_PROGRESS`. He has `Task Y` and `Task Z` in `QUEUED`. He pins `Task Z` (⭐) because he prefers to do it first.
- **Action:** Frank clicks "Start Now" on `Task Z`.
- **Expected Result:** `Task Z` moves to `IN_PROGRESS`. SLA clock starts. `Task Y` remains in `QUEUED`. The "Start Now" button on `Task Y` is now greyed out (WIP limit reached).

### Test Case 8: Member Self-Pull — Blocked by WIP
- **Setup:** Member Grace has `Task X` in `IN_PROGRESS` and `Task Y` in `QUEUED`.
- **Action:** Grace clicks "Start Now" on `Task Y`.
- **Expected Result:** Request returns `409 Conflict`. `Task Y` stays in `QUEUED`. UI shows "Start Now" as disabled with tooltip: *"Finish your active task first."*

### Test Case 9: The Hoarder (Future Feature Consideration)
- **Setup:** A task sits in `QUEUED` for over 24 hours because the member is working extremely slowly on their active task.
- **Expected Result:** (Currently, it just waits). *Future recommendation:* Add a Controller dashboard alert: *"Task in Queue > 24 Hours"* so the Controller can reassign it manually.

---

## 8. Notification Summary

| Trigger | Recipient | Message |
|---|---|---|
| Task moves to `QUEUED` | Member | *"A new task is waiting in your queue: [Task Title]"* |
| Auto-Pull fires | Member | *"Your next task has started automatically: [Task Title]. SLA clock is running."* |
| Member Self-Pull | Member | *"Task pulled into progress. SLA clock has started: [Task Title]."* |
| Urgent task assigned | Member | *"🚨 URGENT TASK ARRIVED: [Task Title]. Immediate attention required."* |
| Task rejected | Member | *"🚨 Task Rejected: [Task Title]. Revisions required immediately."* |