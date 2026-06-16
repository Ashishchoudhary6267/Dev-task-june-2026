import { Hono } from "hono";
import { sendControllerNotification, getAllNotifications } from "./notification.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

router.post("/send", authenticate, sendControllerNotification);
router.get("/all", authenticate, getAllNotifications);

export default router;
