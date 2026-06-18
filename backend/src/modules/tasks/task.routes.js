import { Hono } from "hono";
import {
    reassigntaskbycontroller,
    reassignapproverbycontroller,
    bypassTaskController,
    extendTaskSLA,
    addTaskComment,
    manualUnlockTask,
    updateTaskApprovalLevels,
    reopenTaskForClientRevision,
    updateTaskNote,
} from "./task.controller.js";
import {
    fetchTasksByProject,
    fetchMyTasks,
    fetchTasksforMember,
    fetchOverdueTasksForMember,
    fetchusertaskfordeletion,
    fetchTaskById
} from "./task.query.controller.js";
import { createManualTask, fetchManualTasks, updateManualTask, deleteManualTask } from "./task.manual.controller.js";
import { submitTask, approveTask, rejectTask, toggleChecklistItem } from "./task.workflow.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

router.get("/", authenticate, fetchTasksByProject);
router.get("/member", authenticate, fetchTasksforMember);
router.get("/member/overdue", authenticate, fetchOverdueTasksForMember);
router.get("/my-tasks", authenticate, fetchMyTasks);
router.get("/detail/:id", authenticate, fetchTaskById);

// Manual tasks — must be before /:id wildcard routes
router.post("/manual", authenticate, createManualTask);
router.get("/manual", authenticate, fetchManualTasks);
router.put("/manual/:id", authenticate, updateManualTask);
router.delete("/manual/:id", authenticate, deleteManualTask);

router.post("/:id/submit", authenticate, submitTask);
router.post("/:id/approve", authenticate, approveTask);
router.post("/:id/reject", authenticate, rejectTask);
router.patch("/:id/checklist/:itemId", authenticate, toggleChecklistItem);
router.post("/:id/reassign", authenticate, reassigntaskbycontroller);
router.post("/:id/bypass", authenticate, bypassTaskController);
router.put("/:id/extend-sla", authenticate, extendTaskSLA);
router.post("/:id/comments", authenticate, addTaskComment);
router.get("/user-tasks/:user_id", authenticate, fetchusertaskfordeletion);
router.post("/:id/reassign-approver", authenticate, reassignapproverbycontroller);
router.put("/:id/approval-levels", authenticate, updateTaskApprovalLevels);
router.post("/:id/manual-unlock", authenticate, manualUnlockTask);
router.post("/:id/reopen-for-revision", authenticate, reopenTaskForClientRevision);
router.put("/:id/notes", authenticate, updateTaskNote);


router.get('/user-tasks/:user_id', authenticate, fetchusertaskfordeletion)

export default router;
