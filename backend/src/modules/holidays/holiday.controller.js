import { getSupabase } from "../../config/supabase.js";

// Get all holidays for a company
export const getHolidays = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: 'Unauthorized' }, 401);
        const company_id_param = c.req.query("company_id");
        let company_id = null;
        if (authUser.platform_role === "superadmin" && company_id_param) {
            company_id = company_id_param;
        } else {
            company_id = authUser.company_id;
        }

        const supabase = getSupabase(c.env);
        const { data: holidays, error } = await supabase
            .from('company_holidays')
            .select('*')
            .eq('company_id', company_id)
            .order('holiday_date', { ascending: true });

        if (error) throw error;

        return c.json(holidays || [], 200);
    } catch (error) {
        console.error('Error fetching holidays:', error);
        return c.json({ message: 'Server error', error: error.message }, 500);
    }
};

// Create a new holiday
export const createHoliday = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

        const { date, name, description, type } = await c.req.json();
        if (!date || !name) {
            return c.json({ message: 'Date and Title are required' }, 400);
        }

        if (authUser.platform_role !== 'admin' && authUser.platform_role !== 'superadmin') {
            return c.json({ message: 'Only admins can add holidays' }, 403);
        }

        const supabase = getSupabase(c.env);
        const { data: newHoliday, error } = await supabase
            .from('company_holidays')
            .insert([{
                company_id: authUser.company_id,
                holiday_date: date,
                name,
                description,
                type: type || 'One-time'
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return c.json({ message: 'A holiday already exists for this date.' }, 400);
            }
            throw error;
        }

        return c.json(newHoliday, 201);
    } catch (error) {
        console.error('Error creating holiday:', error);
        return c.json({ message: 'Server error', error: error.message }, 500);
    }
};

// Delete a holiday
export const deleteHoliday = async (c) => {
    try {
        const authUser = c.get("user");
        if (!authUser) return c.json({ message: 'Unauthorized' }, 401);

        const id = c.req.param("id");

        if (authUser.platform_role !== 'admin' && authUser.platform_role !== 'superadmin') {
            return c.json({ message: 'Only admins can delete holidays' }, 403);
        }

        const supabase = getSupabase(c.env);
        const { error } = await supabase
            .from('company_holidays')
            .delete()
            .eq('id', id)
            .eq('company_id', authUser.company_id); // Ensure they can only delete their own company's holiday

        if (error) throw error;

        return c.json({ message: 'Holiday deleted successfully' }, 200);
    } catch (error) {
        console.error('Error deleting holiday:', error);
        return c.json({ message: 'Server error', error: error.message }, 500);
    }
};
