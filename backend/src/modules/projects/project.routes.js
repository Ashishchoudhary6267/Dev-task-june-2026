import { Hono } from "hono";
import { addProject, updateProject, fetchprojectbyid, fetchprojects, addTemplateTask, fetchTemplateTasks, updateTemplateTask, deleteTemplateTask, addChecklistItem, editChecklistItem, deleteChecklistItem, deleteProject, copyTemplate, addLiveChecklistItem, editLiveChecklistItem, deleteLiveChecklistItem } from "./projects.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.post("/addproject", authenticate, requireAdmin, addProject);
router.put("/updateproject/:id", authenticate, requireAdmin, updateProject);
router.get("/fetchallprojects", authenticate, fetchprojects);
router.get("/fetchprojectbyid/:id", authenticate, requireAdmin, fetchprojectbyid);

router.post("/template-tasks", authenticate, requireAdmin, addTemplateTask);
router.get("/template-tasks/:project_id", authenticate, requireAdmin, fetchTemplateTasks);
router.put("/template-tasks/:id", authenticate, requireAdmin, updateTemplateTask);
router.delete("/template-tasks/:id", authenticate, requireAdmin, deleteTemplateTask);

router.post("/template-tasks/:id/checklist", authenticate, addChecklistItem);
router.put("/template-tasks/:id/checklist/:itemId", authenticate, editChecklistItem);
router.delete("/template-tasks/:id/checklist/:itemId", authenticate, deleteChecklistItem);

// Live Instance Checklist Management
router.post("/tasks/:id/checklist", authenticate, addLiveChecklistItem);
router.put("/tasks/:id/checklist/:itemId", authenticate, editLiveChecklistItem);
router.delete("/tasks/:id/checklist/:itemId", authenticate, deleteLiveChecklistItem);

router.delete("/deleteproject/:id", authenticate, requireAdmin, deleteProject);
router.post("/copytemplate/:id", authenticate, requireAdmin, copyTemplate);

export default router;