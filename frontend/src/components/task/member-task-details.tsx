"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  X,
  Search,
  AlertCircle,
  ChevronDown,
  Loader2,
  Clock,
  Activity,
  User,
  Calendar,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Eye,
  FileWarning,
  CalendarClock,
  MoreVertical,
  SortAscIcon,
} from "lucide-react";
import { Task } from "@/lib/types/auth";
import {
  Input,
  Checkbox,
  Badge,
  DialogContent,
  Dialog,
  DialogHeader,
  DialogTitle,
  Button,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
  Label,
  UISelect,
  useToast,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui";
import api from "@/lib/api";
import { useUserStore } from "@/lib/zustand/user/addUser";
import { UserSelect } from "@/components/ui/user-select";
import Loader from "../ui/loader";
import TaskModal from "./overdue-details-modal";
import { useAuthStore } from "@/lib/zustand/user/user";
import ExtendSLA from "../sla-extension/extend_sla";

interface OverdueDetailsModalProps {
  memberId: string;
  memberName: string;
  onClose: () => void;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "—" || dateStr === "-") return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function getDaysOverdue(dueDate: string | undefined): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  const diff = now.getTime() - due.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isTaskOverdue(task: Task, now: Date): boolean {
  if (!task.due_date) return false;
  if (
    task.status === "COMPLETED" ||
    task.status === "APPROVED" ||
    task.status === "REJECTED"
  )
    return false;
  return new Date(task.due_date) < now;
}

function isTaskActive(task: Task): boolean {
  return task.status === "IN_PROGRESS" || task.status === "PENDING_APPROVAL";
}

type StatusFilter = "all" | "completed" | "in_progress" | "pending" | "overdue";

export function OverdueDetailsModal({
  memberId,
  memberName,
  onClose,
  dateRange,
  startDate,
  endDate,
}: OverdueDetailsModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalSearch, setModalSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(
    new Set(["all"]),
  );
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExtendSlaOpen, setIsExtendSlaOpen] = useState(false);
  const [isBypassTaskOpen, setBypassTaskOpen] = useState(false);
  const [isReassignTaskOpen, setReassignTaskOpen] = useState(false);
  const [assignReviewerId, setAssignReviewerId] = useState("");
  const [reason, setReason] = useState("");
  const { users } = useUserStore();
  const [comment, setComment] = useState("");
  const { addToast } = useToast();
  const [bypassAction, setBypassAction] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [SLAreason, setSLAReason] = useState("");
  const [isBypassing, setIsBypassing] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTasks();
  }, [memberId, dateRange, startDate, endDate]);

  const isManager = user?.workflow_role === "interim_manager";

  const fetchTasks = async () => {
    try {
      const { data } = await api.get("/tasks/member/overdue", {
        params: {
          assigned_user_id: memberId,
          limit: 100,
          dateRange,
          startDate,
          endDate,
        },
      });
      setTasks(data.data || []);
    } catch (err) {
      console.error("Failed to fetch task details", err);
    } finally {
      setLoading(false);
    }
  };

  console.log("tasks", tasks);

  function toggleFilter(f: StatusFilter) {
    if (f === "all") {
      setStatusFilters(new Set(["all"]));
      return;
    }
    const next = new Set(statusFilters);
    next.delete("all");
    if (next.has(f)) {
      next.delete(f);
      if (next.size === 0) next.add("all");
    } else next.add(f);
    setStatusFilters(next);
  }

  function getTaskStatus(task: Task): StatusFilter {
    const now = new Date();
    const isOverdue =
      task.due_date &&
      new Date(task.due_date) < now &&
      !["COMPLETED", "APPROVED"].includes(task.status);
    if (isOverdue) return "overdue";
    if (["COMPLETED", "APPROVED"].includes(task.status)) return "completed";
    if (task.status === "IN_PROGRESS") return "in_progress";
    if (task.status === "PENDING_APPROVAL") return "pending";
    return "in_progress"; // Default fallback
  }

  function statusBadge(status: StatusFilter) {
    const map: Record<StatusFilter, { label: string; cls: string }> = {
      all: { label: "all", cls: "" },
      completed: {
        label: "completed",
        cls: "bg-green-100 text-green-700 border-green-200",
      },
      in_progress: {
        label: "in progress",
        cls: "bg-blue-100 text-blue-700 border-blue-200",
      },
      pending: {
        label: "pending",
        cls: "bg-amber-100 text-amber-700 border-amber-200",
      },
      overdue: {
        label: "overdue",
        cls: "bg-red-100 text-red-700 border-red-200",
      },
    };
    const s = map[status];
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.cls}`}
      >
        {s.label}
      </span>
    );
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const taskStatus = getTaskStatus(t);
      const matchSearch =
        modalSearch.trim() === "" ||
        (t.title || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
        (t.instance?.name || "")
          .toLowerCase()
          .includes(modalSearch.toLowerCase()) ||
        (t.instance?.client?.name || "")
          .toLowerCase()
          .includes(modalSearch.toLowerCase());
      const matchStatus =
        statusFilters.has("all") || statusFilters.has(taskStatus);
      return matchSearch && matchStatus;
    });
  }, [tasks, modalSearch, statusFilters]);

  //reassign task
  const handleReassignTask = async (
    taskId: any,
    assignReviewerId: any,
    reason: any,
  ) => {
    if (!assignReviewerId) {
      addToast({
        title: "Error",
        description: "Please select a reviewer.",
        variant: "destructive",
      });
      return;
    }

    if (!reason) {
      addToast({
        title: "Error",
        description: "Please enter a reason.",
        variant: "destructive",
      });
      return;
    }
    setIsReassigning(true);
    const res = await api.post(`/tasks/${taskId}/reassign`, {
      assignee_id: assignReviewerId,
      reason,
    });
    if (res.status === 200) {
      addToast({
        title: "Success",
        description: "Task reassigned successfully.",
        variant: "success",
      });

      setReassignTaskOpen(false);
      setSelectedTask(null);
      setReason("");
      setAssignReviewerId("");
      fetchTasks();
      setIsReassigning(false);
      // refreshTasks();
    } else {
      addToast({
        title: "Error",
        description: "Failed to reassign task.",
        variant: "destructive",
      });
      setIsReassigning(false);
    }
  };

  //bypass task
  const handleBypassTask = async (taskId: any, action: any, reason: any) => {
    try {
      setIsBypassing(true);
      await api.post(`/tasks/${taskId}/bypass`, {
        action,
        reason,
      });

      addToast({
        title: "Success",
        description: "Task bypassed successfully",
      });
      setComment("");
      setReason("");
      setBypassAction("");
      setBypassTaskOpen(false);
      fetchTasks();
      // refreshTasks();
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to bypass task",
      });
    } finally {
      setIsBypassing(false);
    }
  };

  const validateDeadline = (deadline: string): boolean => {
    if (!deadline || !deadline.includes("T")) return false;

    const selected = new Date(deadline);
    const day = selected.getDay(); // 0 = Sunday, 6 = Saturday

    // Check weekend
    if (day === 0 || day === 6) {
      addToast({
        title: "Error",
        description: "Outside working hours: Deadline cannot be on a weekend.",
      });
      return false;
    }

    // Check time
    const [hourStr, minuteStr] = deadline.split("T")[1].split(":");
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    const totalMinutes = hour * 60 + minute;

    const startMinutes = 9 * 60 + 30; // 9:30 AM
    const endMinutes = 18 * 60 + 30; // 6:30 PM

    if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
      addToast({
        title: "Error",
        description:
          "Outside working hours: Please select a time between 9:30 AM and 6:30 PM.",
      });
      return false;
    }

    return true;
  };


  // Add at the top of your component
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Sort your filtered array before rendering
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    let av: any, bv: any;
    if (sortKey === "title") {
      av = a.title;
      bv = b.title;
    } else if (sortKey === "instance") {
      av = a.instance?.name;
      bv = b.instance?.name;
    } else if (sortKey === "client") {
      av = a.instance?.client?.name;
      bv = b.instance?.client?.name;
    } else if (sortKey === "status") {
      av = getTaskStatus(a);
      bv = getTaskStatus(b);
    } else if (sortKey === "assigned") {
      av = a.assigned_user?.name;
      bv = b.assigned_user?.name;
    } else if (sortKey === "due_date") {
      av = a.due_date;
      bv = b.due_date;
    } else if (sortKey === "due_category") {
      av = a.due_category;
      bv = b.due_category;
    } else if (sortKey === "overdue") {
      av = getDaysOverdue(a.due_date || '') ?? -1;
      bv = getDaysOverdue(b.due_date || '') ?? -1;
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? av - bv : bv - av;
  });
  const categoryCounts = useMemo(() => {
    const counts = { OVERDUE: 0, DUE_TODAY: 0, DUE_TOMORROW: 0 };
    tasks.forEach((t) => {
      if (t.due_category === "OVERDUE") counts.OVERDUE++;
      else if (t.due_category === "DUE_TODAY") counts.DUE_TODAY++;
      else if (t.due_category === "DUE_TOMORROW") counts.DUE_TOMORROW++;
    });
    return counts;
  }, [tasks]);

  const SortIcon = ({ col }: { col: string }) => (
    <span className="inline-flex flex-col gap-px ml-1">
      <span
        className={`w-0 h-0 border-l-[3px] border-r-[3px] border-b-4 border-l-transparent border-r-transparent ${sortKey === col && sortDir === "asc" ? "border-b-foreground" : "border-b-muted-foreground/30"}`}
      />
      <span
        className={`w-0 h-0 border-l-[3px] border-r-[3px] border-t-4 border-l-transparent border-r-transparent ${sortKey === col && sortDir === "desc" ? "border-t-foreground" : "border-t-muted-foreground/30"}`}
      />
    </span>
  );
  // ─── OverdueDetailsModal table ────────────────────────────────────────────
  // All overdue/late calculations come from the backend.
  // Fields available: due_category, days_overdue, is_review_task, reviewer_due_date, effective_due_date
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-border bg-white">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {memberName} - Task Details
            </h2>
            <p className="text-xs text-muted-foreground">
              View detailed task information
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks, instances, clients, or status..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>

        {/* Category Summary */}
        <div className="grid grid-cols-3 gap-4 px-5 py-4 bg-white border-b border-border">
          <div className="flex flex-col p-3 rounded-lg border border-red-100 bg-red-50/30">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
              Overdue
            </span>
            <span className="text-xl font-bold text-red-700">
              {categoryCounts.OVERDUE}
            </span>
          </div>
          <div className="flex flex-col p-3 rounded-lg border border-amber-100 bg-amber-50/30">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
              Due Today
            </span>
            <span className="text-xl font-bold text-amber-700">
              {categoryCounts.DUE_TODAY}
            </span>
          </div>
          <div className="flex flex-col p-3 rounded-lg border border-blue-100 bg-blue-50/30">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
              Due Tomorrow
            </span>
            <span className="text-xl font-bold text-blue-700">
              {categoryCounts.DUE_TOMORROW}
            </span>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center justify-between px-5 py-2 bg-white border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Current Filters:
            </span>
            <Badge variant="outline" className="text-[10px] bg-muted/50">
              {modalSearch ? `Search: "${modalSearch}"` : "All Results"}
            </Badge>
            {categoryCounts.OVERDUE +
              categoryCounts.DUE_TODAY +
              categoryCounts.DUE_TOMORROW >
              0 && (
                <Badge variant="outline" className="text-[10px] bg-muted/50">
                  Showing {filtered.length} tasks
                </Badge>
              )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-5 pb-8 bg-white min-h-[350px]">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader />
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border sticky top-0 bg-white z-10">
                  {[
                    ["title", "Task Name"],
                    ["instance", "Instance"],
                    ["client", "Client"],
                    ["due_category", "Status"],
                    ["assigned", "Assigned To"],
                    ["due_date", "Due Date"],
                    ["overdue", "Overdue By"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className="text-left py-3 pr-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      <SortIcon col={key} />
                    </th>
                  ))}
                  <th className="text-left py-3 pr-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  // Use backend-computed fields; fallback for safety
                  const dueCat: string = (t as any).due_category || 'ACTIVE';
                  const daysOverdue: number = (t as any).days_overdue ?? 0;
                  const isReviewTask: boolean = !!(t as any).is_review_task;
                  // Show reviewer's level due date if it's a review task, else tasks.due_date
                  const displayDueDate: string | null = isReviewTask
                    ? ((t as any).reviewer_due_date || t.due_date)
                    : t.due_date;

                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedTask(t);
                        setIsModalOpen(true);
                      }}
                    >
                      {/* Task name + REVIEW badge */}
                      <td className="py-3.5 pr-4 font-medium text-foreground">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {t.title}
                          {isReviewTask && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                              Review
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-primary font-medium">
                        {t.instance?.name || "-"}
                      </td>
                      <td className="py-3.5 pr-4 text-primary font-medium">
                        {t.instance?.client?.name || "-"}
                      </td>
                      {/* Status badge from backend due_category */}
                      <td className="py-3.5 pr-4">
                        {dueCat === 'OVERDUE' && (
                          <Badge variant="destructive" className="text-[8px] h-4 uppercase">Overdue</Badge>
                        )}
                        {dueCat === 'DUE_TODAY' && (
                          <Badge variant="secondary" className="text-[8px] h-4 uppercase bg-amber-100 text-amber-700 hover:bg-amber-100">Due Today</Badge>
                        )}
                        {dueCat === 'DUE_TOMORROW' && (
                          <Badge variant="secondary" className="text-[8px] h-4 uppercase bg-blue-100 text-blue-700 hover:bg-blue-100">Tomorrow</Badge>
                        )}
                        {dueCat === 'ACTIVE' && (
                          <Badge variant="outline" className="text-[8px] h-4 uppercase">Active</Badge>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-muted-foreground">
                        {t.assigned_user?.name || "-"}
                      </td>
                      {/* Due date: reviewer's level due_date or task due_date */}
                      <td className="py-3.5 pr-4 text-muted-foreground">
                        {formatDate(displayDueDate)}
                      </td>
                      {/* Days overdue from backend */}
                      <td className="py-3.5">
                        {daysOverdue > 0 ? (
                          <span className="font-bold text-red-600">{daysOverdue} days</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger disabled={isManager}>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-muted"
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent
                            align="end"
                            className="w-[180px]"
                          >
                            {/* View */}
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedTask(t);
                                setIsModalOpen(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              <span>View</span>
                            </DropdownMenuItem>

                            {/* Bypass — only for non-review worker tasks */}
                            {t.status === "IN_PROGRESS" && !isReviewTask && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setSelectedTask(t);
                                  setBypassTaskOpen(true);
                                }}
                              >
                                <FileWarning className="mr-2 h-4 w-4 text-red-600" />
                                <span>Bypass Task</span>
                              </DropdownMenuItem>
                            )}

                            {/* Reassign */}
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                setSelectedTask(t);
                                setReassignTaskOpen(true);
                              }}
                            >
                              <User className="mr-2 h-4 w-4 text-red-600" />
                              <span>Reassign</span>
                            </DropdownMenuItem>

                            {/* Extend SLA */}
                            {t.status !== "COMPLETED" && (
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  setSelectedTask(t);
                                  setIsExtendSlaOpen(true);
                                }}
                              >
                                <CalendarClock className="mr-2 h-4 w-4 text-red-600" />
                                <span>Extend SLA</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No tasks match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <TaskModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        selectedTask={selectedTask}
        actions={
          selectedTask && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className="gap-2 h-8">
                  Actions <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {selectedTask.status === "IN_PROGRESS" && (
                  <DropdownMenuItem
                    onClick={() => setBypassTaskOpen(true)}
                    className="cursor-pointer"
                  >
                    <FileWarning className="mr-2 h-4 w-4 text-red-600" />
                    <span>Bypass Task</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setReassignTaskOpen(true)}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4 text-red-600" />
                  <span>Reassign</span>
                </DropdownMenuItem>
                {selectedTask.status !== "COMPLETED" && (
                  <DropdownMenuItem
                    onClick={() => setIsExtendSlaOpen(true)}
                    className="cursor-pointer"
                  >
                    <CalendarClock className="mr-2 h-4 w-4 text-red-600" />
                    <span>Extend SLA</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />
      {/* Assign task dialog */}
      {isReassignTaskOpen && (
        <Dialog open={isReassignTaskOpen} onOpenChange={setReassignTaskOpen}>
          <DialogTrigger>
            <Button variant="outline" className="w-full">
              Assign Task
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-semibold">Assign Task</DialogTitle>
              <DialogDescription>
                Assign this task to someone else.
              </DialogDescription>
            </DialogHeader>

            {/* Reviewer Select */}
            <div className="space-y-2">
              <div>
                {/* <Label>Task ID: {selectedTask?.id}</Label> */}
                <Label>
                  Currently Assigned to: {selectedTask?.assigned_user?.name}
                </Label>
              </div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Assign to
              </Label>

              <UserSelect
                value={assignReviewerId}
                onChange={(val) => setAssignReviewerId(val)}
                className="h-10 text-sm"
                placeholder="Search to reassign..."
                excludeIds={
                  selectedTask?.assigned_user_id
                    ? [selectedTask.assigned_user_id]
                    : []
                }
              />
            </div>

            {/* Reason */}
            <div className="space-y-2 pt-4">
              <Label htmlFor="assign-reason">Reason</Label>

              <Input
                id="assign-reason"
                placeholder="Enter reason for assignment"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 p-2">
              {" "}
              <DialogFooter>
                <DialogClose>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>

                <Button
                  type="submit"
                  onClick={() =>
                    handleReassignTask(
                      selectedTask?.id,
                      assignReviewerId,
                      reason,
                    )
                  }
                  disabled={!assignReviewerId || isReassigning}
                >
                  Assign
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Bypass task dialog */}
      {isBypassTaskOpen && (
        <Dialog open={isBypassTaskOpen} onOpenChange={setBypassTaskOpen}>
          <DialogTrigger>
            <Button variant="outline" className="w-full">
              Emergency Bypass
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600 font-bold">
                Emergency Task Bypass
              </DialogTitle>
              <DialogDescription>
                Emergency action for "{selectedTask?.title}"
              </DialogDescription>
              <DialogDescription>
                Are you sure you want to proceed? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {/* Action Select */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Bypass Action *
              </Label>

              <UISelect
                value={bypassAction}
                onValueChange={(val) => setBypassAction(val)}
                className="w-full"
                placeholder="Select Action"
                options={[
                  { value: "", label: "— Select action —" },
                  { value: "skip", label: "Skip Task", icon: FileWarning },
                  {
                    value: "force_complete",
                    label: "Force Complete",
                    icon: FileWarning,
                  },
                ]}
              />
            </div>

            {/* Reason */}
            <div className="pt-4 space-y-2">
              <Label htmlFor="bypass-reason">Reason *</Label>

              <Input
                id="bypass-reason"
                placeholder="Enter reason for bypass"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Warning Box */}
            <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/30 bg-red-500/10 mt-2">
              <span className="text-red-600 text-lg">⚠️</span>
              <DialogDescription className="text-red-700 font-medium">
                Warning: This is an emergency action that should be used
                sparingly. The bypass will be permanently logged in the audit
                trail with full accountability.
              </DialogDescription>
            </div>

            <DialogFooter>
              <div className="p-2 flex gap-2">
                <DialogClose>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>

                <Button
                  variant="destructive"
                  disabled={!bypassAction || !reason || isBypassing}
                  onClick={() =>
                    handleBypassTask(selectedTask?.id, bypassAction, reason)
                  }
                >
                  Confirm Bypass
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ExtendSLA
        isExtendSlaOpen={isExtendSlaOpen}
        setIsExtendSlaOpen={setIsExtendSlaOpen}
        selectedTask={selectedTask}
      />
    </div>
  );
}

// late task modal

interface LateTaskDetailsModalProps {
  memberId: string;
  memberName: string;
  onClose: () => void;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
}

type StatusFilters =
  | "all"
  | "completed"
  | "in_progress"
  | "pending"
  | "overdue";

export function LateTaskDetailsModal({
  memberId,
  memberName,
  onClose,
  dateRange,
  startDate,
  endDate,
}: LateTaskDetailsModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalSearch, setModalSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(
    new Set(["all"]),
  );
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [memberId, dateRange, startDate, endDate]);

  const fetchTasks = async () => {
    try {
      const { data } = await api.get("/tasks/member/overdue", {
        params: {
          assigned_user_id: memberId,
          limit: 100,
          case: "late",
          dateRange,
          startDate,
          endDate,
        },
      });
      setTasks(data.data || []);
    } catch (err) {
      console.error("Failed to fetch task details", err);
    } finally {
      setLoading(false);
    }
  };

  function getTaskStatus(task: Task): StatusFilter {
    const now = new Date();
    const isOverdue =
      task.due_date &&
      new Date(task.due_date) < now &&
      !["COMPLETED", "APPROVED"].includes(task.status);
    if (isOverdue) return "overdue";
    if (["COMPLETED", "APPROVED"].includes(task.status)) return "completed";
    if (task.status === "IN_PROGRESS") return "in_progress";
    if (task.status === "PENDING_APPROVAL") return "pending";
    return "in_progress"; // Default fallback
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const taskStatus = getTaskStatus(t);
      const matchSearch =
        modalSearch.trim() === "" ||
        (t.title || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
        (t.instance?.name || "")
          .toLowerCase()
          .includes(modalSearch.toLowerCase()) ||
        (t.instance?.client?.name || "")
          .toLowerCase()
          .includes(modalSearch.toLowerCase());
      const matchStatus =
        statusFilters.has("all") || statusFilters.has(taskStatus);
      return matchSearch && matchStatus;
    });
  }, [tasks, modalSearch, statusFilters]);

  // Add at the top of your component
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Sort your filtered array before rendering
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0;
    let av: any, bv: any;
    if (sortKey === "title") {
      av = a.title;
      bv = b.title;
    } else if (sortKey === "instance") {
      av = a.instance?.name;
      bv = b.instance?.name;
    } else if (sortKey === "client") {
      av = a.instance?.client?.name;
      bv = b.instance?.client?.name;
    } else if (sortKey === "status") {
      av = getTaskStatus(a);
      bv = getTaskStatus(b);
    } else if (sortKey === "assigned") {
      av = a.assigned_user?.name;
      bv = b.assigned_user?.name;
    } else if (sortKey === "due_date") {
      av = a.due_date;
      bv = b.due_date;
    } else if (sortKey === "due_category") {
      av = a.due_category;
      bv = b.due_category;
    } else if (sortKey === "overdue") {
      av = getDaysOverdue(a.due_date || '') ?? -1;
      bv = getDaysOverdue(b.due_date || '') ?? -1;
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "string")
      return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === "asc" ? av - bv : bv - av;
  });
  const categoryCounts = useMemo(() => {
    const counts = { OVERDUE: 0, DUE_TODAY: 0, DUE_TOMORROW: 0 };
    tasks.forEach((t) => {
      if (t.due_category === "OVERDUE") counts.OVERDUE++;
      else if (t.due_category === "DUE_TODAY") counts.DUE_TODAY++;
      else if (t.due_category === "DUE_TOMORROW") counts.DUE_TOMORROW++;
    });
    return counts;
  }, [tasks]);

  const SortIcon = ({ col }: { col: string }) => (
    <span className="inline-flex flex-col gap-px ml-1">
      <span
        className={`w-0 h-0 border-l-[3px] border-r-[3px] border-b-4 border-l-transparent border-r-transparent ${sortKey === col && sortDir === "asc" ? "border-b-foreground" : "border-b-muted-foreground/30"}`}
      />
      <span
        className={`w-0 h-0 border-l-[3px] border-r-[3px] border-t-4 border-l-transparent border-r-transparent ${sortKey === col && sortDir === "desc" ? "border-t-foreground" : "border-t-muted-foreground/30"}`}
      />
    </span>
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-5xl max-h-[85vh] flex flex-col mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3 border-b border-border bg-white">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {memberName} - Late Task Tracking
            </h2>
            <p className="text-xs text-muted-foreground">
              Monitor and manage tasks that have exceeded their deadlines
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks, instances, clients, or status..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>

        {/* Category Summary */}
        {/* <div className="grid grid-cols-3 gap-4 px-5 py-4 bg-white border-b border-border">
                    <div className="flex flex-col p-3 rounded-lg border border-red-100 bg-red-50/30">
                        <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Overdue</span>
                        <span className="text-xl font-bold text-red-700">{categoryCounts.OVERDUE}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-lg border border-amber-100 bg-amber-50/30">
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Due Today</span>
                        <span className="text-xl font-bold text-amber-700">{categoryCounts.DUE_TODAY}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-lg border border-blue-100 bg-blue-50/30">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Due Tomorrow</span>
                        <span className="text-xl font-bold text-blue-700">{categoryCounts.DUE_TOMORROW}</span>
                    </div>
                </div> */}

        {/* Filter row */}
        <div className="flex items-center justify-between px-5 py-2 bg-white border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Current Filters:
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-red-50 text-red-600 border-red-100 uppercase tracking-tight"
            >
              Late Tasks Only
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-muted/50">
              {modalSearch ? `Search: "${modalSearch}"` : "All Results"}
            </Badge>
            {categoryCounts.OVERDUE +
              categoryCounts.DUE_TODAY +
              categoryCounts.DUE_TOMORROW >
              0 && (
                <Badge variant="outline" className="text-[10px] bg-muted/50">
                  Showing {filtered.length} tasks
                </Badge>
              )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-5 pb-8 bg-white min-h-[350px] custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              {/* <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               */}
              <Loader />
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border sticky top-0 bg-white z-10">
                  {[
                    ["title", "Task Name"],
                    ["instance", "Instance"],
                    ["client", "Client"],
                    ["due_category", "Status"],
                    ["assigned", "Assigned"],
                    ["due_date", "Due Date"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className="text-left py-3 pr-4 font-medium text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      <SortIcon col={key} />
                    </th>
                  ))}
                  {/* <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Actions</th> */}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => {
                  // Use backend-computed fields; fallback for safety
                  const isReviewTask: boolean = !!(t as any).is_review_task;
                  const daysOverdue: number = (t as any).days_overdue ?? 0;
                  const displayDueDate: string | null = isReviewTask
                    ? ((t as any).reviewer_due_date || t.due_date)
                    : t.due_date;

                  return (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedTask(t);
                        setIsModalOpen(true);
                      }}
                    >
                      {/* Task name + REVIEW badge */}
                      <td className="py-3.5 pr-4 font-medium text-foreground">
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {t.title}
                          {isReviewTask && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                              Review
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 text-primary font-medium">
                        {t.instance?.name || "-"}
                      </td>
                      <td className="py-3.5 pr-4 text-primary font-medium">
                        {t.instance?.client?.name || "-"}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge variant="destructive" className="text-[8px] h-4 uppercase">
                          Late
                        </Badge>
                      </td>
                      <td className="py-3.5 pr-4 text-muted-foreground">
                        {t.assigned_user?.name || "-"}
                      </td>
                      {/* Due date: reviewer's level due_date or task due_date */}
                      <td className="py-3.5 pr-4 text-muted-foreground">
                        {formatDate(displayDueDate)}
                      </td>
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      ></td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No tasks match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <TaskModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        selectedTask={selectedTask}
      />
    </div>
  );
}
