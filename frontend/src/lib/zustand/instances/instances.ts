import { create } from 'zustand';
import api from '@/lib/api';
import { Instance, TemplateTask, InstanceTaskAssignment } from '@/lib/types/auth';

interface FetchInstancesParams {
    company_id?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'scheduled' | 'paused' | 'completed' | null;
    client_id?: string | null;
    project_id?: string | null;
    from_date?: string;
    to_date?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    has_rejected_task?: boolean;
}

interface InstanceState {
    instances: Instance[];
    instancesCount: number;
    totalPages: number;
    statusCounts: { active: number; scheduled: number; paused: number; completed: number };
    instanceLoading: boolean;
    error: string | null;
    lastFetchParams: FetchInstancesParams;

    templateTasks: TemplateTask[];
    templateTasksLoading: boolean;
    templateTasksinstanceLoading: boolean;

    fetchInstances: (params?: FetchInstancesParams) => Promise<void>;
    createInstance: (payload: {
        project_id: string;
        company_id: string;
        client_id?: string;
        name: string;
        scheduled_at?: string;
        task_assignments: InstanceTaskAssignment[];
        recurrence_interval?: string;
        recurrence_end_date?: string;
    }) => Promise<boolean>;

    fetchTemplateTasks: (project_id: string) => Promise<void>;
    addTemplateTask: (task: any) => Promise<boolean>;
    updateTemplateTask: (id: string, task: Partial<Omit<TemplateTask, 'checklist_items'> & { checklist_items?: string[] }>) => Promise<boolean>;
    deleteTemplateTask: (id: string) => Promise<boolean>;

    // Checklist CRUD for template tasks
    addChecklistItem: (template_task_id: string, item_text: string) => Promise<boolean>;
    deleteChecklistItem: (template_task_id: string, item_id: string) => Promise<boolean>;

    pauseInstance: (id: string, reason?: string) => Promise<boolean>;
    resumeInstance: (id: string) => Promise<boolean>;
    setInstanceActive: (id: string) => Promise<boolean>;
    cloneInstance: (id: string, newName: string, newClientId: string) => Promise<boolean>;
    updateInstanceName: (id: string, name: string) => Promise<boolean>;
}

export const useInstanceStore = create<InstanceState>((set, get) => ({
    instances: [],
    instancesCount: 0,
    totalPages: 1,
    statusCounts: { active: 0, scheduled: 0, paused: 0, completed: 0 },
    instanceLoading: false,
    error: null,
    lastFetchParams: {},
    templateTasks: [],
    templateTasksLoading: false,
    templateTasksinstanceLoading: false,

    fetchInstances: async (params?: FetchInstancesParams) => {
        const fetchParams = params || get().lastFetchParams || {};
        set({ instanceLoading: true, error: null, lastFetchParams: fetchParams });
        try {
            const { data } = await api.get('/instances', {
                params: {
                    ...(fetchParams?.company_id && { company_id: fetchParams.company_id }),
                    page: fetchParams?.page ?? 1,
                    limit: fetchParams?.limit ?? 10,
                    ...(fetchParams?.search && { search: fetchParams.search }),
                    ...(fetchParams?.status && { status: fetchParams.status }),
                    ...(fetchParams?.client_id && fetchParams.client_id !== 'all' && { client_id: fetchParams.client_id }),
                    ...(fetchParams?.project_id && fetchParams.project_id !== 'all' && { project_id: fetchParams.project_id }),
                    ...(fetchParams?.from_date && { from_date: fetchParams.from_date }),
                    ...(fetchParams?.to_date && { to_date: fetchParams.to_date }),
                    ...(fetchParams?.sort_by && { sort_by: fetchParams.sort_by }),
                    ...(fetchParams?.sort_order && { sort_order: fetchParams.sort_order }),
                    ...(fetchParams?.has_rejected_task && { has_rejected_task: fetchParams.has_rejected_task }),
                }
            });
            set({
                instances: data.data,
                instancesCount: data.count,
                totalPages: data.totalPages ?? 1,
                statusCounts: data.statusCounts ?? { active: 0, scheduled: 0, paused: 0, completed: 0 },
                instanceLoading: false,
            });
        } catch (err: any) {
            set({ error: err.response?.data?.message || 'Failed to fetch instances', instanceLoading: false });
        }
    },

    createInstance: async (payload) => {
        set({ instanceLoading: true, error: null });
        try {
            await api.post('/instances', payload);
            await get().fetchInstances();
            set({ instanceLoading: false });
            return true;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to create instance';
            set({ error: message, instanceLoading: false });
            throw err;
        }
    },

    fetchTemplateTasks: async (project_id) => {
        set({ templateTasksinstanceLoading: true });
        try {
            const { data } = await api.get(`/template-tasks/${project_id}`);
            set({ templateTasks: data.data });
        } catch {
            // handle error
        } finally {
            set({ templateTasksinstanceLoading: false });
        }
    },

    addTemplateTask: async (task) => {
        try {
            set({ templateTasksinstanceLoading: true });
            const { data } = await api.post('/template-tasks', task);
            if (Array.isArray(data)) {
                await get().fetchTemplateTasks(task.project_id);
            } else {
                set(s => ({ templateTasks: [...s.templateTasks, data] }));
            }
            return true;
        } catch {
            return false;
        } finally {
            set({ templateTasksinstanceLoading: false });
        }
    },

    updateTemplateTask: async (id, task) => {
        try {
            set({ templateTasksinstanceLoading: true });
            const { data } = await api.put(`/template-tasks/${id}`, task);
            set(s => ({ templateTasks: s.templateTasks.map(t => t.id === id ? { ...t, ...data } : t) }));
            return true;
        } catch {
            return false;
        } finally {
            set({ templateTasksinstanceLoading: false });
        }
    },

    deleteTemplateTask: async (id) => {
        try {
            await api.delete(`/template-tasks/${id}`);
            set(s => ({ templateTasks: s.templateTasks.filter(t => t.id !== id) }));
            return true;
        } catch {
            return false;
        }
    },

    addChecklistItem: async (template_task_id, item_text) => {
        try {
            const { data } = await api.post(`/template-tasks/${template_task_id}/checklist`, { item_text });
            set(s => ({
                templateTasks: s.templateTasks.map(t =>
                    t.id !== template_task_id ? t : {
                        ...t,
                        checklist_items: [...(t.checklist_items || []), data],
                    }
                ),
            }));
            return true;
        } catch {
            return false;
        }
    },

    deleteChecklistItem: async (template_task_id, item_id) => {
        try {
            await api.delete(`/template-tasks/${template_task_id}/checklist/${item_id}`);
            set(s => ({
                templateTasks: s.templateTasks.map(t =>
                    t.id !== template_task_id ? t : {
                        ...t,
                        checklist_items: (t.checklist_items || []).filter(i => i.id !== item_id),
                    }
                ),
            }));
            return true;
        } catch {
            return false;
        }
    },

    pauseInstance: async (id, reason) => {
        try {
            await api.patch(`/instances/${id}/pause`, { reason });
            await get().fetchInstances(get().lastFetchParams);
            return true;
        } catch {
            return false;
        }
    },

    resumeInstance: async (id) => {
        try {
            await api.patch(`/instances/${id}/resume`);
            await get().fetchInstances(get().lastFetchParams);
            return true;
        } catch {
            return false;
        }
    },
    setInstanceActive: async (id) => {
        try {
            await api.patch(`/instances/${id}/active`);
            await get().fetchInstances(get().lastFetchParams);
            return true;
        } catch {
            return false;
        }
    },
    cloneInstance: async (id, newName, newClientId) => {
        try {
            await api.post(`/instances/${id}/clone`, { newName, newClientId });
            await get().fetchInstances(get().lastFetchParams);
            return true;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to clone instance';
            set({ error: message });
            throw err;
        }
    },
    updateInstanceName: async (id, name) => {
        try {
            await api.post(`/instances/${id}/update-name`, { name });
            await get().fetchInstances(get().lastFetchParams);
            return true;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Failed to update instance name';
            set({ error: message });
            throw err;
        }
    },
}));
