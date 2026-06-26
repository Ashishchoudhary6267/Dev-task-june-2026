'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import {
  getWorkloadSummary,
  getWorkloadDetail,
  WorkloadSummaryItem,
  WorkloadDetailResponse,
  SmartStatus,
} from '@/lib/api/workload';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (mins: number) => {
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
};


const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

const STATUS_CONFIG: Record<SmartStatus, { label: string; color: string; bg: string }> = {
  'No load': { label: 'No Load', color: 'text-slate-500', bg: 'bg-slate-100' },
  'Delayed': { label: 'Delayed', color: 'text-red-600', bg: 'bg-red-100' },
  'Behind': { label: 'Behind', color: 'text-orange-600', bg: 'bg-orange-100' },
  'Ahead': { label: 'Ahead', color: 'text-emerald-600', bg: 'bg-emerald-100' },
  'On time': { label: 'On Time', color: 'text-blue-600', bg: 'bg-blue-100' },
};

// ─── Occupancy Bar ────────────────────────────────────────────────────────────

function OccupancyBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100);
  const isOver = pct > 100;
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-visible">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-blue-500'}`}
        style={{ width: `${capped}%` }}
      />

    </div>
  );
}

// ─── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: SmartStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['No load'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Member Detail Modal ──────────────────────────────────────────────────────

function MemberDetailModal({
  member,
  dateRange,
  onClose,
}: {
  member: WorkloadSummaryItem;
  dateRange: { from: string; to: string };
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<WorkloadDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getWorkloadDetail(member.id, dateRange.from, dateRange.to)
      .then(setDetail)
      .catch((e) => setError(e?.response?.data?.message || 'Failed to load details'))
      .finally(() => setLoading(false));
  }, [member.id, dateRange.from, dateRange.to]);

  const taskStatusColor: Record<string, string> = {
    COMPLETED: 'text-emerald-600',
    APPROVED: 'text-emerald-600',
    IN_PROGRESS: 'text-blue-600',
    PENDING_APPROVAL: 'text-amber-600',
    REJECTED: 'text-red-600',
    LOCKED: 'text-slate-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{member.name}</h2>
            <p className="text-xs text-slate-400 capitalize">{member.role}</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-500 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {detail && !loading && (
            <>
              {/* Daily Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Capacity', value: fmt(detail.dailyTotals.capacity) },
                  { label: 'Assigned', value: fmt(detail.dailyTotals.assigned) },
                  { label: 'Remaining', value: fmt(detail.dailyTotals.remaining) },
                  { label: 'Occupancy', value: `${detail.dailyTotals.occupancy}%` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400 mb-0.5">{stat.label}</p>
                    <p className="text-base font-bold text-slate-800">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Task List */}
              {detail.taskList.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Tasks</h3>
                  <div className="space-y-2">
                    {detail.taskList.map((task) => (
                      <div key={task.id} className="flex items-start justify-between gap-2 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{task.instance}{task.client !== '—' ? ` · ${task.client}` : ''}</p>
                          {task.assigned_at && (
                            <p className="text-[10px] text-slate-300">Assigned: {new Date(task.assigned_at).toLocaleDateString('en-IN')}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[11px] font-semibold ${taskStatusColor[task.status] ?? 'text-slate-500'}`}>
                            {task.status.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-slate-400">{fmt(task.estimated_minutes)} est.</p>
                          {task.submitted_at && (
                            <p className="text-[10px] text-slate-300">Done: {new Date(task.submitted_at).toLocaleDateString('en-IN')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No tasks in this range.</p>
              )}

              {/* Completion Comparison */}
              {detail.completionHistory.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">Completed — Allocated vs Actual</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="text-left px-3 py-2 font-medium">Task</th>
                          <th className="text-right px-3 py-2 font-medium">Allocated</th>
                          <th className="text-right px-3 py-2 font-medium">Actual</th>
                          <th className="text-right px-3 py-2 font-medium">Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.completionHistory.map((row) => {
                          const delta = row.actual - row.allocated;
                          return (
                            <tr key={row.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700 truncate max-w-[180px]">{row.title}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{fmt(row.allocated)}</td>
                              <td className="px-3 py-2 text-right text-slate-500">{fmt(row.actual)}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${delta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {delta > 0 ? '+' : ''}{fmt(Math.abs(delta))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type DatePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom';

export default function WorkloadManagementTab() {
  const [preset, setPreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from: string, to: string }>({
    from: todayISO(),
    to: todayISO()
  });
  const [search, setSearch] = useState('');
  const [data, setData] = useState<WorkloadSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkloadSummaryItem | null>(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getWorkloadSummary(dateRange.from, dateRange.to);
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load workload data.');
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const filtered = data.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Workload Management</h2>
          <p className="text-sm text-slate-400">Daily capacity &amp; task load per team member</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Selector */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white hover:bg-slate-50 transition-colors">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                <span className="font-medium text-slate-700">
                  {preset === 'today' && 'Today'}
                  {preset === 'yesterday' && 'Yesterday'}
                  {preset === 'last7days' && 'Last 7 Days'}
                  {preset === 'last30days' && 'Last 30 Days'}
                  {preset === 'custom' && `${new Date(dateRange.from).toLocaleDateString('en-IN')} - ${new Date(dateRange.to).toLocaleDateString('en-IN')}`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-white rounded-xl shadow-xl border border-slate-100 outline-none z-50 mt-1">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setPreset('today');
                    setDateRange({ from: todayISO(), to: todayISO() });
                  }}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${preset === 'today' ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    const yISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(y);
                    setPreset('yesterday');
                    setDateRange({ from: yISO, to: yISO });
                  }}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${preset === 'yesterday' ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 6);
                    const dISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                    setPreset('last7days');
                    setDateRange({ from: dISO, to: todayISO() });
                  }}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${preset === 'last7days' ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 29);
                    const dISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
                    setPreset('last30days');
                    setDateRange({ from: dISO, to: todayISO() });
                  }}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${preset === 'last30days' ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => setPreset('custom')}
                  className={`text-left px-3 py-2 text-sm rounded-lg transition-colors ${preset === 'custom' ? 'bg-blue-50 text-blue-600 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  Custom Range
                </button>

                {preset === 'custom' && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">From</label>
                      <input
                        type="date"
                        value={dateRange.from}
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">To</label>
                      <input
                        type="date"
                        value={dateRange.to}
                        min={dateRange.from}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Search */}
          <input
            type="text"
            placeholder="Search member…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-44"
          />

          {/* Refresh */}
          <button
            onClick={fetchSummary}
            className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-9 h-9 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {/* Non-working day banner */}
      {!loading && data.length > 0 && !data[0].isWorkingDay && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 font-medium">
          ⚠️ This is a non-working day (weekend or holiday). Daily capacity is 0.
        </div>
      )}

      {/* Member Cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelected(member)}
              className="text-left bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-5 space-y-4"
            >
              {/* Name + Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800 leading-tight">{member.name}</p>
                  <p className="text-xs text-slate-400 capitalize mt-0.5">{member.role}</p>
                </div>
                <StatusChip status={member.status} />
              </div>

              {/* Occupancy Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Occupancy</span>
                  <span className={member.occupancy > 100 ? 'text-red-500 font-bold' : ''}>
                    {member.occupancy}%
                  </span>
                </div>
                <OccupancyBar pct={member.occupancy} />
              </div>

              {/* Stats Grid — shows assigned, done (est + actual), remaining */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-400">Assigned</p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{fmt(member.assignedToday)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-400">Done (est)</p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{fmt(member.completedAllocated)}</p>
                  {member.completedActual > 0 && (
                    <p className="text-[9px] text-slate-400">{fmt(member.completedActual)} actual</p>
                  )}
                </div>
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-400">Left</p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{fmt(member.remaining)}</p>
                </div>
              </div>

              <p className="text-[10px] text-slate-300 text-right">Click for task details →</p>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && data.length > 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No members match your search.</div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No active team members found.</div>
      )}

      {/* Detail Modal */}
      {selected && (
        <MemberDetailModal
          member={selected}
          dateRange={dateRange}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
