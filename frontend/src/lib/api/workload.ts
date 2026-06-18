import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SmartStatus = 'No load' | 'Delayed' | 'Behind' | 'Ahead' | 'On time';

export interface WorkloadSummaryItem {
  id: string;
  name: string;
  role: string;
  capacity: number;
  assignedToday: number;
  completedAllocated: number;
  completedActual: number;
  remaining: number;
  occupancy: number;
  status: SmartStatus;
  isWorkingDay: boolean;
}

export interface WorkloadDetailTask {
  id: string;
  title: string;
  status: string;
  estimated_minutes: number;
  total_working_minutes: number;
  due_date: string;
  assigned_at?: string;
  submitted_at?: string;
  approved_at?: string;
  instance: string;
  client: string;
  is_manual: boolean;
}

export interface CompletionHistoryItem {
  id: string;
  title: string;
  allocated: number;
  actual: number;
}

export interface WorkloadDailyTotals {
  capacity: number;
  assigned: number;
  completedAllocated: number;
  completedActual: number;
  remaining: number;
  occupancy: number;
  status: SmartStatus;
  isWorkingDay: boolean;
}

export interface WorkloadDetailResponse {
  taskList: WorkloadDetailTask[];
  completionHistory: CompletionHistoryItem[];
  dailyTotals: WorkloadDailyTotals;
}

// ─── API Functions ────────────────────────────────────────────────────────────

export const getWorkloadSummary = async (date?: string): Promise<WorkloadSummaryItem[]> => {
  const response = await api.get('/performance/workload/summary', {
    params: date ? { date } : undefined,
  });
  return response.data.data;
};

export const getWorkloadDetail = async (
  userId: string,
  date?: string
): Promise<WorkloadDetailResponse> => {
  const response = await api.get(`/performance/workload/detail/${userId}`, {
    params: date ? { date } : undefined,
  });
  return response.data.data;
};
