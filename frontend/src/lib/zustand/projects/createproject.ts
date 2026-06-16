import { create } from 'zustand';
import api from '@/lib/api';
// import { User } from '@/lib/types/auth';
import { Project } from '@/lib/types/auth';

interface ProjectState {
    projects: Project[];
    detailedProject: Project | null;
    projectscount: number;
    projectspage: number;
    projectstotalpages: number;
    projectsloading: boolean;
    projectserror: string | null;

    fetchprojects: (params?: {
        page?: number;
        limit?: number;
        search?: string;
        type?: string;
        status?: string;
        category?: string;
        sortBy?: string;
        company_id?: string
    }) => Promise<void>;
    deleteproject: (id: string) => Promise<boolean>;
    fetchprojectbyid: (id: string) => Promise<void>;
    copyTemplate: (id: string) => Promise<boolean>;
    addProject: (
        name: string,
        // client_id: string,
        category: string,
        description: string,
        company_id: string,
        start_date: Date,
        template_type: string,
    ) => Promise<boolean>;
    updateProject: (id: string, payload: Partial<Project>) => Promise<boolean>;
}

export const useProjectStore = create<ProjectState>((set) => ({
    projects: [],
    projectscount: 0,
    projectspage: 1,
    projectstotalpages: 1,
    detailedProject: null,
    projectsloading: false,
    projectserror: null,

    // ✅ Fetch all projects with pagination
    fetchprojects: async (params = {}) => {
        set({ projectsloading: true, projectserror: null });

        try {
            const { data } = await api.get('/fetchallprojects', {
                params: {
                    page: params.page || 1,
                    limit: params.limit || 10,
                    search: params.search,
                    type: params.type,
                    status: params.status,
                    category: params.category,
                    sortBy: params.sortBy,
                    company_id: params.company_id
                }
            });

            set({
                projects: data.data,
                projectscount: data.count,
                projectspage: data.page,
                projectstotalpages: data.totalPages,
                projectsloading: false,
            });
        } catch (err: any) {
            set({
                projectserror: err.response?.data?.message || 'Failed to fetch projects',
                projectsloading: false,
            });
        }
    },
    fetchprojectbyid: async (id: string) => {
        set({ projectsloading: true, projectserror: null });

        try {
            const { data } = await api.get(`/fetchprojectbyid/${id}`);

            set({
                detailedProject: data,
                projectsloading: false,
            });
        } catch (err: any) {
            set({
                projectserror: err.response?.data?.message || 'Failed to fetch projects',
                projectsloading: false,
            });
        }
    },
    // ✅ Add new user and update state immediately
    addProject: async (
        name,
        // client_id,
        category,
        description,
        company_id,
        start_date,
        template_type
    ) => {
        set({ projectsloading: true, projectserror: null });

        try {
            const { data } = await api.post('/addproject', {
                name,
                // client_id,
                category,
                description,
                company_id,
                start_date,
                template_type,
            });

            // 🔥 Append new user to existing projects array
            set((state) => ({
                projects: [...state.projects, data],
                projectscount: state.projectscount + 1,
                projectsloading: false,
            }));

            return true;
        } catch (err: any) {
            set({
                projectserror: err.response?.data?.message || 'Failed to add project',
                projectsloading: false,
            });
            return false;
        }
    },

    copyTemplate: async (id: string) => {
        set({ projectsloading: true, projectserror: null });

        try {
            const { data } = await api.post(`/copytemplate/${id}`);

            set((state) => ({
                projects: [...state.projects, data],
                projectscount: state.projectscount + 1,
                projectsloading: false,
            }));
            return true;
        } catch (err: any) {
            set({
                projectserror: err.response?.data?.message || 'Failed to copy template',
                projectsloading: false,
            });
            return false;
        }
    },


    deleteproject: async (id: string) => {
        set({ projectsloading: true, projectserror: null });

        try {
            await api.delete(`/deleteproject/${id}`);

            set((state) => ({
                projects: state.projects.filter((p) => p.id !== id),
                projectscount: state.projectscount - 1,
                projectsloading: false,
            }));
            return true;
        } catch (err: any) {
            set({
                projectserror: err.response?.data?.message || 'Failed to delete project',
                projectsloading: false,
            });
            return false;
        }
    },
    updateProject: async (id: string, payload: Partial<Project>) => {
        set({ projectsloading: true, projectserror: null });
        try {
            const { data } = await api.put(`/updateproject/${id}`, payload);
            set((state) => ({
                projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
                detailedProject: state.detailedProject?.id === id ? { ...state.detailedProject, ...data } : state.detailedProject,
                projectsloading: false,
            }));
            return true;
        } catch (err: any) {
            set({
                projectserror: err.response?.data?.message || 'Failed to update project',
                projectsloading: false,
            });
            return false;
        }
    },
}));