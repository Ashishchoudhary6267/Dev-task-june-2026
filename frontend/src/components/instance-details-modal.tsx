"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import CommentModal from "@/components/comments/comment";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  UISelect,
  useToast,
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  Progress,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui";
import api from "@/lib/api";
import {
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Eye,
  FileWarning,
  User,
  CalendarClock,
  Loader2,
  MoreVertical,
  Settings,
  UserCircle,
  Zap,
  FastForward,
  LayoutGrid,
  ChevronRight,
  Activity,
  Info,
  CheckSquare,
  AlertCircle,
  ListChecks,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  X,
  Save,
  ExternalLink,
  Calendar,
  ClipboardCheck,
  PencilIcon,
} from "lucide-react";
import { useUserStore } from "@/lib/zustand/user/addUser";
import { ApprovalLevel, LiveTask } from "@/lib/types/auth";
import Loader from "./ui/loader";
import { cn } from "@/lib/utils";
import { EditApproversModal } from "./edit-approvers-modal";
import { UserSelect } from "./ui/user-select";
import { useAuthStore } from "@/lib/zustand/user/user";
import { useInstanceStore } from "@/lib/zustand/instances/instances";
import SLAHistorySection from "@/components/sla-extension/sla-history-section";
import { LinksDialog } from "./shared-components/links-dialog";
import ExtendSLA from "./sla-extension/extend_sla";
import ReassignDialog, { BypassModal } from "./instance_modal_dialogs/instancehelperDialog";
import { ConveyorBeltTasks } from "./conveyor-belt-tasks";
interface LinkItem {
  type: "link" | "title";
  value: string;
}

interface InstanceModalProps {
  instance: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  LOCKED: {
    label: "not_started",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  IN_PROGRESS: {
    label: "in_progress",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  },
  PENDING_APPROVAL: {
    label: "pending_approval",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-900/30",
  },
  COMPLETED: {
    label: "completed",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-100 dark:bg-green-900/30",
  },
  REJECTED: {
    label: "rejected",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-100 dark:bg-red-900/30",
  },
};

function TatBadge({
  submittedAt,
  dueDate,
}: {
  submittedAt?: string | null;
  dueDate?: string | null;
}) {
  if (!submittedAt || !dueDate) return null;
  const onTime = new Date(submittedAt) <= new Date(dueDate);
  return (
    <span
      className={`ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${onTime
        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        }`}
    >
      {onTime ? "✓ On Time" : "✗ Late"}
    </span>
  );
}

function ApproverBadge({
  level,
  al,
  isCurrentPending,
}: {
  level: number;
  al?: ApprovalLevel;
  isCurrentPending?: boolean;
}) {
  if (!al) return null;
  const approved = al?.status === "APPROVED";
  return (
    <div className="flex items-center gap-1 text-xs mb-1 last:mb-0">
      <span
        className={cn(
          "w-5 h-5 rounded-full font-bold flex items-center justify-center text-[10px]",
          isCurrentPending
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500"
            : "bg-primary/10 text-primary",
        )}
      >
        L{level}
      </span>
      <span
        className={cn(
          approved
            ? "text-green-600 dark:text-green-400"
            : isCurrentPending
              ? "text-amber-500 font-medium"
              : "text-foreground",
        )}
      >
        {al.approver?.name || "Unassigned"}
      </span>
      {approved && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
    </div>
  );
}

const InstanceModal = ({
  instance,
  open,
  onOpenChange,
}: InstanceModalProps) => {
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailedTask, setDetailedTask] = useState<any | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [bypassAction, setBypassAction] = useState("");
  const [isExtendSlaOpen, setIsExtendSlaOpen] = useState(false);
  const [isBypassTaskOpen, setBypassTaskOpen] = useState(false);
  const [isReassignTaskOpen, setReassignTaskOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { addToast } = useToast();
  const [commentTask, setCommentTask] = useState<LiveTask | null>(null);
  const {
    users,
    fetchUsers,
    usercount,
    loading: usersLoading,
  } = useUserStore();
  const [isBypassing, setIsBypassing] = useState(false);
  const [isUnlockTaskOpen, setUnlockTaskOpen] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isEditApproversOpen, setIsEditApproversOpen] = useState(false);
  const [isAgainUnlockTaskOpen, setAgainUnlockTaskOpen] = useState(false);
  const [isReopenLoading, setIsReopenLoading] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [clientComment, setClientComment] = useState("");
  const { user } = useAuthStore();
  const { updateInstanceName } = useInstanceStore();
  const [instanceName, setInstanceName] = useState(instance?.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingInstanceName, setIsEditingInstanceName] = useState(false);

  // Edit Checklist state
  const [isEditChecklistOpen, setIsEditChecklistOpen] = useState(false);
  const [editChecklistTask, setEditChecklistTask] = useState<any>(null);
  const [editChecklistItems, setEditChecklistItems] = useState<any[]>([]);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [newItemPosition, setNewItemPosition] = useState("");
  const [newItemRequiresInput, setNewItemRequiresInput] = useState(false);
  const [newItemInputLabel, setNewItemInputLabel] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");
  const [editingItemLabel, setEditingItemLabel] = useState("");
  const [editingItemRequiresInput, setEditingItemRequiresInput] =
    useState(false);
  const [editingItemPosition, setEditingItemPosition] = useState("");
  const [linksDialogTask, setLinksDialogTask] = useState<any>(null);

  useEffect(() => {
    setInstanceName(instance?.name || "");
  }, [instance?.id, instance?.name]);

  // Reset selected task & detailed task immediately when the dialog box is closed
  useEffect(() => {
    if (!open) {
      setDetailedTask(null);
      setSelectedTask(null);
      setTasks([]);
    }
  }, [open]);

  useEffect(() => {
    if (isReassignTaskOpen) {
      fetchUsers();
    }
  }, [isReassignTaskOpen]);

  const getDurationMinutes = useCallback(
    (start?: string | null, end?: string | null) => {
      if (!start || !end) return 0;
      const startDate = new Date(start);
      const endDate = new Date(end);
      if (endDate <= startDate) return 0;

      const startH = 9,
        startM = 30;
      const endH = 18,
        endM = 30;
      const breakStartH = 13,
        breakStartM = 30;
      const breakEndH = 14,
        breakEndM = 30;

      let totalMinutes = 0;
      let current = new Date(startDate);

      const getDateStr = (d: Date) =>
        d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
      const endStr = getDateStr(endDate);

      while (getDateStr(current) <= endStr) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) {
          const morningStart = new Date(current);
          morningStart.setHours(startH, startM, 0, 0);
          const morningEnd = new Date(current);
          morningEnd.setHours(breakStartH, breakStartM, 0, 0);
          const afternoonStart = new Date(current);
          afternoonStart.setHours(breakEndH, breakEndM, 0, 0);
          const afternoonEnd = new Date(current);
          afternoonEnd.setHours(endH, endM, 0, 0);

          const mFrom = Math.max(startDate.getTime(), morningStart.getTime());
          const mTo = Math.min(endDate.getTime(), morningEnd.getTime());
          if (mTo > mFrom) totalMinutes += (mTo - mFrom) / 60000;

          const aFrom = Math.max(startDate.getTime(), afternoonStart.getTime());
          const aTo = Math.min(endDate.getTime(), afternoonEnd.getTime());
          if (aTo > aFrom) totalMinutes += (aTo - aFrom) / 60000;
        }
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
      }

      return totalMinutes;
    },
    [],
  );

  const formatMinutes = useCallback((mins: number) => {
    if (mins < 60) return `${Math.round(mins)}m`;
    return `${(mins / 60).toFixed(1)}h`;
  }, []);

  const getDuration = useCallback(
    (start?: string | null, end?: string | null) => {
      if (!start || !end) return null;
      const mins = getDurationMinutes(start, end);
      if (mins === 0) return "0m";
      return formatMinutes(mins);
    },
    [getDurationMinutes, formatMinutes],
  );

  const performanceMetrics = useMemo(() => {
    if (
      !detailedTask ||
      detailedTask.status !== "COMPLETED" ||
      !detailedTask.assigned_at ||
      !detailedTask.submitted_at
    )
      return null;

    // Sum of all turnaround minutes (worker + all reviewers)
    const workerTurnaround = detailedTask.turnaround_minutes || 0;
    const reviewersTurnaround = (detailedTask.task_approval_levels || []).reduce(
      (sum: number, al: any) => sum + (al.allocated_minutes || 0),
      0,
    );
    const totalEstimatedMinutes = workerTurnaround + reviewersTurnaround;

    // Sum of all used minutes (worker + all reviewers)
    const workerUsedMinutes = detailedTask.total_working_minutes || 0;
    const reviewersUsedMinutes = (detailedTask.task_approval_levels || []).reduce(
      (sum: number, al: any) => sum + (al.used_minutes || 0),
      0,
    );
    const totalActualMinutes = workerUsedMinutes + reviewersUsedMinutes;

    if (totalEstimatedMinutes <= 0 && totalActualMinutes <= 0) return null;

    const estimatedHours = totalEstimatedMinutes / 60;
    const actualHours = totalActualMinutes / 60;

    const isOverdue = totalActualMinutes > totalEstimatedMinutes;
    const remainingHours = isOverdue ? 0 : estimatedHours - actualHours;
    const overdueHours = isOverdue ? actualHours - estimatedHours : 0;

    const progressPercent =
      estimatedHours > 0
        ? Math.min((actualHours / estimatedHours) * 100, 100)
        : 100;

    return {
      estimated: Math.max(estimatedHours, 0.1).toFixed(1),
      actual: Math.max(actualHours, 0.1).toFixed(1),
      isOverdue,
      remainingHours: remainingHours.toFixed(1),
      overdueHours: overdueHours.toFixed(1),
      progressPercent,
    };
  }, [detailedTask]);
  const refreshTasks = () => {
    if (!instance?.id) return;
    api
      .get(`/instances/${instance.id}`)
      .then((res) => {
        setTasks(res.data.tasks || []);
      })
      .catch(() => { });
  };

  useEffect(() => {
    if (open && instance?.id) {
      setLoading(true);
      api
        .get(`/instances/${instance.id}`)
        .then((res) => {
          setTasks(res.data.tasks || []);
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [open, instance?.id]);

  useEffect(() => {
    if (tasks.length > 0 && !detailedTask) {
      const activeTask = tasks.find(t => ['IN_PROGRESS', 'PENDING_APPROVAL', 'PENDING_WORKER', 'PENDING_CLIENT_REVIEW'].includes(t.status));
      if (activeTask) {
        setDetailedTask(activeTask);
        setSelectedTask(activeTask);
      } else {
        const allDone = tasks.every(t => t.status === 'COMPLETED');
        if (allDone) {
          setDetailedTask(tasks[tasks.length - 1]);
          setSelectedTask(tasks[tasks.length - 1]);
        } else {
          const firstPending = tasks.find(t => t.status !== 'COMPLETED');
          setDetailedTask(firstPending || tasks[0]);
          setSelectedTask(firstPending || tasks[0]);
        }
      }
    }
  }, [tasks]);

  if (!instance) return null;

  const totalTasks = tasks?.length;
  const completedCount = tasks?.filter((t) => t?.status === "COMPLETED").length;
  const progressPct =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const currentTaskOrder =
    tasks?.find(
      (t) => t?.status === "IN_PROGRESS" || t?.status === "PENDING_APPROVAL",
    )?.task_order ?? null;

  function parseLinkItems(raw: string | null | undefined): LinkItem[] {
    if (!raw) return [];

    const URL_REGEX = /https?:\/\/[^\s]+/g;
    const lines = raw.split("\n");
    const items: LinkItem[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const urls = [...line.matchAll(URL_REGEX)].map((m) => m[0]);
      const textPart = line.replace(URL_REGEX, "").trim();

      if (textPart) {
        items.push({ type: "title", value: textPart });
      }

      for (const url of urls) {
        items.push({ type: "link", value: url });
      }
    }

    return items;
  }



  const handleUnlockTask = async (taskId: any, reason: any) => {
    try {
      setIsUnlocking(true);
      const res = await api.post(`/tasks/${taskId}/manual-unlock`, { reason });
      if (res.status === 200) {
        addToast({
          title: "Success",
          description: "Task unlocked successfully",
          variant: "success",
        });
        setReason("");
        setUnlockTaskOpen(false);
        refreshTasks();
      }
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.response?.data?.message || "Failed to unlock task",
        variant: "destructive",
      });
    }
  };

  const handleReopenForRevision = async (taskId: any) => {
    if (!reopenReason.trim()) {
      addToast({
        title: "Error",
        description: "Please enter an internal reason.",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsReopenLoading(true);
      const res = await api.post(`/tasks/${taskId}/reopen-for-revision`, {
        reason: reopenReason.trim(),
        client_comment: clientComment.trim() || undefined,
      });
      if (res.status === 200) {
        addToast({
          title: "Task Reopened",
          description: `Task reopened for client revision. ${res.data.locked_downstream > 0 ? `${res.data.locked_downstream} downstream task(s) locked.` : ""}`,
          variant: "success",
        });
        setAgainUnlockTaskOpen(false);
        setReopenReason("");
        setClientComment("");
        setSelectedTask(null);
        refreshTasks();
      }
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.response?.data?.message || "Failed to reopen task.",
        variant: "destructive",
      });
    } finally {
      setIsReopenLoading(false);
    }
  };

  const { total, completed } = instance.task_stats || {
    total: 0,
    completed: 0,
  };
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

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

  const changesMade = instanceName !== instance?.name;

  const changeNameForInstance = async () => {
    if (!instanceName.trim()) {
      addToast({
        title: "Error",
        description: "Instance name cannot be empty",
        variant: "destructive",
      });
      return;
    }
    if (!changesMade) {
      addToast({
        title: "Error",
        description: "Instance name is same as before",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsEditingInstanceName(true);
      const ok = await updateInstanceName(instance.id, instanceName);
      if (ok) {
        addToast({
          title: "Success",
          description: "Instance name changed successfully",
          variant: "success",
        });
        setIsEditingName(false);
        refreshTasks();
      }
    } catch (err: any) {
      console.error(err);
      addToast({
        title: "Error",
        description:
          err.response?.data?.message || "Failed to change instance name",
        variant: "destructive",
      });
    } finally {
      setIsEditingInstanceName(false);
    }
  };

  const cancelNameEdit = () => {
    setInstanceName(instance?.name || "");
    setIsEditingName(false);
  };

  const canEdit =
    user?.platform_role === "controller" || user?.platform_role === "admin";

  const canEditChecklist = (task: any) => {
    if (!canEdit) return false;
    return task?.status === "LOCKED" || task?.status === "IN_PROGRESS";
  };

  const openEditChecklist = (task: any) => {
    setEditChecklistTask(task);
    const sorted = [...(task.task_checklist_progress || [])].sort(
      (a: any, b: any) => a.sort_order - b.sort_order,
    );
    setEditChecklistItems(sorted);
    setIsEditChecklistOpen(true);
  };

  const handleAddChecklistItem = async () => {
    if (!newItemText.trim() || !editChecklistTask) return;
    try {
      setIsSavingChecklist(true);
      const payload: any = {
        item_text: newItemText.trim(),
        requires_input: newItemRequiresInput,
        input_label: newItemRequiresInput
          ? newItemInputLabel.trim() || null
          : null,
      };

      if (newItemPosition) payload.sort_order = parseInt(newItemPosition);

      const res = await api.post(
        `/tasks/${editChecklistTask.id}/checklist`,
        payload,
      );

      if (res.status === 201) {
        addToast({
          title: "Item Added",
          description: "Checklist item added successfully.",
          variant: "success",
        });
        setNewItemText("");
        setNewItemPosition("");
        setNewItemRequiresInput(false);
        setNewItemInputLabel("");
        refreshTasks();
        // Refresh the local checklist list
        const refreshed = await api.get(`/instances/${instance.id}`);
        const updatedTask = (refreshed.data.tasks || []).find(
          (t: any) => t.id === editChecklistTask.id,
        );
        if (updatedTask) {
          const sorted = [...(updatedTask.task_checklist_progress || [])].sort(
            (a: any, b: any) => a.sort_order - b.sort_order,
          );
          setEditChecklistItems(sorted);
          setEditChecklistTask(updatedTask);
        }
      }
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.response?.data?.message || "Failed to add item.",
        variant: "destructive",
      });
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleSaveEditItem = async (itemId: string) => {
    if (!editChecklistTask) return;
    try {
      setIsSavingChecklist(true);
      const payload: any = {
        item_text: editingItemText.trim(),
        requires_input: editingItemRequiresInput,
        input_label: editingItemRequiresInput
          ? editingItemLabel.trim() || null
          : null,
      };
      if (editingItemPosition)
        payload.sort_order = parseInt(editingItemPosition);

      const res = await api.put(
        `/tasks/${editChecklistTask.id}/checklist/${itemId}`,
        payload,
      );

      addToast({
        title: "Saved",
        description: "Checklist item updated.",
        variant: "success",
      });
      setEditingItemId(null);
      refreshTasks();
      const refreshed = await api.get(`/instances/${instance.id}`);
      const updatedTask = (refreshed.data.tasks || []).find(
        (t: any) => t.id === editChecklistTask.id,
      );
      if (updatedTask) {
        const sorted = [...(updatedTask.task_checklist_progress || [])].sort(
          (a: any, b: any) => a.sort_order - b.sort_order,
        );
        setEditChecklistItems(sorted);
        setEditChecklistTask(updatedTask);
      }
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.response?.data?.message || "Failed to update item.",
        variant: "destructive",
      });
    } finally {
      setIsSavingChecklist(false);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!editChecklistTask) return;
    try {
      setIsSavingChecklist(true);
      const res = await api.delete(
        `/tasks/${editChecklistTask.id}/checklist/${itemId}`,
      );

      addToast({
        title: "Deleted",
        description: "Checklist item removed.",
        variant: "success",
      });
      refreshTasks();
      const refreshed = await api.get(`/instances/${instance.id}`);
      const updatedTask = (refreshed.data.tasks || []).find(
        (t: any) => t.id === editChecklistTask?.id,
      );
      if (updatedTask) {
        const sorted = [...(updatedTask.task_checklist_progress || [])].sort(
          (a: any, b: any) => a.sort_order - b.sort_order,
        );
        setEditChecklistItems(sorted);
        setEditChecklistTask(updatedTask);
      }
    } catch (err: any) {
      addToast({
        title: "Error",
        description: err.response?.data?.message || "Failed to remove item.",
        variant: "destructive",
      });
    } finally {
      setIsSavingChecklist(false);
    }
  };
  const isManager = user?.workflow_role === "interim_manager";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-7xl max-h-[95vh] overflow-y-auto custom-scrollbar">
          <DialogHeader className="space-y-1">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 w-full">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {canEdit ? (
                  isEditingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                        className="h-9 w-[300px] bg-background font-bold text-lg"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") changeNameForInstance();
                          if (e.key === "Escape") cancelNameEdit();
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        type="submit"
                        disabled={isEditingInstanceName}
                        onClick={changeNameForInstance}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isEditingInstanceName}
                        onClick={cancelNameEdit}
                      >
                        Cancel
                      </Button>


                    </div>
                  ) : (
                    <div
                      className="group flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setIsEditingName(true)}
                    >
                      <span className="leading-tight">{instanceName}</span>
                      <PencilIcon className="h-4 w-4 text-muted-foreground transition-opacity" />
                    </div>
                  )
                ) : (
                  <>
                    instanceName
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${instance?.status === "COMPLETED"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-800 text-white dark:bg-gray-700"
                          }`}
                      >
                        {instance?.status}
                      </span>
                    </div>
                  </>
                )}


              </DialogTitle>

              <div className="flex items-center gap-3 mr-6">
                <span className="text-sm text-muted-foreground">Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${instance?.status === "COMPLETED"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : "bg-gray-800 text-white dark:bg-gray-700"
                    }`}
                >
                  {instance?.status}
                </span>
              </div>
            </div>
            <DialogDescription className="flex items-center gap-3 text-sm flex-wrap">
              <Badge variant="outline" className="font-medium bg-muted/30">
                {instance.project?.name || "Manual Template"}
              </Badge>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                {completedCount}/{totalTasks} tasks
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                <div className="flex-1 bg-muted rounded-full h-1.5 min-w-[80px]">
                  <div
                    className="h-1.5 rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">{pct}%</span>
              </div>
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader />
            </div>
          )}

          {/* Task Card Grid replaced by ConveyorBeltTasks */}
          {!loading && (
            <div className="mt-4 rounded-xl border border-border bg-card overflow-hidden">
              <ConveyorBeltTasks tasks={tasks} selectedTaskId={detailedTask?.id || selectedTask?.id} onTaskClick={(task) => { setDetailedTask(task); setSelectedTask(task); }} />
            </div>
          )}

          {/* Inline Task Details — shown below conveyor belt */}
          {!loading && detailedTask && (
            <div className="mt-6 rounded-xl border border-border bg-card shadow-sm overflow-auto custom-scrollbar max-h-[60vh]">
              <div className="p-6">
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-4 flex-wrap w-full">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
                        {detailedTask?.title}
                      </h3>

                      {detailedTask?.status === "COMPLETED" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed
                        </span>
                      )}

                      {detailedTask?.rejection_count ? (
                        <div className="flex items-center gap-1">
                          <span

                            className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm transition-transform hover:scale-105"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {detailedTask.rejection_count} Rejection{detailedTask.rejection_count > 1 ? "s" : ""}
                          </span>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info
                                onClick={() => setCommentTask(detailedTask)}
                                className='text-red-500 h-4 w-4 cursor-pointer hover:text-red-600 transition-colors'
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              View rejection comments
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ) : null}
                    </div>

                    {/* Action Menu - Modern Button */}
                    <div className="ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button
                            // variant="outline"
                            size="sm"
                          // className="h-8 gap-1.5 rounded-lg border-border/60 bg-background/50 backdrop-blur-sm hover:bg-muted/50 transition-all duration-200 shadow-sm px-3"
                          >
                            <MoreVertical className="h-4 w-4" />
                            <span className="text-xs font-medium">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="end"
                          className="w-[200px] p-1.5 rounded-xl border-border/60 shadow-xl bg-card/95 backdrop-blur-sm"
                        >
                          <DropdownMenuItem
                            className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                            onClick={() => setCommentTask(detailedTask)}
                          >
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            <span className="text-sm">Comment</span>
                          </DropdownMenuItem>

                          {canEditChecklist(detailedTask) && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditChecklist(detailedTask);
                              }}
                            >
                              <ClipboardCheck className="h-4 w-4 text-indigo-500" />
                              <span className="text-sm">Edit Checklist</span>
                            </DropdownMenuItem>
                          )}

                          {/* Bypass (only IN_PROGRESS) */}
                          {detailedTask?.status === "IN_PROGRESS" && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                              onClick={() => {
                                setSelectedTask(detailedTask);
                                setBypassTaskOpen(true);
                              }}
                            >
                              <FileWarning className="h-4 w-4 text-amber-500" />
                              <span className="text-sm">Bypass Task</span>
                            </DropdownMenuItem>
                          )}

                          {/* Reassign */}
                          {detailedTask?.status !== "COMPLETED" && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                              onClick={() => {
                                setSelectedTask(detailedTask);
                                setReassignTaskOpen(true);
                              }}
                            >
                              <User className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm">Reassign</span>
                            </DropdownMenuItem>
                          )}

                          {/* again unlock task according to the need of client*/}
                          {detailedTask?.status === "COMPLETED" && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                              onClick={() => {
                                setSelectedTask(detailedTask);
                                setAgainUnlockTaskOpen(true);
                              }}
                            >
                              <FileWarning className="h-4 w-4 text-rose-500" />
                              <span className="text-sm">Unlock Task</span>
                            </DropdownMenuItem>
                          )}

                          {/* Edit Approvers */}
                          {detailedTask?.approval_required &&
                            detailedTask.status !== "COMPLETED" && (
                              <DropdownMenuItem
                                className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                                onClick={() => {
                                  setSelectedTask(detailedTask);
                                  setIsEditApproversOpen(true);
                                }}
                              >
                                <UserCircle className="h-4 w-4 text-purple-500" />
                                <span className="text-sm">Edit Approvers</span>
                              </DropdownMenuItem>
                            )}

                          {/* Extend SLA */}
                          {detailedTask?.status !== "COMPLETED" && (
                            <DropdownMenuItem
                              className="cursor-pointer rounded-md hover:bg-muted/80 transition-colors gap-2.5"
                              onClick={() => {
                                setSelectedTask(detailedTask);
                                setIsExtendSlaOpen(true);
                              }}
                            >
                              <CalendarClock className="h-4 w-4 text-cyan-500" />
                              <span className="text-sm">Extend SLA</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {detailedTask?.description ? (
                    <p className="text-sm leading-relaxed text-muted-foreground/80 bg-muted/10 px-4 py-2.5 rounded-lg border-l-2 border-primary/40 mt-1">
                      {detailedTask.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                      No description provided for this task.
                    </p>
                  )}
                </div>
                {/* Task Timeline / Timestamps Section (Horizontal) */}
                {detailedTask?.status !== "LOCKED" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {/* Task Progress */}
                    </h4>

                    <div className="relative w-full">
                      {(() => {
                        const steps = [
                          {
                            id: "assigned",
                            label: detailedTask?.submitted_at
                              ? "Assigned"
                              : "Working",
                            sub:
                              detailedTask?.assigned_user?.name || "Unassigned",
                            time: detailedTask?.assigned_at
                              ? new Date(detailedTask.assigned_at).toLocaleString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                              : "—",
                            dotClass: detailedTask?.submitted_at
                              ? "bg-green-500"
                              : "bg-blue-500",
                            isApproved: !!detailedTask?.submitted_at,
                            icon: null,
                            // Worker metrics (only when task is IN_PROGRESS)
                            usedMinutes:
                              detailedTask?.status === "IN_PROGRESS" && !detailedTask?.submitted_at
                                ? detailedTask?.total_working_minutes !== undefined
                                  ? detailedTask.total_working_minutes +
                                  getDurationMinutes(
                                    detailedTask?.last_rejected_at ||
                                    detailedTask?.assigned_at,
                                    new Date().toISOString(),
                                  )
                                  : getDurationMinutes(
                                    detailedTask.last_rejected_at ||
                                    detailedTask.assigned_at,
                                    new Date().toISOString(),
                                  )
                                : undefined,
                            allocatedMinutes:
                              detailedTask?.status === "IN_PROGRESS "
                                ? (detailedTask.worker_allocated_minutes ??
                                  detailedTask.estimated_minutes)
                                : undefined,
                            metrics:
                              detailedTask?.status === "IN_PROGRESS" &&
                                !detailedTask?.submitted_at
                                ? [
                                  {
                                    label: "In Progress",
                                    value:
                                      detailedTask.total_working_minutes !== undefined
                                        ? detailedTask.total_working_minutes +
                                        getDurationMinutes(
                                          detailedTask.last_rejected_at ||
                                          detailedTask.assigned_at,
                                          new Date().toISOString(),
                                        )
                                        : getDurationMinutes(
                                          detailedTask.last_rejected_at ||
                                          detailedTask.assigned_at,
                                          new Date().toISOString(),
                                        ),
                                  },
                                  {
                                    label: "Allocated Time",
                                    value:
                                      detailedTask.worker_allocated_minutes ??
                                      detailedTask.estimated_minutes,
                                  },
                                ]
                                : undefined,
                          },
                          ...(detailedTask?.submitted_at
                            ? [
                              {
                                id: "submitted",
                                label: "Submitted",
                                sub: detailedTask?.assigned_user?.name || "—",
                                time: new Date(
                                  detailedTask.submitted_at,
                                ).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }),
                                duration:
                                  detailedTask.total_working_minutes !==
                                    undefined
                                    ? formatMinutes(
                                      detailedTask.total_working_minutes,
                                    )
                                    : getDuration(
                                      detailedTask.assigned_at,
                                      detailedTask.submitted_at,
                                    ),
                                durationMinutes: getDurationMinutes(
                                  detailedTask.assigned_at,
                                  detailedTask.submitted_at,
                                ),
                                usedMinutes: detailedTask.total_working_minutes,
                                allocatedMinutes:
                                  detailedTask.worker_allocated_minutes ??
                                  detailedTask.estimated_minutes,
                                metrics: [
                                  {
                                    label: "Working Time",
                                    value: detailedTask.total_working_minutes,
                                  },
                                  {
                                    label: "Estimated Time",
                                    value:
                                      detailedTask.estimated_minutes ??
                                      detailedTask.estimated_minutes,
                                  },
                                  {
                                    label: "Turnaround Time",
                                    value: detailedTask.turnaround_minutes,
                                  },
                                ],
                                dotClass: "bg-purple-500",
                                icon: null,
                              },
                            ]
                            : []),
                          ...(detailedTask?.task_approval_levels || [])
                            .sort(
                              (a: any, b: any) => a.level_number - b.level_number,
                            )
                            .map((al: any, index: any, arr: any) => {
                              const isApproved = al.status === "APPROVED";
                              const isRejected = al.status === "REJECTED";
                              const prevTimestamp =
                                index === 0
                                  ? detailedTask?.submitted_at
                                  : arr[index - 1]?.acted_at;
                              const time = al.acted_at
                                ? new Date(al.acted_at).toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                : prevTimestamp
                                  ? new Date(prevTimestamp).toLocaleString(
                                    "en-IN",
                                    {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                  : "";

                              return {
                                id: al.id,
                                label: `L${al.level_number} · ${al.approver?.name?.split(" ")[0] || "TBD"}`,
                                sub: null,
                                time,
                                duration: getDuration(prevTimestamp, al.acted_at),
                                durationMinutes: getDurationMinutes(
                                  prevTimestamp,
                                  al.acted_at,
                                ),
                                usedMinutes:
                                  detailedTask?.status === "IN_PROGRESS" && al.assigned_at
                                    ? getDurationMinutes(
                                      al.assigned_at,
                                      new Date().toISOString(),
                                    )
                                    : al.used_minutes,
                                allocatedMinutes: al.allocated_minutes || 240,
                                metrics:
                                  detailedTask?.status === "IN_PROGRESS" && al.assigned_at
                                    ? [
                                      {
                                        label: "In Progress",
                                        value: getDurationMinutes(
                                          al.assigned_at,
                                          new Date().toISOString(),
                                        ),
                                      },
                                      {
                                        label: "Allocated Time",
                                        value: al.allocated_minutes || 240,
                                      },
                                    ]
                                    : al.used_minutes > 0
                                      ? [
                                        { label: "Used time", value: al.used_minutes },
                                        {
                                          label: "Allocated Time",
                                          value: al.allocated_minutes || 240,
                                        },
                                      ]
                                      : [
                                        {
                                          label: "Allocated Time",
                                          value: al.allocated_minutes || 240,
                                        },
                                      ],
                                dotClass: isApproved
                                  ? "bg-green-500"
                                  : isRejected
                                    ? "bg-red-500"
                                    : "bg-slate-400",
                                badge:
                                  al.status === "PENDING"
                                    ? detailedTask.status ===
                                      "PENDING_APPROVAL" &&
                                      detailedTask.current_level ===
                                      al.level_number
                                      ? "PENDING REVIEW"
                                      : "LOCKED"
                                    : al.status,
                                badgeClass: isApproved
                                  ? "bg-green-100 text-green-700"
                                  : isRejected
                                    ? "bg-red-100 text-red-700"
                                    : al.status === "PENDING"
                                      ? detailedTask.status ===
                                        "PENDING_APPROVAL" &&
                                        detailedTask.current_level ===
                                        al.level_number
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-slate-100 text-slate-500"
                                      : "bg-amber-100 text-amber-700",
                                isApproved,
                                isRejected,
                                approverName: al.approver?.name || "Unknown",
                              };
                            }),
                        ];

                        // ── Enrich reviewer PENDING steps with live In Progress ──────────
                        const enrichedSteps = steps.map((step: any) => {
                          const approvalLevel =
                            detailedTask?.task_approval_levels?.find(
                              (al: any) =>
                                al.id === step.id && al.status === "PENDING",
                            );
                          if (
                            approvalLevel &&
                            detailedTask?.status === "PENDING_APPROVAL" &&
                            detailedTask?.current_level ===
                            approvalLevel.level_number
                          ) {
                            const storedUsed = approvalLevel.used_minutes || 0;
                            const reviewStartedAt = detailedTask.submitted_at;
                            const liveElapsed = reviewStartedAt
                              ? getDurationMinutes(
                                reviewStartedAt,
                                new Date().toISOString(),
                              )
                              : 0;
                            const liveUsedMinutes = storedUsed + liveElapsed;
                            return {
                              ...step,
                              liveUsedMinutes,
                              usedMinutes: liveUsedMinutes,
                              allocatedMinutes:
                                approvalLevel.allocated_minutes ||
                                step.allocatedMinutes ||
                                240,
                              metrics: [
                                { label: "In Progress", value: liveUsedMinutes },
                                {
                                  label: "Time Given",
                                  value:
                                    approvalLevel.allocated_minutes ||
                                    step.allocatedMinutes ||
                                    240,
                                },
                              ],
                              durationMinutes:
                                liveUsedMinutes || step.durationMinutes,
                              duration:
                                step.duration || formatMinutes(liveUsedMinutes),
                              isLivePending: true,
                            };
                          }
                          return step;
                        });

                        // ── Bottleneck detection ─────────────────────────────────────────
                        // Skip bottleneck detection while the task is back IN_PROGRESS (after rejection)
                        // — reviewer data is stale and would incorrectly flag them as the bottleneck.
                        let bottleneckStep: any = null;
                        const isTaskBeingReworked =
                          detailedTask?.status === "IN_PROGRESS";
                        if (!isTaskBeingReworked) {
                          const stepsWithSLA = enrichedSteps.filter(
                            (s: any) =>
                              s.usedMinutes != null &&
                              s.allocatedMinutes != null &&
                              s.allocatedMinutes > 0,
                          );

                          if (stepsWithSLA.length > 0) {
                            let worstOvershoot = -Infinity;
                            stepsWithSLA.forEach((s: any) => {
                              const ratio =
                                (s.usedMinutes - s.allocatedMinutes) /
                                s.allocatedMinutes;
                              if (ratio > worstOvershoot) {
                                worstOvershoot = ratio;
                                bottleneckStep = s;
                              }
                            });
                            if (worstOvershoot <= 0) bottleneckStep = null;
                          } else {
                            const maxDuration = Math.max(
                              ...enrichedSteps.map(
                                (s: any) => s.durationMinutes || 0,
                              ),
                            );
                            bottleneckStep =
                              enrichedSteps.find(
                                (s: any) =>
                                  s.durationMinutes === maxDuration &&
                                  maxDuration > 0,
                              ) || null;
                          }
                        }

                        let totalTimeSpent = null;
                        if (detailedTask?.total_working_minutes !== undefined) {
                          let totalMinutes = detailedTask.total_working_minutes || 0;

                          // Worker live time
                          if (detailedTask.status === "IN_PROGRESS") {
                            const startTime =
                              detailedTask.last_rejected_at ||
                              detailedTask.assigned_at;
                            if (startTime) {
                              totalMinutes += getDurationMinutes(
                                startTime,
                                new Date().toISOString(),
                              );
                            }
                          }

                          // Reviewers stored & live time
                          if (detailedTask?.task_approval_levels) {
                            const sortedLevels = [...detailedTask.task_approval_levels].sort((a: any, b: any) => a.level_number - b.level_number);
                            sortedLevels.forEach((al: any, index: number, arr: any[]) => {
                              totalMinutes += (al.used_minutes || 0);

                              if (al.status === "PENDING" && detailedTask.status === "PENDING_APPROVAL" && detailedTask.current_level === al.level_number) {
                                const prevTimestamp = index === 0 ? detailedTask.submitted_at : arr[index - 1]?.acted_at;
                                if (prevTimestamp) {
                                  totalMinutes += getDurationMinutes(prevTimestamp, new Date().toISOString());
                                }
                              }
                            });
                          }

                          totalTimeSpent = formatMinutes(totalMinutes);
                        }

                        // ── Check if worker is currently overdue (IN_PROGRESS) ──────────
                        const workerOverdue = (() => {
                          if (
                            detailedTask?.status !== "IN_PROGRESS" ||
                            !detailedTask?.due_date
                          )
                            return false;
                          return new Date(detailedTask.due_date) < new Date();
                        })();

                        // ── Check if current reviewer is overdue (PENDING_APPROVAL) ────
                        const reviewerOverdue = (() => {
                          if (detailedTask?.status !== "PENDING_APPROVAL")
                            return false;
                          const currentLevel = (
                            detailedTask?.task_approval_levels || []
                          ).find(
                            (al: any) =>
                              al.status === "PENDING" &&
                              al.level_number === detailedTask?.current_level,
                          );
                          if (!currentLevel?.due_date) return false;
                          return new Date(currentLevel.due_date) < new Date();
                        })();

                        // ── Pre-compute bottleneck alert node ────────────────────────────
                        const bottleneckAlert = (() => {
                          if (!bottleneckStep) return null;

                          const isReviewerBottleneck =
                            bottleneckStep.badge !== undefined;
                          const responsibleName = isReviewerBottleneck
                            ? bottleneckStep.approverName || bottleneckStep.label
                            : bottleneckStep.sub ||
                            detailedTask?.assigned_user?.name;

                          const usedStr =
                            bottleneckStep.usedMinutes != null
                              ? formatMinutes(bottleneckStep.usedMinutes)
                              : bottleneckStep.duration;
                          const allocStr =
                            bottleneckStep.allocatedMinutes != null &&
                              bottleneckStep.allocatedMinutes > 0
                              ? formatMinutes(bottleneckStep.allocatedMinutes)
                              : null;
                          const isPending = !!bottleneckStep.isLivePending;

                          return (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                className="flex-shrink-0 mt-0.5"
                              >
                                <path
                                  d="M8 1v10M8 14v1"
                                  stroke="#991B1B"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                              <div className="flex-1">
                                <p className="text-[11px] font-semibold text-red-900">
                                  {isReviewerBottleneck
                                    ? `Review delayed by ${responsibleName}`
                                    : `Task delayed by ${responsibleName}`}
                                </p>
                                <p className="text-[10px] text-red-700 mt-0.5">
                                  {isReviewerBottleneck ? (
                                    <>
                                      {bottleneckStep.label}{" "}
                                      {isPending
                                        ? "has been pending for"
                                        : "took"}{" "}
                                      <span className="font-bold">{usedStr}</span>
                                      {allocStr && (
                                        <>
                                          {" "}
                                          (SLA:{" "}
                                          <span className="font-bold">
                                            {allocStr}
                                          </span>
                                          )
                                        </>
                                      )}
                                      {isPending
                                        ? " — review still in progress, past SLA."
                                        : " — exceeded their review SLA."}
                                    </>
                                  ) : (
                                    <>
                                      {bottleneckStep.label} took{" "}
                                      <span className="font-bold">
                                        {bottleneckStep.duration}
                                      </span>{" "}
                                      — the longest in this workflow.
                                    </>
                                  )}
                                </p>
                                {/* Per-step time breakdown */}
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {enrichedSteps
                                    .filter(
                                      (s: any) => s.duration || s.usedMinutes,
                                    )
                                    .map((s: any) => {
                                      const sUsed =
                                        s.usedMinutes != null
                                          ? formatMinutes(s.usedMinutes)
                                          : s.duration;
                                      const sAlloc =
                                        s.allocatedMinutes != null &&
                                          s.allocatedMinutes > 0
                                          ? formatMinutes(s.allocatedMinutes)
                                          : null;
                                      const sOver =
                                        s.allocatedMinutes > 0 &&
                                        s.usedMinutes > s.allocatedMinutes;
                                      return (
                                        <span
                                          key={s.id}
                                          className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${s.id === bottleneckStep.id
                                            ? "bg-red-100 text-red-800 border-red-300"
                                            : sOver
                                              ? "bg-orange-50 text-orange-700 border-orange-200"
                                              : "bg-white text-slate-600 border-slate-200"
                                            }`}
                                        >
                                          {s.label}: {sUsed}
                                          {sAlloc ? ` / ${sAlloc}` : ""}
                                          {s.isLivePending ? " 🔴" : ""}
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          );
                        })();

                        return (
                          <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Task Progress
                              </h4>
                              <div className="flex items-center gap-2">
                                {workerOverdue && (
                                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                                    WORKER OVERDUE
                                  </span>
                                )}
                                {reviewerOverdue && (
                                  <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                                    REVIEWER OVERDUE
                                  </span>
                                )}
                                {totalTimeSpent && (
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                                    Total Time: {totalTimeSpent}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="relative flex items-start w-full">
                              {/* Track line */}
                              <div className="absolute top-[10px] left-[10px] right-[10px] h-[1.5px] bg-border z-0" />

                              {enrichedSteps.map((step: any, idx: number) => {
                                const isBottleneck =
                                  bottleneckStep && step.id === bottleneckStep.id;

                                return (
                                  <div
                                    key={step.id}
                                    className="relative z-10 flex flex-col items-center flex-1 min-w-0"
                                  >
                                    {/* Wrap entire step node in a Tooltip */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="relative flex flex-col items-center cursor-pointer group">
                                          {/* Main dot */}
                                          <div
                                            className={`w-5 h-5 rounded-full ${isBottleneck
                                              ? "bg-red-500 border border-red-600"
                                              : step.dotClass
                                              } flex items-center justify-center shrink-0 transition-all group-hover:scale-110 group-hover:shadow-md`}
                                            style={
                                              isBottleneck
                                                ? {
                                                  boxShadow:
                                                    "0 0 8px rgba(239, 68, 68, 0.3)",
                                                }
                                                : {}
                                            }
                                          >
                                            {step?.isApproved && (
                                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                              </svg>
                                            )}
                                            {step?.isRejected && (
                                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                                <path d="M3 3l6 6M9 3l-6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                              </svg>
                                            )}
                                            {!step?.isApproved && !step?.isRejected && (
                                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            )}
                                          </div>

                                          {/* Label — always visible */}
                                          <p
                                            className={`text-[10px] font-semibold text-center leading-tight w-full truncate px-0.5 mt-1 ${isBottleneck ? "text-red-600" : ""
                                              }`}
                                          >
                                            {step.label}
                                          </p>

                                          {/* Subtle timestamp — always visible below label */}
                                          {step.time && (
                                            <p className="text-[9px] text-muted-foreground/70 text-center leading-tight mt-0.5 w-full truncate px-0.5">
                                              {step.time}
                                            </p>
                                          )}

                                          {/* Bottleneck indicator dot */}
                                          {isBottleneck && (
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-0.5" />
                                          )}
                                        </div>
                                      </TooltipTrigger>

                                      {/* ── Tooltip content: rich time details ── */}
                                      <TooltipContent
                                        side="bottom"
                                        className="z-[9999] p-0 border-0 shadow-xl bg-transparent max-w-[240px]"
                                      >
                                        <div className="bg-popover border border-border rounded-xl shadow-xl p-3 min-w-[170px] max-w-[240px] space-y-2">
                                          {/* Header */}
                                          <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/60">
                                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isBottleneck ? "bg-red-500" : step.dotClass}`} />
                                            <span className={`text-[11px] font-bold leading-tight ${isBottleneck ? "text-red-600" : "text-foreground"}`}>
                                              {step.label}
                                            </span>
                                            {isBottleneck && (
                                              <span className="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-wide">
                                                Bottleneck
                                              </span>
                                            )}
                                          </div>

                                          {/* Sub (person name) */}
                                          {step.sub && (
                                            <p className="text-[10px] text-muted-foreground font-medium">
                                              👤 {step.sub}
                                            </p>
                                          )}

                                          {/* Status badge */}
                                          {step.badge && (
                                            <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full font-semibold ${step.badgeClass}`}>
                                              {step.badge}
                                            </span>
                                          )}

                                          {/* Metrics */}
                                          {step.metrics && step.metrics.filter((m: any) => m.value != null).length > 0 && (
                                            <div className="flex flex-col gap-1">
                                              {(() => {
                                                const turnaroundMetric = step.metrics.find((tm: any) => {
                                                  const label = (tm.label || "").toLowerCase();
                                                  return label === "turnaround time" || label === "turnaround mins";
                                                });
                                                const turnaroundValue = turnaroundMetric?.value;

                                                return step.metrics.map((m: any, i: number) => {
                                                  if (m.value == null) return null;
                                                  const isPrimary = i === 0;
                                                  const isOver =
                                                    step.usedMinutes > step.allocatedMinutes &&
                                                    step.allocatedMinutes > 0;

                                                  const isWorkingOverTurnaround =
                                                    ((m.label || "").toLowerCase() === "working time" || (m.label || "").toLowerCase() === "working mins") &&
                                                    turnaroundValue != null &&
                                                    m.value > turnaroundValue;

                                                  let bgClass = "bg-slate-50 border-slate-200 text-slate-700";
                                                  if (isPrimary) {
                                                    if (isBottleneck) bgClass = "bg-red-500 border-red-600 text-white";
                                                    else if (isWorkingOverTurnaround) bgClass = "bg-red-50 border-red-200 text-red-700";
                                                    else if (isOver) bgClass = "bg-red-50 border-red-200 text-red-700";
                                                    else bgClass = "bg-emerald-50 border-emerald-200 text-emerald-700";
                                                  } else if (isWorkingOverTurnaround) {
                                                    bgClass = "bg-red-50 border-red-200 text-red-700";
                                                  } else if (m.label === "Turnaround Time" || m.label === "Turnaround Mins") {
                                                    bgClass = "bg-blue-50 border-blue-200 text-blue-700";
                                                  }
                                                  return (
                                                    <div
                                                      key={m.label}
                                                      className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[10px] font-semibold ${bgClass}`}
                                                    >
                                                      <span className="opacity-70 font-bold text-[8px] uppercase tracking-wider">{m.label}</span>
                                                      <span className="font-black">{formatMinutes(m.value)}</span>
                                                    </div>
                                                  );
                                                });
                                              })()}
                                            </div>
                                          )}

                                          {/* Duration fallback */}
                                          {(!step.metrics || step.metrics.filter((m: any) => m.value != null).length === 0) && step.duration && (
                                            <div className="flex items-center justify-between px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-700">
                                              <span className="opacity-70 font-bold text-[8px] uppercase tracking-wider">Duration</span>
                                              <span className="font-black">{step.duration}</span>
                                            </div>
                                          )}

                                          {/* Timestamp */}
                                          {step.time && (
                                            <div className="flex items-center gap-1 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
                                              <Clock className="h-3 w-3 flex-shrink-0" />
                                              <span>{step.time}</span>
                                              {step.isLivePending && (
                                                <span className="ml-auto text-[8px] font-bold text-red-600 animate-pulse">🔴 LIVE</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Bottleneck Alert Box */}
                            {bottleneckAlert}

                            {/* Dynamic Participants Grid */}
                            <div className="mt-4 pt-4 border-t border-border">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                  {
                                    role: "Worker",
                                    name:
                                      detailedTask?.assigned_user?.name ||
                                      "Unassigned",
                                    isPending:
                                      detailedTask?.status === "IN_PROGRESS" ||
                                      detailedTask?.status === "PENDING_WORKER",
                                    deadline:
                                      detailedTask?.due_date ||
                                      detailedTask?.due_date,
                                    actedAt: detailedTask?.submitted_at,
                                    actedLabel: "Submitted",
                                    allocatedMinutes: detailedTask?.worker_allocated_minutes ?? detailedTask?.estimated_minutes ?? detailedTask?.turnaround_minutes
                                  },
                                  ...(detailedTask?.task_approval_levels || [])
                                    .sort(
                                      (a: any, b: any) =>
                                        a.level_number - b.level_number,
                                    )
                                    .map((al: any) => ({
                                      role: `L${al.level_number} Reviewer`,
                                      name: al.approver?.name || "Unassigned",
                                      isPending:
                                        al.status === "PENDING" &&
                                        detailedTask?.status ===
                                        "PENDING_APPROVAL" &&
                                        detailedTask?.current_level ===
                                        al.level_number,
                                      deadline: al.due_date,
                                      actedAt: al.acted_at,
                                      actedLabel: "Reviewed",
                                      allocatedMinutes: al.allocated_minutes || 240
                                    })),
                                ].map((p, idx) => (
                                  <div
                                    key={idx}
                                    className={cn(
                                      "p-4 rounded-xl border",
                                      p.isPending
                                        ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
                                        : "bg-muted/30 border-border",
                                    )}
                                  >
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <User className="h-3 w-3" /> {p.role}
                                      </div>
                                      {p.isPending && (
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                          PENDING
                                        </span>
                                      )}
                                    </div>
                                    <div
                                      className={cn(
                                        "text-sm font-semibold mb-2",
                                        p.isPending &&
                                        "text-amber-700 dark:text-amber-400",
                                      )}
                                    >
                                      {p.name}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                                      <div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                          <Calendar className="h-3 w-3" />{" "}
                                          Deadline
                                        </div>
                                        <div className="text-xs font-semibold">
                                          {p.deadline
                                            ? new Date(p.deadline).toLocaleString(
                                              "en-IN",
                                              {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true,
                                              },
                                            )
                                            : "No date"}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                                          <Clock className="h-3 w-3" />{" "}
                                          {p.actedLabel}
                                        </div>
                                        <div className="text-xs font-semibold">
                                          {p.actedAt
                                            ? new Date(p.actedAt).toLocaleString(
                                              "en-IN",
                                              {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "numeric",
                                                minute: "2-digit",
                                                hour12: true,
                                              },
                                            )
                                            : "Pending"}
                                        </div>
                                      </div>
                                    </div>
                                    {p.allocatedMinutes !== undefined && p.allocatedMinutes !== null && (
                                      <div className="mt-3 pt-2 border-t border-border/30 flex justify-between items-center text-xs">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3.5 w-3.5 text-primary" /> Time Given
                                        </span>
                                        <span className="font-semibold text-foreground">
                                          {formatMinutes(p.allocatedMinutes)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
                {/* completion time badge */}

                {detailedTask?.status === "COMPLETED" && performanceMetrics && (
                  <>
                    <div className="my-4">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2">
                        Task Timeline
                      </h4>
                    </div>
                    <div className="flex items-center justify-between mb-2 pt-4">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">
                            Estimated SLA
                          </p>
                          <p className="text-2xl font-bold font-mono text-foreground">
                            {performanceMetrics?.estimated}{" "}
                            <span className="text-sm font-medium text-muted-foreground font-sans">
                              hrs
                            </span>
                          </p>
                        </div>
                        <div className="border-l border-border pl-6">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">
                            Actual Time
                          </p>
                          <p
                            className={`text-2xl font-bold font-mono ${performanceMetrics?.isOverdue ? "text-red-500" : "text-emerald-500"}`}
                          >
                            {performanceMetrics?.actual}{" "}
                            <span className="text-sm font-medium text-muted-foreground font-sans">
                              hrs
                            </span>
                          </p>
                        </div>
                      </div>
                      <div>
                        <Badge
                          variant={
                            performanceMetrics?.isOverdue
                              ? "destructive"
                              : "success"
                          }
                          className="gap-1.5 shadow-sm px-3 py-1"
                        >
                          {performanceMetrics?.isOverdue ? (
                            <>
                              <AlertCircle className="h-3.5 w-3.5" />{" "}
                              {performanceMetrics?.overdueHours} hrs Late
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                              {performanceMetrics?.remainingHours} hrs Ahead
                            </>
                          )}
                        </Badge>
                      </div>

                      {/* Visual Bar */}
                      {/* <div className="mt-5 pt-5 border-t border-border">
                                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex relative shadow-inner"> */}
                      {/* Actual time fill */}
                      {/* <div
                                              className={`h-full rounded-full transition-all duration-1000 ${performanceMetrics?.isOverdue ? 'bg-red-500' : 'bg-emerald-500'}`}
                                              style={{ width: `${performanceMetrics?.progressPercent}%` }}
                                          />
                                      </div>
                                      <div className="flex justify-between mt-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 px-0.5">
                                          <span>SLA Start</span>
                                          <span>Deadline</span>
                                      </div> */}
                      {/* </div> */}
                    </div>
                  </>
                )}

                {detailedTask?.links ? (
                  <div className="flex flex-row items-center gap-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      Deliverables
                    </h3>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinksDialogTask(detailedTask);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-[11px] transition-colors border border-blue-200"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>

                      {(() => {
                        const items = parseLinkItems(detailedTask?.links);
                        const linksCount = items.filter(
                          (i) => i.type === "link",
                        ).length;

                        return `${linksCount} link${linksCount !== 1 ? "s" : ""}`;
                      })()}
                    </button>
                  </div>
                ) : (
                  ""
                )}
                <div className="space-y-6 pt-4">
                  {detailedTask &&
                    (detailedTask.task_checklist_progress || []).length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2">
                          Checklist
                        </h4>
                        <div className="space-y-2 pt-1">
                          {(detailedTask.task_checklist_progress || [])
                            .slice()
                            .sort((a: any, b: any) => a.sort_order - b.sort_order)
                            .map((item: any) => (
                              <div
                                key={item.id}
                                className={`rounded-lg border p-3 transition-all ${item.is_checked ? "bg-green-50/50 border-green-200/50 dark:bg-green-900/10 dark:border-green-800/20" : "bg-card border-border"}`}
                              >
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      {item.is_checked ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                                      )}
                                      <span
                                        className={`text-sm ${item.is_checked ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}
                                      >
                                        {item.item_text}
                                      </span>
                                    </div>
                                    {!item.requires_input ? (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold ${item.status === "Done" ? "bg-green-100 text-green-700" : item.status === "Not Needed" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-700"}`}
                                      >
                                        {item.status || "Pending"}
                                      </span>
                                    ) : null}
                                  </div>
                                  {(item.requires_input || item.input_value) && (
                                    <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5 ml-7">
                                      {item.input_label && (
                                        <span className="font-medium">
                                          {item.input_label}:{" "}
                                        </span>
                                      )}
                                      {item.input_value || (
                                        <span className="italic opacity-50">
                                          No value entered
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {item.reviewer_comments &&
                                    item.reviewer_comments.length > 0 && (
                                      <div className="mt-1 ml-7 bg-red-50/50 border border-red-100 rounded p-2 text-xs space-y-1 text-red-600">
                                        <p className="font-bold">
                                          Reviewer Feedback:
                                        </p>
                                        {item.reviewer_comments.map(
                                          (c: any, idx: number) => (
                                            <div key={idx}>
                                              <span className="font-semibold">
                                                {c.reviewer_name}:{" "}
                                              </span>
                                              {c.comment} (
                                              {new Date(
                                                c.created_at,
                                              ).toLocaleString()}
                                              )
                                            </div>
                                          ),
                                        )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {/* Controller Actions History */}
                  {detailedTask &&
                    (() => {
                      const bypassEvents = (
                        detailedTask.task_bypass_logs || []
                      ).map((b: any) => ({
                        ...b,
                        _type: b.action === "UNLOCK" ? "unlock" : "bypass",
                      }));
                      const reassignEvents = (
                        detailedTask.task_reassignments || []
                      ).map((r: any) => ({ ...r, _type: "reassign" }));
                      const slaEvents = (
                        detailedTask.task_sla_extensions || []
                      ).map((s: any) => ({ ...s, _type: "sla_extend" }));
                      const history = [
                        ...bypassEvents,
                        ...reassignEvents,
                        ...slaEvents,
                      ].sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime(),
                      );
                      if (history.length === 0) return null;
                      return (
                        <div className="space-y-3 mt-6">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2">
                            Controller Actions History
                          </h4>
                          <div className="space-y-3 pt-2">
                            {history.map((entry: any) => (
                              <div
                                key={entry.id}
                                className={`p-4 rounded-lg border text-sm ${entry._type === "bypass"
                                  ? "bg-orange-50/50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800"
                                  : entry._type === "unlock"
                                    ? "bg-teal-50/50 border-teal-200 dark:bg-teal-900/10 dark:border-teal-800"
                                    : entry._type === "reassign"
                                      ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800"
                                      : "bg-purple-50/50 border-purple-200 dark:bg-purple-900/10 dark:border-purple-800"
                                  }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                      {entry._type === "bypass" && (
                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                          ⚡ {entry.action || "BYPASS"}
                                        </span>
                                      )}
                                      {entry._type === "unlock" && (
                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                                          🔓 UNLOCKED EARLY
                                        </span>
                                      )}
                                      {entry._type === "reassign" && (
                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                          🔁 REASSIGNED
                                        </span>
                                      )}
                                      {entry._type === "sla_extend" && (
                                        <span className="font-bold px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                          📅 SLA EXTENDED
                                        </span>
                                      )}
                                      <span className="text-muted-foreground text-xs">
                                        by{" "}
                                        <strong className="text-foreground">
                                          {entry._type === "bypass" ||
                                            entry._type === "unlock"
                                            ? entry.performer?.name
                                            : entry._type === "reassign"
                                              ? entry.reassigner?.name
                                              : entry.requester?.name}
                                        </strong>
                                      </span>
                                    </div>
                                    {entry._type === "bypass" && (
                                      <p className="text-muted-foreground text-xs">
                                        Step {entry.from_step} → {entry.to_step}
                                      </p>
                                    )}
                                    {entry._type === "reassign" && (
                                      <p className="text-muted-foreground text-xs">
                                        {entry.from_user?.name || "?"} →{" "}
                                        {entry.to_user?.name || "?"}
                                      </p>
                                    )}
                                    {entry._type === "sla_extend" && (
                                      <p className="text-muted-foreground text-xs">
                                        Deadline:{" "}
                                        {new Date(
                                          entry.old_deadline,
                                        ).toLocaleDateString()}{" "}
                                        →{" "}
                                        {new Date(
                                          entry.new_deadline,
                                        ).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground text-[11px] bg-background/50 px-2 py-1 rounded">
                                    {new Date(entry.created_at).toLocaleString(
                                      "en-IN",
                                      { dateStyle: "medium", timeStyle: "short" },
                                    )}
                                  </span>
                                </div>
                                <div className="bg-background/80 p-3 rounded-md border border-border/50 text-foreground/90 italic text-sm shadow-sm">
                                  "{entry.reason}"
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* SLA Extension Requests History */}
                {detailedTask && <SLAHistorySection taskId={detailedTask.id} />}

              </div>
            </div>
          )}


          {/* ── All dialogs live here, outside the map loop ── */}

          {/* Comment Modal */}
          <CommentModal
            commentTask={commentTask}
            onClose={() => setCommentTask(null)}
            onCommentAdded={(newComment) => {
              setTasks((prevTasks) =>
                prevTasks.map((t) =>
                  t.id === commentTask?.id
                    ? { ...t, comments: [...(t.comments || []), newComment] }
                    : t,
                ),
              );
              setCommentTask((prev) =>
                prev
                  ? {
                    ...prev,
                    comments: [...(prev.comments || []), newComment],
                  }
                  : null,
              );
            }}
          />

          <ReassignDialog isReassignTaskOpen={isReassignTaskOpen}
            setReassignTaskOpen={setReassignTaskOpen} selectedTask={selectedTask} setSelectedTask={() => setSelectedTask(null)}
            onSuccess={refreshTasks} />


          {/* Bypass Dialog — no DialogTrigger, state-controlled only */}

          <BypassModal
            isBypassTaskOpen={isBypassTaskOpen}
            setBypassTaskOpen={setBypassTaskOpen}
            selectedTask={selectedTask}
            setSelectedTask={() => setSelectedTask(null)}
            onSuccess={refreshTasks}
          />

          {/* Unlock Dialog — no DialogTrigger, state-controlled only */}
          <Dialog open={isUnlockTaskOpen} onOpenChange={setUnlockTaskOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-teal-600 font-bold">
                  Unlock Task Early
                </DialogTitle>
                <DialogDescription>
                  Manual unlock for "{selectedTask?.title}"
                </DialogDescription>
              </DialogHeader>

              <div className="pt-4 space-y-2">
                <Label htmlFor="unlock-reason">Reason for Unlocking *</Label>
                <Input
                  id="unlock-reason"
                  placeholder="Why are you unlocking this task ahead of schedule?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <DialogFooter>
                <div className="p-2 flex gap-2">
                  <DialogClose>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    disabled={!reason || isUnlocking}
                    onClick={() => handleUnlockTask(selectedTask?.id, reason)}
                  >
                    {isUnlocking ? "Unlocking..." : "Unlock Task"}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ── Client Revision: Reopen Completed Task ─────────────── */}
          <Dialog
            open={isAgainUnlockTaskOpen}
            onOpenChange={(open) => {
              setAgainUnlockTaskOpen(open);
              if (!open) {
                setReopenReason("");
                setClientComment("");
              }
            }}
          >
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight text-base">
                  <FileWarning className="h-5 w-5 text-orange-500" />
                  Client Revision Request
                </DialogTitle>
                <DialogDescription className="text-xs font-medium">
                  Reopen{" "}
                  <span className="font-bold text-foreground">
                    "{selectedTask?.title}"
                  </span>{" "}
                  so the assignee can make changes requested by the client.
                </DialogDescription>
              </DialogHeader>

              {/* Warning banner */}
              <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-xs text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                <div className="space-y-1">
                  <p className="font-bold">What will happen:</p>
                  <ul className="list-disc list-inside space-y-0.5 font-medium">
                    <li>
                      This task →{" "}
                      <span className="font-bold text-orange-900 dark:text-orange-200">
                        IN_PROGRESS
                      </span>{" "}
                      (checklist &amp; approvals reset)
                    </li>
                    <li>
                      All subsequent tasks in this instance →{" "}
                      <span className="font-bold text-orange-900 dark:text-orange-200">
                        LOCKED
                      </span>
                    </li>
                    <li>
                      If the instance was completed, it will revert to{" "}
                      <span className="font-bold">ONGOING</span>
                    </li>
                    <li>Assigned member will receive a notification</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4 mt-1">
                {/* Internal reason (required) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="reopen-reason"
                    className="text-xs font-bold uppercase text-muted-foreground"
                  >
                    Internal Reason <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="reopen-reason"
                    placeholder="Why is this task being reopened? (audit log)"
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                  />
                </div>

                {/* Client comment (optional — shown to the member as rejection comment) */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="client-comment"
                    className="text-xs font-bold uppercase text-muted-foreground"
                  >
                    Client's Feedback{" "}
                    <span className="text-muted-foreground/60 font-normal normal-case">
                      (optional — visible to the member)
                    </span>
                  </Label>
                  <textarea
                    id="client-comment"
                    rows={3}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                    placeholder="Paste the client's exact feedback or change request here..."
                    value={clientComment}
                    onChange={(e) => setClientComment(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 mt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAgainUnlockTaskOpen(false);
                    setReopenReason("");
                    setClientComment("");
                  }}
                  disabled={isReopenLoading}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
                  disabled={!reopenReason.trim() || isReopenLoading}
                  onClick={() => handleReopenForRevision(selectedTask?.id)}
                >
                  {isReopenLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Reopening...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FileWarning className="h-4 w-4" /> Reopen for Revision
                    </span>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* eXTEND SLA */}
          <ExtendSLA
            isExtendSlaOpen={isExtendSlaOpen}
            setIsExtendSlaOpen={setIsExtendSlaOpen}
            selectedTask={selectedTask}
          />


          <DialogFooter className="mt-4">
            <DialogClose>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent >

        <EditApproversModal
          open={isEditApproversOpen}
          onOpenChange={setIsEditApproversOpen}
          task={selectedTask}
          onSuccess={refreshTasks}
        />

        {/* ── Edit Checklist Dialog ─────────────────────────────────── */}
        <Dialog
          open={isEditChecklistOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsEditChecklistOpen(false);
              setEditingItemId(null);
              setNewItemText("");
              setNewItemPosition("");
              setNewItemRequiresInput(false);
              setNewItemInputLabel("");
            }
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-base">
                <ListChecks className="h-5 w-5 text-primary" />
                Edit Checklist —{" "}
                <span className="text-muted-foreground font-medium truncate max-w-[260px]">
                  {editChecklistTask?.title}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Task is <strong>{editChecklistTask?.status}</strong>. Add,
                reorder, or remove checklist items.
              </DialogDescription>
            </DialogHeader>

            {/* ── Add New Item ── */}
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-3 mt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-primary/70">
                Add New Item
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Item text..."
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddChecklistItem();
                    }}
                  />
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Pos"
                    min={1}
                    value={newItemPosition}
                    onChange={(e) => setNewItemPosition(e.target.value)}
                    title="1-based position (leave blank to append)"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={newItemRequiresInput}
                      onChange={(e) =>
                        setNewItemRequiresInput(e.target.checked)
                      }
                    />
                    Requires Input
                  </label>
                  {newItemRequiresInput && (
                    <input
                      className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Input label (e.g. Subject Line)"
                      value={newItemInputLabel}
                      onChange={(e) => setNewItemInputLabel(e.target.value)}
                    />
                  )}
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={!newItemText.trim() || isSavingChecklist}
                  onClick={handleAddChecklistItem}
                >
                  {isSavingChecklist ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Add Item
                </Button>
              </div>
            </div>

            {/* ── Existing Items List ── */}
            <div className="space-y-2 mt-2">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {editChecklistItems.length} Items
              </p>
              {editChecklistItems.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8 italic">
                  No checklist items yet.
                </p>
              )}
              {editChecklistItems.map((item: any, idx: number) => {
                const isEditing = editingItemId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition-all ${isEditing
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-border/80"
                      }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            value={editingItemText}
                            onChange={(e) => setEditingItemText(e.target.value)}
                            autoFocus
                          />
                          <input
                            type="number"
                            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="Pos"
                            min={1}
                            value={editingItemPosition}
                            onChange={(e) =>
                              setEditingItemPosition(e.target.value)
                            }
                            title="Move to position (1-based)"
                          />
                        </div>
                        <div className="flex items-center gap-3 ml-7">
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="accent-primary"
                              checked={editingItemRequiresInput}
                              onChange={(e) =>
                                setEditingItemRequiresInput(e.target.checked)
                              }
                            />
                            Requires Input
                          </label>
                          {editingItemRequiresInput && (
                            <input
                              className="flex-1 rounded-lg border border-border bg-background px-3 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/30"
                              placeholder="Input label"
                              value={editingItemLabel}
                              onChange={(e) =>
                                setEditingItemLabel(e.target.value)
                              }
                            />
                          )}
                        </div>
                        <div className="flex justify-end gap-2 ml-7">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingItemId(null)}
                          >
                            <X className="h-3.5 w-3.5" /> Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs gap-1"
                            disabled={
                              isSavingChecklist || !editingItemText.trim()
                            }
                            onClick={() => handleSaveEditItem(item.id)}
                          >
                            {isSavingChecklist ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground/60 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.item_text}
                          </p>
                          {item.requires_input && (
                            <p className="text-[10px] text-primary/70 font-medium mt-0.5">
                              Input: {item.input_label || "Unlabelled"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Edit"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingItemText(item.item_text);
                              setEditingItemRequiresInput(
                                item.requires_input || false,
                              );
                              setEditingItemLabel(item.input_label || "");
                              setEditingItemPosition("");
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors text-muted-foreground"
                            title="Delete"
                            disabled={isSavingChecklist}
                            onClick={() => handleDeleteChecklistItem(item.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditChecklistOpen(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Dialog >

      {/* Links Dialog */}
      < LinksDialog
        task={linksDialogTask}
        onClose={() => setLinksDialogTask(null)}
      />

      < CommentModal
        commentTask={commentTask}
        onClose={() => setCommentTask(null)}
        onCommentAdded={(newComment) => {
          setTasks((prevTasks) =>
            prevTasks.map((t) =>
              t.id === commentTask?.id
                ? { ...t, comments: [...(t.comments || []), newComment] }
                : t,
            ),
          );
          setCommentTask((prev) =>
            prev
              ? { ...prev, comments: [...(prev.comments || []), newComment] }
              : null,
          );
        }}
      />
    </>
  );
};

export default InstanceModal;
