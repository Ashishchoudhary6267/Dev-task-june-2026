import { Hono } from "hono";
import { getUserActivityReport, getTaskPerformanceReport } from "./report.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.get("/user-activity", authenticate, requireAdmin, getUserActivityReport);
router.get("/task-performance", authenticate, requireAdmin, getTaskPerformanceReport);

export default router;
