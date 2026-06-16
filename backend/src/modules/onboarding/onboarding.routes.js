import { Hono } from "hono";
import { submitOnboardingRequest } from "./onboarding.controller.js";

const router = new Hono();

// Public endpoint — no authentication required
router.post("/register", submitOnboardingRequest);

export default router;
