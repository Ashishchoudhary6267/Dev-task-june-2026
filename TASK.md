# Developer Assignment — FMS

Welcome, and thank you for taking the time to work on this assignment.

This is a **real, pre-existing codebase** (a workflow & task management system) written by another developer. The goal of this exercise is **not** to build something from scratch — it is to see how well you can **read unfamiliar code, understand how the pieces fit together, set the project up, and make focused changes** that respect the existing architecture.

Please read this whole document before you start.

---

## Part 0 — Getting it running (setup)

The project ships **without any keys or secrets** — this is intentional. Part of the task is to work out what configuration the app needs and provide your own.

1. Read the root [`README.md`](./README.md), then `backend/README.md` and `frontend/README.md`.
2. Stand up your own **Supabase** project and run `backend/schema.sql`.
3. Create the local secret/env files from the provided `.example` templates and fill in your own values. **Note:** the templates list the variables, but you should confirm against the code which ones are actually required and what each one does.
4. Get the **backend** running, seed the database (`node scripts/seed.js`), then get the **frontend** running and log in with a seed account.

> ✅ **Deliverable for Part 0:** the app runs locally and you can log in. In your write-up, list every environment variable you had to supply and briefly say what each is for.

---

## Part 1 — Understand the system (write-up)

In a short document (`SOLUTION.md`), answer in your own words:

1. **Workflow engine:** How does a task move from one step to the next? What unlocks the next task, and where in the code does that happen?
2. **Approvals:** How do the multi-level approvals work? What happens to a task when a reviewer rejects it?
3. **Roles:** What are the platform roles, and how does the app route a user to the correct dashboard after login?
4. **Request flow:** Trace a single API call end to end — from the frontend (which file makes the request) through the backend (route → controller → database) and back.

Keep it concise. We are looking for genuine understanding, not length.

---

## Part 2 — Make a change (coding)

Pick the task assigned to you by the hiring team. If none was specified, complete **Task A**.

### Task A — Add a "task notes" field
Allow a note/comment to be attached to a task.
- Add a `notes` text column to the relevant table (provide the SQL).
- Expose it through the backend (an endpoint to read/update the note).
- Surface it in the frontend on the task view (display + edit).

### Task B — Add a simple filter
On a task list of your choosing, add a filter (e.g. by status or by assigned user) that works end to end — UI control → API query parameter → database query.

### Task C — (Open) Propose your own
If you see something you'd improve, propose a small, well-scoped change and implement it. Clear it with the hiring team first.

**Whichever task you do, we care about:**
- Does it follow the existing patterns (module structure, how other endpoints/components are written)?
- Is the data flow correct and complete (UI ↔ API ↔ DB)?
- Is the change minimal and focused — no unrelated rewrites?
- Clear commit history and a short explanation of your approach.

---

## What to submit

- Your code changes (as a branch/PR or a zip, per the hiring team's instructions).
- `SOLUTION.md` containing: the Part 1 write-up, the list of env vars from Part 0, what you changed in Part 2 and why, and anything you'd improve with more time.

## Ground rules

- You may use any documentation, and AI tools are allowed — but **you must understand and be able to explain every change you submit.** We will discuss your code with you.
- Don't commit real secrets. The `.gitignore` files already exclude `.env` and `.dev.vars`.
- If you get genuinely stuck on setup, document what you tried — partial progress with good reasoning still counts.

Good luck — we're looking forward to seeing how you work.
