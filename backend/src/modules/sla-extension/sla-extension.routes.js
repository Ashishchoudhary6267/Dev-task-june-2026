import { Hono } from "hono";
import {
    requestSLAExtension,
    getSLAExtensionRequests,
    approveSLAExtensionRequest,
    rejectSLAExtensionRequest,
    getTaskSLAExtensionHistory,
    getMySLAExtensionRequests
} from "./sla-extension.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

// Member requests SLA extension
router.post("/tasks/:id/request-sla-extension", authenticate, requestSLAExtension);

// Member gets their own SLA extension requests
router.get("/sla-extension-requests/my", authenticate, getMySLAExtensionRequests);

// Get all pending SLA extension requests (for controller)
router.get("/sla-extension-requests", authenticate, getSLAExtensionRequests);

// Controller approves request
router.post("/sla-extension-requests/:id/approve", authenticate, approveSLAExtensionRequest);

// Controller rejects request
router.post("/sla-extension-requests/:id/reject", authenticate, rejectSLAExtensionRequest);

// Get SLA extension history for a specific task
router.get("/tasks/:id/sla-extension-requests", authenticate, getTaskSLAExtensionHistory);

export default router;

