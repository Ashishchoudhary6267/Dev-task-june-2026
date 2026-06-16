import { Hono } from "hono";
import { getHolidays, createHoliday, deleteHoliday } from "./holiday.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.get("/", authenticate, getHolidays);
router.post("/", authenticate, requireAdmin, createHoliday);
router.delete("/:id", authenticate, requireAdmin, deleteHoliday);

export default router;
