import { Hono } from "hono";
import { getTeamPerformance, getMemberTasks, getWorkloadData, getRejectionSummary, getMemberRejections, getTaskRejectionDetails, getWorkloadSummary, getMemberWorkloadDetail } from "./performance.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireWorkloadAccess } from "../../middleware/role.middleware.js";

const router = new Hono();

router.get("/team", authenticate, getTeamPerformance);
router.get("/member/:userId", authenticate, getMemberTasks);
router.get("/workload", authenticate, getWorkloadData);
router.get("/workload/summary", authenticate, requireWorkloadAccess, getWorkloadSummary);
router.get("/workload/detail/:userId", authenticate, requireWorkloadAccess, getMemberWorkloadDetail);
router.get("/rejections/summary", authenticate, getRejectionSummary);
router.get("/member/:userId/rejections", authenticate, getMemberRejections);
router.get("/task/:taskId/rejection-details", authenticate, getTaskRejectionDetails);

export default router;
