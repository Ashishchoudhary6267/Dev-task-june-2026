import { Hono } from "hono";
import { getDashboardStats, getTeamPerformance } from "./dashboard.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

router.get("/stats", authenticate, getDashboardStats);
router.get("/team-performance", authenticate, getTeamPerformance);

export default router;
