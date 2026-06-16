'use client';
import React, { useState, useEffect } from 'react';
import { Button, useToast, UISelect } from '../ui';
import { Spinner } from '../ui/spinner';
import api from '@/lib/api';
import * as XLSX from 'xlsx';
import { FileDown, ChevronDown, ChevronUp, BarChart as BarChartIcon, LayoutDashboard, Printer, UserCircle } from 'lucide-react';
import { handleGenerate1, handleGenerate2 } from '@/lib/utils/excel-report';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { UserSelect } from '../ui/user-select';

type User = {
    id: string;
    name: string;
    email: string;
    platform_role: string;
    workflow_role?: string;
};

type RangeType = '7_days' | 'last_month' | '6_months' | 'custom';

const STATUS_COLORS: Record<string, string> = {
    'Completed (On-time)': '#4ade80',
    'In Progress': '#60a5fa',
    'Pending Approval': '#f59e0b',
    'Completed (Late)': '#FF0000',
    'Overdue': '#ef4444',
    'Rejected (Rework)': '#f43f5e',
};
const DEFAULT_STATUS_COLOR = '#94a3b8';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// ── Shared range toggle ───────────────────────────────────────────────────────
function RangeToggle({
    value, onChange,
    from, to, onFromChange, onToChange
}: {
    value: RangeType;
    onChange: (v: RangeType) => void;
    from?: string;
    to?: string;
    onFromChange?: (v: string) => void;
    onToChange?: (v: string) => void;
}) {
    return (
        <div className='flex flex-col gap-2'>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as RangeType)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
            >
                <option value="7_days">Last 7 Days</option>
                <option value="last_month">Last Month</option>
                <option value="6_months">Last 6 Months</option>
                <option value="custom">Custom Range</option>
            </select>
            {value === 'custom' && (
                <div className='flex items-center gap-2'>
                    <input type="date" value={from || ''} onChange={e => onFromChange?.(e.target.value)} className="flex-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <input type="date" value={to || ''} onChange={e => onToChange?.(e.target.value)} className="flex-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
            )}
        </div>
    );
}

export default function ReportsTab() {

    // ── Report 1: User Activity ───────────────────────────────────────────────
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [showForm1, setShowForm1] = useState(false);
    const [viewMode1, setViewMode1] = useState<'form' | 'analytics'>('form');
    const [selectedUser, setSelectedUser] = useState('');
    const [range1, setRange1] = useState<RangeType>('7_days');
    const [from1, setFrom1] = useState('');
    const [to1, setTo1] = useState('');
    const [loadingAction1, setLoadingAction1] = useState<'analytics' | 'excel' | null>(null);
    const [lastGenerated1, setLastGenerated1] = useState<Date | null>(null);
    const [analyticsData1, setAnalyticsData1] = useState<any>(null);

    // ── Report 2: Task Performance ────────────────────────────────────────────
    const [showForm2, setShowForm2] = useState(false);
    const [viewMode2, setViewMode2] = useState<'form' | 'analytics'>('form');
    const [range2, setRange2] = useState<RangeType>('7_days');
    const [from2, setFrom2] = useState('');
    const [to2, setTo2] = useState('');
    const [loadingAction2, setLoadingAction2] = useState<'analytics' | 'excel' | null>(null);
    const [lastGenerated2, setLastGenerated2] = useState<Date | null>(null);
    const [analyticsData2, setAnalyticsData2] = useState<any>(null);

    const { addToast } = useToast();

    // // Fetch users when Report 1 form opens
    // useEffect(() => {
    //     if (!showForm1) return;
    //     if (users.length > 0) return; // already loaded
    //     setUsersLoading(true);
    //     api.get('/fetchallusers')
    //         .then(res => setUsers(res.data?.data || []))
    //         .catch(() => setUsers([]))
    //         .finally(() => setUsersLoading(false));
    // }, [showForm1]);


    // ── Report 1: Generate ────────────────────────────────────────────────────
    const handleGenerateUserActivityReport = async () => {
        if (!selectedUser) return;
        try {
            setLoadingAction1('excel');
            await handleGenerate1(selectedUser, range1, from1, to1);
            setLastGenerated1(new Date());
            addToast({
                title: 'Report generated successfully',
                variant: 'success',
            })
        } catch {
            addToast({
                title: 'Failed to generate report',
                variant: 'destructive',
            })
        } finally {
            setLoadingAction1(null);
        }
    };

    const fetchUserActivityAnalytics = async () => {
        if (!selectedUser) return;
        setLoadingAction1('analytics');
        try {
            const res = await api.get('/reports/user-activity', {
                params: { user_id: selectedUser, range: range1, from: from1, to: to1 },
            });
            setAnalyticsData1(res.data);
            setViewMode1('analytics');
        } catch {
            addToast({ title: 'Failed to fetch analytics', variant: 'destructive' });
        } finally {
            setLoadingAction1(null);
        }
    };

    // ── Report 2: Generate ────────────────────────────────────────────────────
    const handleGenerateTaskPerformance = async () => {
        setLoadingAction2('excel');
        try {
            await handleGenerate2(range2, from2, to2);
            setLastGenerated2(new Date());
            addToast({
                title: 'Report generated successfully',
                variant: 'success',
            })
        } catch {
            addToast({
                title: 'Failed to generate report',
                variant: 'destructive',
            })
        } finally {
            setLoadingAction2(null);
        }
    };

    const fetchTaskPerformanceAnalytics = async () => {
        setLoadingAction2('analytics');
        try {
            const res = await api.get('/reports/task-performance', {
                params: { range: range2, from: from2, to: to2 },
            });
            setAnalyticsData2(res.data);
            setViewMode2('analytics');
        } catch {
            addToast({ title: 'Failed to fetch analytics', variant: 'destructive' });
        } finally {
            setLoadingAction2(null);
        }
    };


    // ── Analytics Renderers ──────────────────────────────────────────────────
    const renderUserActivityAnalytics = () => {
        if (!analyticsData1) return null;
        const { activityRows } = analyticsData1;

        // Status Distribution
        const statusCounts = activityRows.reduce((acc: any, row: any) => {
            acc[row.status] = (acc[row.status] || 0) + 1;
            return acc;
        }, {});
        const pieData = Object.keys(statusCounts).map(status => ({ name: status, value: statusCounts[status] }));

        // Time Comparison (Top 10 tasks)
        const barData = activityRows.slice(0, 10).map((row: any) => ({
            name: row.taskTitle.slice(0, 15) + '...',
            estimated: row.estimatedMinutes || 0,
            actual: row.actualWorkingMinutes || 0
        }));


        return (
            <div className='space-y-6 print:block'>
                <div className='flex justify-between items-center'>
                    <h4 className='text-sm font-medium'>User Activity Analytics : <span className="text-lg font-semibold text-black">{analyticsData1?.user?.name}</span> </h4>
                    <Button variant='ghost' size='sm' onClick={() => {
                        setViewMode1('form')
                        setSelectedUser('')
                    }}>Back to Form</Button>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    <div className='h-[250px] bg-background p-4 rounded-lg border'>
                        <p className='text-xs font-medium mb-2 text-center'>Task Status Distribution</p>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {pieData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={STATUS_COLORS[entry.name] ?? DEFAULT_STATUS_COLOR}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className='h-[250px] bg-background p-4 rounded-lg border'>
                        <p className='text-xs font-medium mb-2 text-center'>Estimated vs Actual (Mins)</p>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="estimated" fill="#8884d8" name="Est. Mins" />
                                <Bar dataKey="actual" fill="#82ca9d" name="Act. Mins" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        );
    };

    const renderTaskPerformanceAnalytics = () => {
        if (!analyticsData2) return null;
        const { summaryRows } = analyticsData2;

        const teamStats = summaryRows.map((r: any) => ({
            name: r.name,
            completed: r.completed,
            overdue: r.overdue,
            onTimePct: r.onTimeDeliveryPct
        }));

        return (
            <div className='space-y-6 print:block'>
                <div className='flex justify-between items-center'>
                    <h4 className='text-sm font-medium'>Team Performance Analytics</h4>
                    <Button variant='ghost' size='sm' onClick={() => {
                        setSelectedUser('')
                        setViewMode2('form')
                    }}>Back to Form</Button>
                </div>
                <div className='space-y-6'>
                    <div className='h-[300px] bg-background p-4 rounded-lg border'>
                        <p className='text-xs font-medium mb-2 text-center'>Tasks Completed vs Overdue</p>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teamStats}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="completed" fill="#4ade80" name="Completed" />
                                <Bar dataKey="overdue" fill="#f87171" name="Overdue" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className='h-[300px] bg-background p-4 rounded-lg border'>
                        <p className='text-xs font-medium mb-2 text-center'>On-Time Delivery Rate (%)</p>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={teamStats} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="onTimePct" fill="#3b82f6" name="On-Time %" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        );
    };


    // ── Shared card renderer ──────────────────────────────────────────────────
    const renderCard = (
        title: string,
        description: string,
        lastGenerated: Date | null,
        showForm: boolean,
        toggleForm: () => void,
        formContent: React.ReactNode,
        analyticsContent: React.ReactNode,
        viewMode: 'form' | 'analytics'
    ) => (
        <div className='border border-border rounded-md overflow-hidden bg-white'>
            <div className='flex items-center justify-between p-4'>
                <div>
                    <h3 className='text-sm font-semibold'>{title}</h3>
                    <p className='text-xs text-muted-foreground'>
                        {lastGenerated
                            ? <>Last Generated: <span>{lastGenerated.toLocaleString()}</span></>
                            : description}
                    </p>
                </div>
                <div className='flex gap-2'>
                    <Button variant='outline' size='sm' onClick={toggleForm} className='flex items-center gap-1.5'>
                        {showForm ? 'Hide' : 'Open'}
                        {showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                </div>
            </div>
            {showForm && (
                <div className='border-t border-border bg-muted/10 p-4'>
                    {viewMode === 'form' ? formContent : analyticsContent}
                </div>
            )}
        </div>
    );
    return (
        <div className='border border-border rounded p-4 bg-muted/5'>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <LayoutDashboard className='h-5 w-5' /> System Reports
                    </h2>
                    <p className="text-sm text-muted-foreground">Generate and view comprehensive system reports</p>
                </div>
                <Button variant='outline' size='sm' onClick={() => window.print()} className='hidden md:flex items-center gap-2'>
                    <Printer size={15} /> Print/Save PDF
                </Button>
            </div>

            <div className='space-y-4 print:space-y-12'>

                {/* ── Report 1: User Activity ─────────────────────────────── */}
                {renderCard(
                    'User Activity Report',
                    'Per-user tasks, instance usage & approval workflow',
                    lastGenerated1,
                    showForm1,
                    () => setShowForm1(v => !v),
                    <div className='space-y-4'>
                        <p className='text-xs text-muted-foreground'>
                            Generates a <strong>3-sheet Excel</strong> file: User Activity, Instance Usage, and Approval Workflow for the selected user.
                        </p>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                            <div className='space-y-1.5'>
                                <label className='text-xs font-medium'>Select User</label>
                                {usersLoading ? (
                                    <div className='flex items-center gap-2 h-10 text-xs text-muted-foreground'>
                                        <Spinner size='sm' /> Loading...
                                    </div>
                                ) : (
                                    <UserSelect
                                        value={selectedUser}
                                        onChange={(val) => setSelectedUser(val)}
                                        className="w-full"
                                        placeholder="— Select a user —"

                                    />
                                )}
                            </div>
                            <div className='space-y-1.5'>
                                <label className='text-xs font-medium'>Time Range</label>
                                <RangeToggle
                                    value={range1} onChange={setRange1}
                                    from={from1} to={to1}
                                    onFromChange={setFrom1} onToChange={setTo1}
                                />
                            </div>
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <Button onClick={fetchUserActivityAnalytics} disabled={!selectedUser || loadingAction1 !== null} variant='secondary' className='flex items-center gap-2'>
                                {loadingAction1 === 'analytics' ? <Spinner size='sm' /> : <BarChartIcon size={15} />} View Analytics
                            </Button>
                            <Button onClick={handleGenerateUserActivityReport} disabled={!selectedUser || loadingAction1 !== null} className='flex items-center gap-2'>
                                {loadingAction1 === 'excel' ? <Spinner size='sm' /> : <FileDown size={15} />} Download Excel
                            </Button>
                        </div>
                    </div>,
                    renderUserActivityAnalytics(),
                    viewMode1
                )}

                {/* ── Report 2: Task Performance Analytics ────────────────── */}
                {renderCard(
                    'Task Performance Analytics',
                    'Company-wide team performance summary & task details',
                    lastGenerated2,
                    showForm2,
                    () => setShowForm2(v => !v),
                    <div className='space-y-4'>
                        <p className='text-xs text-muted-foreground'>
                            Generates a <strong>2-sheet Excel</strong> file: Team Summary and Task Details for all members in your company.
                        </p>
                        <div className='max-w-xs space-y-1.5'>
                            <label className='text-xs font-medium'>Time Range</label>
                            <RangeToggle
                                value={range2} onChange={setRange2}
                                from={from2} to={to2}
                                onFromChange={setFrom2} onToChange={setTo2}
                            />
                        </div>
                        <div className='flex flex-wrap gap-2'>
                            <Button onClick={fetchTaskPerformanceAnalytics} disabled={loadingAction2 !== null} variant='secondary' className='flex items-center gap-2'>
                                {loadingAction2 === 'analytics' ? <Spinner size='sm' /> : <BarChartIcon size={15} />} View Team Analytics
                            </Button>
                            <Button onClick={handleGenerateTaskPerformance} disabled={loadingAction2 !== null} className='flex items-center gap-2'>
                                {loadingAction2 === 'excel' ? <Spinner size='sm' /> : <FileDown size={15} />} Download Excel
                            </Button>
                        </div>
                    </div>,
                    renderTaskPerformanceAnalytics(),
                    viewMode2
                )}

            </div>

            {/* Print specific styles */}
            <style jsx global>{`
                @media print {
                    .no-print, button, nav, aside { display: none !important; }
                    .print-only { display: block !important; }
                    body { background: white !important; }
                }
            `}</style>
        </div>
    );
}
