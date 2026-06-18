export const requireAdmin = async (c, next) => {
    const user = c.get("user");
    if (
        user?.platform_role !== "admin" &&
        user?.platform_role !== "controller" &&
        user?.platform_role !== "superadmin"
    ) {
        return c.json({ message: "Admin access required" }, 403);
    }
    await next();
};

export const requireSuperAdmin = async (c, next) => {
    const user = c.get("user");
    if (user?.platform_role !== "superadmin") {
        return c.json({ message: "Super Admin access required" }, 403);
    }
    await next();
};

/**
 * Workload endpoints are management-only.
 * Allowed: admin, controller, superadmin (platform_role)
 *          OR interim_manager (workflow_role on a member account)
 * Blocked: plain member accounts
 */
export const requireWorkloadAccess = async (c, next) => {
    const user = c.get("user");
    const allowedPlatformRoles = ["admin", "controller", "superadmin"];
    const isInterimManager = user?.workflow_role === "interim_manager";
    if (!allowedPlatformRoles.includes(user?.platform_role) && !isInterimManager) {
        return c.json({ message: "Workload access restricted to management roles" }, 403);
    }
    await next();
};

