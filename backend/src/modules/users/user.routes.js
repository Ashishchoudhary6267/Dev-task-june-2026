import { Hono } from "hono";
import { addUser, createNewUser, deactivateuser, getallusers, updateuser } from "./user.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.post("/", authenticate, requireAdmin, createNewUser);
router.get("/fetchallusers", authenticate, getallusers);
router.post("/adduser", authenticate, requireAdmin, addUser);
router.put("/updateuser", authenticate, requireAdmin, updateuser);
router.put("/deactivateuser", authenticate, requireAdmin, deactivateuser);

export default router;
