import { useState, useMemo, useEffect } from "react";
import { Search, Loader2, Download, ArrowUpDown, ChevronUp, ChevronDown, AlertTriangle, Calendar } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import api from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import TaskRejectionDetailsModal from "./task-rejection-details-modal";

interface RejectedTask {
    task_id: string;
    title: string;
    status: string;
    rejection_count: number;
    last_rejection_comment: string | null;
    last_rejected_at: string | null;
    total_rejection_events: number;
    instance_name?: string;
    client_name?: string;
    rejector_name?: string;
}

interface RejectionEvent {
    id: string;
    level_number: number;
    actor_name: string;
    actor_role?: string;
    comment: string | null;
    created_at: string;
    reviewer_comments?: Array<{
        id: string;
        item_text: string;
        reviewer_comments: Array<{
            comment: string;
            reviewer_name?: string;
            timestamp?: string;
        }>;
    }>;
}

interface RejectionHistoryProps {
    userId: string;
    userName: string;
    dateFrom: string;
    dateTo: string;
}

export default function RejectionHistory({ userId, userName, dateFrom, dateTo }: RejectionHistoryProps) {
    const [tasks, setTasks] = useState<RejectedTask[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
    const { addToast } = useToast();

    // Modal state
    const [selectedTask, setSelectedTask] = useState<RejectedTask | null>(null);
    const [rejectionEvents, setRejectionEvents] = useState<RejectionEvent[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);

    useEffect(() => {
        fetchRejectedTasks();
    }, [userId, dateFrom, dateTo]);

    const fetchRejectedTasks = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/performance/member/${userId}/rejections`, {
                params: { from: dateFrom, to: dateTo }
            });
            setTasks(data.data || []);
        } catch (err: any) {
            addToast({
                title: "Error",
                description: err.response?.data?.message || "Failed to fetch rejection history",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchRejectionDetails = async (taskId: string, task: RejectedTask) => {
        setLoadingEvents(true);
        setSelectedTask(task);
        try {
            const { data } = await api.get(`/performance/task/${taskId}/rejection-details`);
            setRejectionEvents(data.data || []);
        } catch (err: any) {
            addToast({
                title: "Error",
                description: err.response?.data?.message || "Failed to fetch rejection details",
                variant: "destructive"
            });
            setRejectionEvents([]);
        } finally {
            setLoadingEvents(false);
        }
    };

    const handleTaskClick = (task: RejectedTask) => {
        fetchRejectionDetails(task.task_id, task);
    };

    const handleCloseModal = () => {
        setSelectedTask(null);
        setRejectionEvents([]);
    };

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = null;
        }
        setSortConfig({ key, direction });
    };

    const filtered = useMemo(() => {
        return tasks.filter(t =>
            search.trim() === '' ||
            t.title.toLowerCase().includes(search.toLowerCase()) ||
            t.instance_name?.toLowerCase().includes(search.toLowerCase()) ||
            t.client_name?.toLowerCase().includes(search.toLowerCase())
        );
    }, [tasks, search]);

    const sorted = useMemo(() => {
        let list = [...filtered];
        if (sortConfig.key && sortConfig.direction) {
            list.sort((a: any, b: any) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (typeof aValue === 'string') aValue = aValue.toLowerCase();
                if (typeof bValue === 'string') bValue = bValue.toLowerCase();

                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return list;
    }, [filtered, sortConfig]);

    const handleExportCSV = async () => {
        const headers = [
            'Task Name', 'Instance', 'Client', 'Status',
            'Total Rejections', 'Rejection #', 'Rejection Level',
            'Rejected By', 'Rejection Date', 'Rejection Comment',
            'Checklist Item', 'Reviewer Comment', 'Comment Timestamp'
        ];
        const rows: any[] = [];

        for (const task of sorted) {
            try {
                const { data } = await api.get(`/performance/task/${task.task_id}/rejection-details`);
                const rejectionEvents: any[] = (data.data || []).sort(
                    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );

                if (rejectionEvents.length === 0) {
                    rows.push([
                        task.title, task.instance_name || '-', task.client_name || '-',
                        task.status, task.total_rejection_events,
                        '-', '-', task.rejector_name || '-',
                        task.last_rejected_at ? new Date(task.last_rejected_at).toLocaleString() : '-',
                        task.last_rejection_comment || '-', '-', '-', '-'
                    ]);
                    continue;
                }

                rejectionEvents.forEach((event: any, eventIndex: number) => {
                    const eventTime = new Date(event.created_at).getTime();

                    // Filter checklist items to only those with comments at or before this rejection
                    const filteredItems = (event.reviewer_comments || [])
                        .map((item: any) => ({
                            ...item,
                            reviewer_comments: (item.reviewer_comments || []).filter(
                                (c: any) => c.created_at
                                    ? new Date(c.created_at).getTime() <= eventTime
                                    : true
                            ),
                        }))
                        .filter((item: any) => item.reviewer_comments.length > 0);

                    const taskInfo = [
                        task.title,
                        task.instance_name || '-',
                        task.client_name || '-',
                        task.status,
                        task.total_rejection_events,
                        eventIndex + 1,
                        event.level_number,
                        event.actor_name || task.rejector_name || '-',
                        new Date(event.created_at).toLocaleString(),
                        event.comment || '-',
                    ];

                    if (filteredItems.length === 0) {
                        rows.push([...taskInfo, '-', '-', '-']);
                    } else {
                        filteredItems.forEach((item: any, itemIndex: number) => {
                            item.reviewer_comments.forEach((comment: any, commentIndex: number) => {
                                rows.push([
                                    ...(itemIndex === 0 && commentIndex === 0 ? taskInfo : Array(taskInfo.length).fill('')),
                                    item.item_text || '-',
                                    comment.comment || '-',
                                    comment.created_at ? new Date(comment.created_at).toLocaleString() : '-'
                                ]);
                            });
                        });
                    }
                });
            } catch (err) {
                console.error(`Error fetching rejection details for task ${task.task_id}:`, err);
                rows.push([
                    task.title, task.instance_name || '-', task.client_name || '-',
                    task.status, task.total_rejection_events,
                    '-', '-', task.rejector_name || '-',
                    task.last_rejected_at ? new Date(task.last_rejected_at).toLocaleString() : '-',
                    task.last_rejection_comment || '-', '-', '-', '-'
                ]);
            }
        }

        const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${userName.replace(' ', '_')}_rejections_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        addToast({
            title: "Success",
            description: "Rejection history exported successfully",
            variant: "default"
        });
    };

    const totalRejections = tasks.reduce((sum, t) => sum + t.total_rejection_events, 0);

    return (
        <div className="space-y-4">
            {/* Header Stats */}
            <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            Rejection History - {userName}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            {tasks.length} tasks rejected • {totalRejections} total rejection events
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-3xl font-bold text-red-600">{totalRejections}</div>
                        <p className="text-xs text-muted-foreground">Total Rejections</p>
                    </div>
                </div>
            </div>

            {/* Search & Export */}
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 flex-col sm:flex-row">
                <div className="relative flex-1 w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search tasks, instances, clients..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs">
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                </Button>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-muted/30">
                                <tr className="border-b border-border">
                                    {[
                                        { label: 'Task Name', key: 'title' },
                                        { label: 'Instance', key: 'instance_name' },
                                        { label: 'Client', key: 'client_name' },
                                        { label: 'Status', key: 'status' },
                                        { label: 'Rejections', key: 'total_rejection_events' },
                                        { label: 'Last Rejected', key: 'last_rejected_at' },
                                        { label: 'Rejected By', key: 'rejector_name' },
                                        { label: 'Last Comment', key: 'last_rejection_comment' },
                                    ].map(h => (
                                        <th
                                            key={h.key}
                                            className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors group/th"
                                            onClick={() => handleSort(h.key)}
                                        >
                                            <div className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                                                {h.label}
                                                <div className="text-muted-foreground/30 group-hover/th:text-primary transition-colors">
                                                    {sortConfig.key === h.key ? (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                    ) : <ArrowUpDown className="h-3 w-3" />}
                                                </div>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(t => (
                                    <tr
                                        key={t.task_id}
                                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                                        onClick={() => handleTaskClick(t)}
                                    >
                                        <td className="py-3 px-4 font-medium text-foreground">{t.title}</td>
                                        <td className="py-3 px-4 text-primary font-medium">{t.instance_name || '-'}</td>
                                        <td className="py-3 px-4 text-primary font-medium">{t.client_name || '-'}</td>
                                        <td className="py-3 px-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-100 text-amber-700 border-amber-200">
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="font-bold text-red-600">{t.total_rejection_events}</span>
                                        </td>
                                        <td className="py-3 px-4 text-muted-foreground">
                                            {t.last_rejected_at ? new Date(t.last_rejected_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-foreground">{t.rejector_name || '-'}</td>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <td className="py-3 px-4 text-muted-foreground max-w-xs truncate cursor-help">
                                                    {t.last_rejection_comment || "-"}
                                                </td>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-sm break-words">
                                                {t.last_rejection_comment}
                                            </TooltipContent>
                                        </Tooltip>
                                    </tr>
                                ))}
                                {sorted.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={8} className="py-10 text-center text-muted-foreground">
                                            No rejected tasks found for this member in the selected date range.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Rejection Details Modal */}
            {selectedTask && (
                <TaskRejectionDetailsModal
                    isOpen={!!selectedTask}
                    onClose={handleCloseModal}
                    taskTitle={selectedTask.title}
                    taskId={selectedTask.task_id}
                    rejectionEvents={rejectionEvents}
                />
            )}
        </div>
    );
}
