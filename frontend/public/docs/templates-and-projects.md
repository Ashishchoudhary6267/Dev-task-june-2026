# FMS — Templates & Projects

## Concepts

- **Project (Template)**: A reusable blueprint that defines a workflow. Contains an ordered list of Template Tasks.(You can consider it as in the concept of classes and objects)
- **Template Task**: A single step in the blueprint. Defines: title, role, estimated time, turnaround time, checklist items, and approval requirements.(You can consider it as in the concept of attributes of a class)
- **Instance**: A live deployment of a project template (see `instance-workflows.md`).(You can consider it as in the concept of objects)

---

## Project Data Shape

```typescript
interface Project {
  id: string;
  name: string;
  client_name: string;
  description: string;
  company_id: string;
  status: string;
  category: string;
  start_date: string;
  end_date: string;
  type: string;             // e.g. 'recurring', 'one-time'
}
```

---

## Template Task Data Shape

```typescript
interface TaskDraft {
  id?: string;
  title: string;
  description: string;
  step_order: number;          // Sequential position (1, 2, 3...)
  estimated_minutes: number;   // How long the task should take
  turnaround_minutes: number;  // SLA deadline for this step
  turnaround_unit?: 'Minutes' | 'Hours' | 'Days';
  approval_required: boolean;
  approval_levels: number;     // 1–5 levels of approval
  assigned_role: string;       // Matched against users' workflow_role
  checklist: boolean;
  checklist_items: ChecklistItemDraft[];
}
```

---

## Template API Endpoints

All project routes require `Admin` role (`requireAdmin` middleware).

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/addproject` | Create a new project template |
| `GET` | `/api/fetchallprojects` | Fetch all templates for the company |
| `GET` | `/api/fetchprojectbyid/:id` | Fetch a single project with its template tasks |
| `DELETE` | `/api/deleteproject/:id` | Delete a project template |
| `POST` | `/api/copytemplate/:id` | Duplicate an existing template |

### Template Task Management
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/template-tasks` | Add a template task to a project |
| `GET` | `/api/template-tasks/:project_id` | Fetch all tasks for a project |
| `PUT` | `/api/template-tasks/:id` | Update a template task |
| `DELETE` | `/api/template-tasks/:id` | Delete a template task |

### Checklist Items
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/template-tasks/:id/checklist` | Add a checklist item to a template task |
| `DELETE` | `/api/template-tasks/:id/checklist/:itemId` | Remove a checklist item |

---

## Common Issues

| Problem | Likely Cause | Resolution |
|---|---|---|
| Template has no tasks after creating instance | Template tasks were not added before spawning | Add template tasks first, then create the instance |
| Task roles not auto-assigning | No user in the company has matching `workflow_role` | Assign `workflow_role` to team members from Admin user settings |
| Checklist items not appearing in live tasks | Checklist items added as `requires_input = true` but frontend not rendering input fields | Check the `task_checklist_progress` data includes `requires_input`, `input_label`, and `input_placeholder` |
