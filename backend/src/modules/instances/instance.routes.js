import { Hono } from "hono";
import { createInstance, fetchInstances, fetchInstanceById, fetchInstanceByTaskId, pauseInstance, resumeInstance, setInstanceActive, cloneInstance, updateInstanceName } from "./instance.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

router.post("/instances", authenticate, createInstance);
router.get("/instances", authenticate, fetchInstances);
router.get("/instances/:id", authenticate, fetchInstanceById);
router.get("/instances/tasks/:task_id", authenticate, fetchInstanceByTaskId);
router.patch("/instances/:id/pause", authenticate, pauseInstance);
router.patch("/instances/:id/resume", authenticate, resumeInstance);
router.patch("/instances/:id/active", authenticate, setInstanceActive);
router.post("/instances/:id/clone", authenticate, cloneInstance);
router.post("/instances/:id/update-name", authenticate, updateInstanceName);


export default router;
