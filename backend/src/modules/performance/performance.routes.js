import { Hono } from "hono";
import { getTeamPerformance, getMemberTasks, getWorkloadData, getRejectionSummary, getMemberRejections, getTaskRejectionDetails } from "./performance.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

router.get("/team", authenticate, getTeamPerformance);
router.get("/member/:userId", authenticate, getMemberTasks);
router.get("/workload", authenticate, getWorkloadData);
router.get("/rejections/summary", authenticate, getRejectionSummary);
router.get("/member/:userId/rejections", authenticate, getMemberRejections);
router.get("/task/:taskId/rejection-details", authenticate, getTaskRejectionDetails);

export default router;
