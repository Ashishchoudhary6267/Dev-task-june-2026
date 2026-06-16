import { TIER_LIMITS } from "./tier_limits.js";

/**
 * Checks if a company has reached its subscription limits for a specific resource type.
 * @param {object} supabase - Supabase client instance
 * @param {string} company_id - The ID of the company to check
 * @param {'users' | 'projects' | 'instances'} resourceType - The type of resource being created
 * @throws {Error} if the limit is reached or subscription is expired
 */
export const checkSubscriptionLimits = async (supabase, company_id, resourceType) => {
    const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("tier, subscription_end_date")
        .eq("id", company_id)
        .single();

    if (companyError || !company) throw new Error("Company not found");

    // 1. Check Expiration
    if (company.subscription_end_date && new Date(company.subscription_end_date) < new Date()) {
        const error = new Error("Your subscription has expired. Please contact superadmin to renew.");
        error.status = 403;
        throw error;
    }

    // 2. Check Resource Limits
    const limits = TIER_LIMITS[company.tier] || TIER_LIMITS.starter;
    let maxCount = Infinity;
    let table = "";
    let resourceName = "";
    
    if (resourceType === 'users') {
        maxCount = limits.maxUsers;
        table = "users";
        resourceName = "User";
    } else if (resourceType === 'projects') {
        maxCount = limits.maxProjects;
        table = "projects";
        resourceName = "Project";
    } else if (resourceType === 'instances') {
        maxCount = limits.maxInstances;
        table = "instances";
        resourceName = "Instance";
    }

    if (maxCount !== Infinity) {
        let query = supabase
            .from(table)
            .select("*", { count: "exact", head: true })
            .eq("company_id", company_id);
            
        // For users, only count active ones
        if (resourceType === 'users') {
            query = query.eq("is_active", true);
        }
        
        const { count, error: countError } = await query;
        if (countError) throw countError;

        if (count >= maxCount) {
            const error = new Error(`${resourceName} limit reached for ${company.tier} plan (${maxCount}). Please upgrade your plan.`);
            error.status = 403;
            throw error;
        }
    }
};
