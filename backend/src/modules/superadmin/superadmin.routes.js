import { Hono } from "hono";
import { getCompanies, createCompanyAndAdmin, getOnboardingRequests, approveOnboardingRequest, rejectOnboardingRequest, companydetailsbyid, getCompanyUsers, getSuperAdminStats, getSACompanyProjects, getSACompanyClients, getSACompanyTasks, impersonateUser } from "./superadmin.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireSuperAdmin } from "../../middleware/role.middleware.js";

const router = new Hono();

router.get("/companies", authenticate, requireSuperAdmin, getCompanies);
router.post("/companies", authenticate, requireSuperAdmin, createCompanyAndAdmin);

router.get("/onboarding-requests", authenticate, requireSuperAdmin, getOnboardingRequests);
router.put("/onboarding-requests/:id/approve", authenticate, requireSuperAdmin, approveOnboardingRequest);
router.put("/onboarding-requests/:id/reject", authenticate, requireSuperAdmin, rejectOnboardingRequest);

router.get("/company/details/:id", authenticate, requireSuperAdmin, companydetailsbyid);
router.get("/company/:id/users", authenticate, requireSuperAdmin, getCompanyUsers);
router.get("/company/:id/projects", authenticate, requireSuperAdmin, getSACompanyProjects);
router.get("/company/:id/clients", authenticate, requireSuperAdmin, getSACompanyClients);
router.get("/company/:id/tasks", authenticate, requireSuperAdmin, getSACompanyTasks);
router.get("/stats", authenticate, requireSuperAdmin, getSuperAdminStats);

// Impersonation
router.get("/impersonate/:id", authenticate, requireSuperAdmin, impersonateUser);

export default router;