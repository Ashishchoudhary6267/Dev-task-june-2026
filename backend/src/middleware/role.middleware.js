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
