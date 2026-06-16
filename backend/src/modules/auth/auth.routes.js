import { Hono } from "hono";
import { login, googleLogin, forgotPassword, resetPassword, changePasswordByAdmin } from "./auth.controller.js";
import { getPermissionsByUser, updatePermissions } from "./permissions.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = new Hono();

router.post("/login", login);
router.post("/google-login", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Permissions
router.get("/permissions/:user_id", authenticate, getPermissionsByUser);
router.post("/permissions", authenticate, updatePermissions);

// admin change passwrod
router.patch("/change-password-by-admin", authenticate, changePasswordByAdmin);

export default router;
