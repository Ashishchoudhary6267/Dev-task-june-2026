# Notifications & Real-Time Updates

The FMS application provides real-time awareness and immediate feedback to users regarding task assignments, approvals, exceptions (like bypasses or SLA extensions), and general system alerts. Below are the details on how these mechanics are built and how to use them.

## 1. Internal In-App Notifications

### The Engine
Every time an actionable event occurs on the backend (e.g., inside the `task.controller.js` routes), the backend automatically inserts a new row into the `notifications` PostgreSQL table via Supabase.

### SuperAdmin Frontend Integration
- **`useNotificationStore` state:** Located in `src/lib/zustand/notifications/notifications.ts`.
- **Fetching:** The UI fetches historical notifications on mount.
- **Supabase Realtime Subscriptions:** The `useNotificationStore` executes `subscribeRealtime`. This opens a continuous WebSocket (`supabase.channel().on('postgres_changes', ...)`).
- **Notification Bell UI:** The visually persistent `<NotificationBell />` in the top right will display an unread badge and play a sound `/public/noti.mp3` when a `.insert` event on the `notifications` table matches the active user's ID. 
- **OS Notifications:** With browser notification permissions granted, native standard desktop push alerts are triggered.

## 2. Global Soft-Refresh Prompt (`UpdatePrompt`)

We have implemented an unobtrusive **Global Updates Prompt** to ensure the active UI layout stays perfectly synchronized with any background events (like another member completing a task on an ongoing instance).

### How it Works
1. When the `NotificationBell` detects an incoming notification via the WebSocket, it invokes the `useUpdateStore` (Zustand: `src/lib/zustand/updates/updates.ts`) and sets `hasUpdates = true`.
2. A sleek, animated `<UpdatePrompt />` component suddenly materializes at the top of the user's dashboard.
3. Once the user clicks "New Updates Available - Click to Refresh", a "soft-refresh" happens:
   - Instead of a hard `window.location.reload()` (which is jarring and would blow away un-saved form states or active modals), the active layout re-fires its specific frontend fetches.
   - For example, if the Controller is on the `instances` tab, clicking the prompt calls `fetchInstances()` seamlessly.
   - The UI updates instantly via React hydration and the prompt goes away.

This "Soft Refresh" guarantees user state safety, preventing any active forms or chat boxes from forcefully crashing or emptying themselves simply because another user moved a task forward in the background.

## 3. PWA Push Notifications (Background)

In addition to the WebSockets, FMS uses native Web Push API and VAPID architecture for Progressive Web App capabilities, sending alerts directly to devices when the tab is fully closed.

- Device subscription models and keys are bound directly to the user profile table in PostgreSQL.
- Handled actively via service workers (`sw.js`).
