import { Hono } from "hono";
import { createClient, fetchClients, updateClient, deleteClient } from "./client.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.post("/createClient", authenticate, requireAdmin, createClient);
router.get("/fetchClients", authenticate, fetchClients);
router.put("/updateClient/:id", authenticate, requireAdmin, updateClient);
router.put("/deleteClient/:id", authenticate, requireAdmin, deleteClient);

export default router;