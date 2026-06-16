import { getSupabase } from "../../config/supabase.js";

export const createClient = async (c) => {
    try {
        const { name, email, phone, address, website, description, location, type } = await c.req.json();
        const company_id = c.get("user").company_id;
        if (!name || !email) return c.json({ message: "name and email are required" }, 400);
        const supabase = getSupabase(c.env);
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .insert({ name, email, phone, address, company_id, website, description, location, status: 'active', type: type || 'CLIENT' })
            .select().single();
        if (clientError) return c.json({ message: clientError.message }, 400);
        return c.json(client, 201);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const fetchClients = async (c) => {
    try {
        const { page, limit, search, type } = c.req.query();
        const supabase = getSupabase(c.env);

        let query = supabase.from("clients")
            .select("*", { count: 'exact' })
            .eq("company_id", c.get("user").company_id);

        if (type) {
            if (type === 'CLIENT') {
                query = query.or(`type.eq.CLIENT,type.is.null`);
            } else {
                query = query.eq('type', type);
            }
        }

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        if (page && limit) {
            const pageNum = parseInt(page, 10) || 1;
            const limitNum = parseInt(limit, 10) || 10;
            const from = (pageNum - 1) * limitNum;
            const to = from + limitNum - 1;
            query = query.range(from, to).order('created_at', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data: clients, error: clientsError, count } = await query;
        if (clientsError) return c.json({ message: clientsError.message }, 400);

        if (page && limit) {
            const limitNum = parseInt(limit, 10) || 10;
            return c.json({
                data: clients,
                pagination: {
                    totalCount: count,
                    totalPages: Math.ceil(count / limitNum)
                }
            }, 200);
        }

        return c.json(clients, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const updateClient = async (c) => {
    try {
        const id = c.req.param("id");
        const updates = await c.req.json();
        const company_id = c.get("user").company_id;


        // Optional validation if name/email are provided manually
        if (updates.name === "") return c.json({ message: "name cannot be empty" }, 400);
        if (updates.email === "") return c.json({ message: "email cannot be empty" }, 400);

        const supabase = getSupabase(c.env);
        const { data: client, error: clientError } = await supabase
            .from("clients")
            .update(updates)
            .eq("id", id).eq("company_id", company_id).select().single();
        if (clientError) return c.json({ message: clientError.message }, 400);
        return c.json(client, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};

export const deleteClient = async (c) => {
    try {
        const id = c.req.param("id");
        const supabase = getSupabase(c.env);
        const { error: clientError } = await supabase
            .from("clients").delete()
            .eq("id", id).eq("company_id", c.get("user").company_id);
        if (clientError) return c.json({ message: clientError.message }, 400);
        return c.json({ message: "Client deleted successfully" }, 200);
    } catch (error) {
        return c.json({ message: error.message }, 500);
    }
};