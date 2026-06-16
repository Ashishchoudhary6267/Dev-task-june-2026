import { create } from 'zustand'
import api from '@/lib/api'

interface Stats {
    users: number
    projects: number
    activeTasks: number
    overdueTasks: number
    activeInstances: number
    pendingClientApprovals: number
}

interface StatsState {
    stats: Stats | null
    statsLoading: boolean
    statsError: string | null
    fetchStats: () => Promise<void>
}

export const useStatsStore = create<StatsState>((set) => ({
    stats: null,
    statsLoading: false,
    statsError: null,

    fetchStats: async () => {
        set({ statsLoading: true, statsError: null })

        try {
            const { data } = await api.get('/dashboard/stats')
            console.log("Controller stats data", data);


            set({
                stats: {
                    users: data.users,
                    projects: data.projects,
                    activeTasks: data.activeTasks,
                    overdueTasks: data.overdueTasks,
                    activeInstances: data.instances,
                    pendingClientApprovals: data.pendingClientApprovals || 0,
                },
                statsLoading: false,
            })
        } catch (err: any) {
            set({
                statsError:
                    err.response?.data?.message || 'Failed to fetch stats',
                statsLoading: false,
            })
        }
    },
}))