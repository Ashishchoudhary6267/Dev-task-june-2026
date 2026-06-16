import { Hono } from "hono";
import { getCompanyInfo, getCompanySettings, updateCompany, updateCompanySettings, getNotificationSettings, updateNotificationSettings } from "./company.controller.js";
import { getTatSettings, updateTatSettings, checkOverdueTasksHandler } from "./tat-settings.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.put("/updateCompanyInfo", authenticate, updateCompany);
router.get("/getCompanyInfo", authenticate, getCompanyInfo);
router.get("/getCompanySettings", authenticate, getCompanySettings);
router.put("/updateCompanySettings", authenticate, updateCompanySettings);
router.get("/companies/notification-settings", authenticate, getNotificationSettings);
router.patch("/companies/notification-settings", authenticate, updateNotificationSettings);

// TAT Review Window settings
router.get("/companies/tat-settings", authenticate, getTatSettings);
router.patch("/companies/tat-settings", authenticate, updateTatSettings);

// Internal secured endpoint — called by Cloudflare scheduled() or Supabase pg_cron
router.post("/internal/check-overdue-tasks", checkOverdueTasksHandler);

export default router;
