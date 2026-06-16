"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
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
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui";
import api from "@/lib/api";
import { useUserStore } from "@/lib/zustand/user/addUser";
import Loader from "../ui/loader";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/zustand/user/user";
import { LinksDialog } from "../shared-components/links-dialog";
import SLAHistorySection from "../sla-extension/sla-history-section";

interface OverdueDetailsModalProps {
  memberId: string;
  memberName: string;
  onClose: () => void;
}
interface LinkItem {
  type: "link" | "title";
  value: string;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "—" || dateStr === "-") return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
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

export default function TaskModal({
  isModalOpen,
  setIsModalOpen,
  selectedTask,
  actions,
}: {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  selectedTask: any | null;
  actions?: React.ReactNode;
}) {
  const { user } = useAuthStore();
  const isManager = user?.workflow_role === "interim_manager";
  const [linksDialogTask, setLinksDialogTask] = useState<any>(null);
  const [fullTask, setFullTask] = useState<any>(null);

  useEffect(() => {
    if (isModalOpen && selectedTask?.id) {
      api.get(`/tasks/detail/${selectedTask.id}`)
        .then(res => setFullTask(res.data?.data || null))
        .catch(() => setFullTask(null));
    } else {
      setFullTask(null);
    }
  }, [isModalOpen, selectedTask?.id]);

  // Calculate performance data only if the task is COMPLETED
  const performanceMetrics = useMemo(() => {
    if (
      !selectedTask ||
      selectedTask.status !== "COMPLETED" ||
      !selectedTask.assigned_at ||
      !selectedTask.submitted_at
    )
      return null;

    console.log("selectedtask", selectedTask);

    const estimatedMinutes = selectedTask.turnaround_minutes || 0;
    const actualMinutes = selectedTask.total_working_minutes || 0;

    if (estimatedMinutes <= 0 && actualMinutes <= 0) return null;

    const estimatedHours = estimatedMinutes / 60;
    const actualHours = actualMinutes / 60;

    const isOverdue = actualMinutes > estimatedMinutes;
    const remainingHours = isOverdue ? 0 : estimatedHours - actualHours;
    const overdueHours = isOverdue ? actualHours - estimatedHours : 0;

    // Progress bar percentage (actual time as % of SLA)
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
  }, [selectedTask]);
  console.log("perfomrmance met", performanceMetrics);

  // Add this helper above your modal JSX
  const currentPendingLevelIndex =
    selectedTask?.task_approval_levels
      ?.sort((a: any, b: any) => a.level_number - b.level_number)
      ?.findIndex((x: any) => x.status !== "APPROVED") ?? -1;

  // Determine if this task is currently awaiting action from the assignee
  const isAssigneePending =
    selectedTask?.status === "IN_PROGRESS" ||
    (selectedTask?.status === "PENDING_APPROVAL" &&
      selectedTask.task_approval_levels
        ?.sort((a: any, b: any) => a.level_number - b.level_number)
        ?.find((x: any) => x.status !== "APPROVED")?.approver?.id ===
      selectedTask.assigned_user?.id);

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

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[90vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto custom-scrollbar">
          {selectedTask && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex items-center justify-between gap-4 w-full">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant={
                          selectedTask.status === "COMPLETED"
                            ? "success"
                            : "outline"
                        }
                      >
                        {selectedTask.status.replace("_", " ")}
                      </Badge>
                      {selectedTask.is_manual && (
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-600 border-purple-200"
                        >
                          Manual Task
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-lg font-semibold leading-tight">
                      {selectedTask.title}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground">
                      {selectedTask.project?.name || "Ad-hoc Manual Task"}
                    </p>
                  </div>
                  {/* Fixed */}
                  {!isManager && actions && (
                    <div className="shrink-0">{actions}</div>
                  )}
                </div>
              </DialogHeader>
              {selectedTask?.status !== "LOCKED" && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {/* Task Progress */}
                  </h4>

                  <div className="relative w-full">
                    {(() => {
                      const steps = [
                        {
                          id: "assigned",
                          label: selectedTask?.submitted_at
                            ? "Assigned"
                            : "Working",
                          sub:
                            selectedTask?.assigned_user?.name || "Unassigned",
                          time: selectedTask?.assigned_at
                            ? new Date(selectedTask.assigned_at).toLocaleString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                            : "—",
                          dotClass: selectedTask?.submitted_at
                            ? "bg-green-500"
                            : "bg-blue-500",
                          isApproved: !!selectedTask?.submitted_at,
                          icon: null,
                          // Worker metrics (only when task is IN_PROGRESS)
                          usedMinutes:
                            selectedTask?.status === "IN_PROGRESS" && !selectedTask?.submitted_at
                              ? selectedTask.total_working_minutes !== undefined
                                ? selectedTask.total_working_minutes +
                                getDurationMinutes(
                                  selectedTask.last_rejected_at ||
                                  selectedTask.assigned_at,
                                  new Date().toISOString(),
                                )
                                : getDurationMinutes(
                                  selectedTask.last_rejected_at ||
                                  selectedTask.assigned_at,
                                  new Date().toISOString(),
                                )
                              : undefined,
                          allocatedMinutes:
                            selectedTask?.status === "IN_PROGRESS"
                              ? (selectedTask.worker_allocated_minutes ??
                                selectedTask.estimated_minutes)
                              : undefined,
                          metrics:
                            selectedTask?.status === "IN_PROGRESS" &&
                              !selectedTask?.submitted_at
                              ? [
                                {
                                  label: "In Progress",
                                  value:
                                    selectedTask.total_working_minutes !== undefined
                                      ? selectedTask.total_working_minutes +
                                      getDurationMinutes(
                                        selectedTask.last_rejected_at ||
                                        selectedTask.assigned_at,
                                        new Date().toISOString(),
                                      )
                                      : getDurationMinutes(
                                        selectedTask.last_rejected_at ||
                                        selectedTask.assigned_at,
                                        new Date().toISOString(),
                                      ),
                                },
                                {
                                  label: "Allocated Time",
                                  value:
                                    selectedTask.worker_allocated_minutes ??
                                    selectedTask.estimated_minutes,
                                },
                                {
                                  label: "Turnaround Time",
                                  value:
                                    selectedTask.turnaround_minutes,
                                },
                              ]
                              : undefined,
                        },
                        ...(selectedTask?.submitted_at
                          ? [
                            {
                              id: "submitted",
                              label: "Submitted",
                              sub: selectedTask?.assigned_user?.name || "—",
                              time: new Date(
                                selectedTask.submitted_at,
                              ).toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }),
                              duration:
                                selectedTask.total_working_minutes !==
                                  undefined
                                  ? formatMinutes(
                                    selectedTask.total_working_minutes,
                                  )
                                  : getDuration(
                                    selectedTask.assigned_at,
                                    selectedTask.submitted_at,
                                  ),
                              durationMinutes: getDurationMinutes(
                                selectedTask.assigned_at,
                                selectedTask.submitted_at,
                              ),
                              usedMinutes: selectedTask.total_working_minutes,
                              allocatedMinutes:
                                selectedTask.worker_allocated_minutes ??
                                selectedTask.estimated_minutes,
                              metrics: [
                                {
                                  label: "Working Time",
                                  value: selectedTask.total_working_minutes,
                                },
                                {
                                  label: "Estimated Time",
                                  value:
                                    selectedTask.estimated_minutes ??
                                    selectedTask.estimated_minutes,
                                },
                                {
                                  label: "Turnaround Time",
                                  value: selectedTask.turnaround_minutes,
                                },
                              ],
                              dotClass: "bg-purple-500",
                              icon: null,
                            },
                          ]
                          : []),
                        ...(selectedTask?.task_approval_levels || [])
                          .sort(
                            (a: any, b: any) => a.level_number - b.level_number,
                          )
                          .map((al: any, index: any, arr: any) => {
                            const isApproved = al.status === "APPROVED";
                            const isRejected = al.status === "REJECTED";
                            const prevTimestamp =
                              index === 0
                                ? selectedTask?.submitted_at
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
                                selectedTask?.status === "IN_PROGRESS" && al.assigned_at
                                  ? getDurationMinutes(
                                    al.assigned_at,
                                    new Date().toISOString(),
                                  )
                                  : al.used_minutes,
                              allocatedMinutes: al.allocated_minutes || 240,
                              metrics:
                                selectedTask?.status === "IN_PROGRESS" && al.assigned_at
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
                                      { label: "In Progress", value: al.used_minutes },
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
                                  ? selectedTask.status ===
                                    "PENDING_APPROVAL" &&
                                    selectedTask.current_level ===
                                    al.level_number
                                    ? "PENDING REVIEW"
                                    : "LOCKED"
                                  : al.status,
                              badgeClass: isApproved
                                ? "bg-green-100 text-green-700"
                                : isRejected
                                  ? "bg-red-100 text-red-700"
                                  : al.status === "PENDING"
                                    ? selectedTask.status ===
                                      "PENDING_APPROVAL" &&
                                      selectedTask.current_level ===
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

                      // ── Enrich reviewer PENDING steps with live elapsed time ──────────
                      const enrichedSteps = steps.map((step: any) => {
                        const approvalLevel =
                          selectedTask?.task_approval_levels?.find(
                            (al: any) =>
                              al.id === step.id && al.status === "PENDING",
                          );
                        if (
                          approvalLevel &&
                          selectedTask?.status === "PENDING_APPROVAL" &&
                          selectedTask?.current_level ===
                          approvalLevel.level_number
                        ) {
                          const storedUsed = approvalLevel.used_minutes || 0;
                          const reviewStartedAt = selectedTask.submitted_at;
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
                        selectedTask?.status === "IN_PROGRESS";
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
                      if (selectedTask?.total_working_minutes !== undefined) {
                        let currentSessionMinutes = 0;
                        if (selectedTask.status === "IN_PROGRESS") {
                          const startTime =
                            selectedTask.last_rejected_at ||
                            selectedTask.assigned_at;
                          if (startTime) {
                            currentSessionMinutes = getDurationMinutes(
                              startTime,
                              new Date().toISOString(),
                            );
                          }
                        }
                        totalTimeSpent = formatMinutes(
                          selectedTask.total_working_minutes +
                          currentSessionMinutes,
                        );
                      }

                      // ── Check if worker is currently overdue (IN_PROGRESS) ──────────
                      const workerOverdue = (() => {
                        if (
                          selectedTask?.status !== "IN_PROGRESS" ||
                          !selectedTask?.due_date
                        )
                          return false;
                        return new Date(selectedTask.due_date) < new Date();
                      })();

                      // ── Check if current reviewer is overdue (PENDING_APPROVAL) ────
                      const reviewerOverdue = (() => {
                        if (selectedTask?.status !== "PENDING_APPROVAL")
                          return false;
                        const currentLevel = (
                          selectedTask?.task_approval_levels || []
                        ).find(
                          (al: any) =>
                            al.status === "PENDING" &&
                            al.level_number === selectedTask?.current_level,
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
                          selectedTask?.assigned_user?.name;

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
                              {/* <div className="mt-2 flex flex-wrap gap-2">
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
                              </div> */}
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

                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    role: "Worker",
                    name: selectedTask.assigned_user?.name || "Unassigned",
                    isPending: isAssigneePending,
                    deadline: selectedTask.due_date || selectedTask.due_date,
                    actedAt: selectedTask.submitted_at,
                    actedLabel: "Submitted",
                    allocatedMinutes: selectedTask.worker_allocated_minutes ?? selectedTask.estimated_minutes ?? selectedTask.turnaround_minutes
                  },
                  ...(selectedTask.task_approval_levels || [])
                    .sort((a: any, b: any) => a.level_number - b.level_number)
                    .map((al: any) => ({
                      role: `L${al.level_number} Reviewer`,
                      name: al.approver?.name || "Unassigned",
                      isPending: al.status === "PENDING" && selectedTask.status === "PENDING_APPROVAL" && selectedTask.current_level === al.level_number,
                      deadline: al.due_date,
                      actedAt: al.acted_at,
                      actedLabel: "Reviewed",
                      allocatedMinutes: al.allocated_minutes || 240
                    }))
                ].map((p, idx) => (
                  <div key={idx} className={cn("p-4 rounded-xl border", p.isPending ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800" : "bg-muted/30 border-border")}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <User className="h-3 w-3" /> {p.role}
                      </div>
                      {p.isPending && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">PENDING</span>
                      )}
                    </div>
                    <div className={cn("text-sm font-semibold mb-4", p.isPending && "text-amber-700 dark:text-amber-400")}>{p.name}</div>
                    <div className="grid grid-cols-2 gap-3 mt-2 pt-3 border-t border-border/50">
                      <div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          <Calendar className="h-3 w-3" /> Deadline
                        </div>
                        <div className="text-xs font-semibold">
                          {p.deadline ? new Date(p.deadline).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "No date"}
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          <Clock className="h-3 w-3" /> {p.actedLabel}
                        </div>
                        <div className="text-xs font-semibold">
                          {p.actedAt ? new Date(p.actedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "Pending"}
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

              {selectedTask.description && (
                <div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-primary" />{" "}
                    Description
                  </h3>
                  <div className="text-sm text-foreground/80 bg-muted/20 p-4 rounded-xl border border-border whitespace-pre-wrap">
                    {selectedTask.description}
                  </div>
                </div>
              )}

              {/* {selectedTask.links && (
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />{" "}
                  Deliverables
                </h3>
                <a
                  href={selectedTask.links}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1.5 bg-primary/5 p-3 rounded-lg border border-primary/10 w-fit"
                >
                  {selectedTask.links}
                </a>
              </div>
            )} */}

              {selectedTask.links ? (
                <div className="flex flex-row items-center gap-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    Deliverables
                  </h3>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLinksDialogTask(selectedTask);
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
                      const items = parseLinkItems(selectedTask.links);
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
              {/* PERFORMANCE WIDGET */}
              {performanceMetrics && (
                <div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-primary" /> Turnaround
                    Performance
                  </h3>
                  <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-6">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">
                            Estimated SLA
                          </p>
                          <p className="text-2xl font-bold font-mono text-foreground">
                            {performanceMetrics.estimated}{" "}
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
                            className={`text-2xl font-bold font-mono ${performanceMetrics.isOverdue ? "text-red-500" : "text-emerald-500"}`}
                          >
                            {performanceMetrics.actual}{" "}
                            <span className="text-sm font-medium text-muted-foreground font-sans">
                              hrs
                            </span>
                          </p>
                        </div>
                      </div>
                      <div>
                        <Badge
                          variant={
                            performanceMetrics.isOverdue
                              ? "destructive"
                              : "success"
                          }
                          className="gap-1.5 shadow-sm px-3 py-1"
                        >
                          {performanceMetrics.isOverdue ? (
                            <>
                              <AlertCircle className="h-3.5 w-3.5" />{" "}
                              {performanceMetrics.overdueHours} hrs Late
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />{" "}
                              {performanceMetrics.remainingHours} hrs Ahead
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>

                    {/* Visual Bar */}
                    <div className="mt-5 pt-5 border-t border-border">
                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex relative shadow-inner">
                        {/* Actual time fill */}
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${performanceMetrics.isOverdue ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{
                            width: `${performanceMetrics.progressPercent}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 px-1">
                        <span className="text-[10px] font-mono font-medium text-muted-foreground">
                          0h
                        </span>
                        <span className="text-[10px] font-mono font-medium text-muted-foreground">
                          {performanceMetrics.estimated}h SLA limit
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* APPROVAL HISTORY */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                  <CheckSquare className="h-4 w-4 text-primary" /> Approval
                  History
                </h3>
                {selectedTask?.task_approval_levels &&
                  selectedTask?.task_approval_levels.length > 0 ? (
                  selectedTask.task_approval_levels
                    .sort((a: any, b: any) => a.level_number - b.level_number)
                    .map((level: any, index: number) => {
                      const isCurrentPending =
                        selectedTask.status === "PENDING_APPROVAL" &&
                        level.status !== "APPROVED" &&
                        index === currentPendingLevelIndex;

                      return (
                        <div
                          key={level.id}
                          className={cn(
                            "flex gap-4 p-3 rounded-xl border bg-card",
                            isCurrentPending
                              ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700"
                              : "border-border",
                          )}
                        >
                          <div className="shrink-0 mt-1">
                            {level.status === "APPROVED" ? (
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              </div>
                            ) : level.status === "REJECTED" ? (
                              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="h-5 w-5 text-red-600" />
                              </div>
                            ) : isCurrentPending ? (
                              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                              </div>
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                                <Clock className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span
                                className={cn(
                                  "text-xs font-semibold",
                                  isCurrentPending &&
                                  "text-amber-700 dark:text-amber-400",
                                )}
                              >
                                Level {level.level_number} Review
                                {isCurrentPending && (
                                  <span className="ml-2 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                    Awaiting
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {level.acted_at
                                  ? new Date(level.acted_at).toLocaleString()
                                  : isCurrentPending
                                    ? "Pending"
                                    : "—"}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mb-2">
                              Reviewer:{" "}
                              <span
                                className={cn(
                                  "font-semibold",
                                  isCurrentPending
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-foreground",
                                )}
                              >
                                {level.approver?.name || "Unassigned"}
                              </span>
                            </div>
                            {level.comment && (
                              <div className="text-xs bg-muted/40 p-2 rounded-lg italic border border-border/50">
                                "{level.comment}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-[10px] text-muted-foreground/60 italic ml-6">
                    No approval levels defined for this task.
                  </p>
                )}
              </div>

              {/* SLA Extension Requests History */}
              <SLAHistorySection taskId={selectedTask.id} />

              {/* CONTROLLER ACTIONS HISTORY */}
              {fullTask && (() => {
                const bypassEvents = (fullTask.task_bypass_logs || []).map((b: any) => ({
                  ...b,
                  _type: b.action === "UNLOCK" ? "unlock" : "bypass",
                }));
                const reassignEvents = (fullTask.task_reassignments || []).map((r: any) => ({ ...r, _type: "reassign" }));
                const slaEvents = (fullTask.task_sla_extensions || []).map((s: any) => ({ ...s, _type: "sla_extend" }));
                const history = [...bypassEvents, ...reassignEvents, ...slaEvents].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                );
                if (history.length === 0) return null;
                return (
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-primary" /> Controller Actions History
                    </h3>
                    <div className="space-y-3">
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
                              <div className="flex items-center gap-2 flex-wrap">
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
                                    {entry._type === "bypass" || entry._type === "unlock"
                                      ? entry.performer?.name
                                      : entry._type === "reassign"
                                        ? entry.reassigner?.name
                                        : entry.requester?.name}
                                  </strong>
                                </span>
                              </div>
                              {entry._type === "bypass" && (
                                <p className="text-muted-foreground text-xs">Step {entry.from_step} → {entry.to_step}</p>
                              )}
                              {entry._type === "reassign" && (
                                <p className="text-muted-foreground text-xs">
                                  {entry.from_user?.name || "?"} → {entry.to_user?.name || "?"}
                                </p>
                              )}
                              {entry._type === "sla_extend" && (
                                <p className="text-muted-foreground text-xs">
                                  Deadline: {new Date(entry.old_deadline).toLocaleDateString()} → {new Date(entry.new_deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <span className="text-muted-foreground text-[11px] bg-background/50 px-2 py-1 rounded shrink-0">
                              {new Date(entry.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          </div>
                          {entry.reason && (
                            <div className="bg-background/80 p-3 rounded-md border border-border/50 text-foreground/90 italic text-sm shadow-sm">
                              "{entry.reason}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* CHECKLIST */}
              {(() => {
                const checklistItems = (fullTask?.task_checklist_progress || selectedTask.task_checklist_progress || [])
                  .slice()
                  .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                if (checklistItems.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-3">
                      <CheckSquare className="h-4 w-4 text-primary" /> Task Checklist
                    </h3>
                    <div className="space-y-2">
                      {checklistItems.map((item: any) => (
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
                                  <div className="h-4 w-4 border-2 border-muted-foreground/30 rounded shrink-0" />
                                )}
                                <span className={`text-sm ${item.is_checked ? "text-muted-foreground line-through" : "text-foreground font-medium"}`}>
                                  {item.item_text}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap font-bold shrink-0 ${item.status === "Done" ? "bg-green-100 text-green-700" : item.status === "Not Needed" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-700"}`}>
                                {item.status || "Pending"}
                              </span>
                            </div>

                            {/* Input value if any */}
                            {(item.requires_input || item.input_value) && (
                              <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5 ml-7">
                                {item.input_label && (
                                  <span className="font-medium">{item.input_label}: </span>
                                )}
                                {item.input_value || <span className="italic opacity-50">No value entered</span>}
                              </div>
                            )}

                            {/* Reviewer rejection feedback */}
                            {Array.isArray(item.reviewer_comments) && item.reviewer_comments.length > 0 && (
                              <div className="mt-1 ml-7 bg-red-50/50 border border-red-100 rounded p-2 text-xs space-y-1 text-red-600">
                                <p className="font-bold">Reviewer Feedback:</p>
                                {item.reviewer_comments.map((c: any, idx: number) => (
                                  <div key={idx}>
                                    <span className="font-semibold">{c.reviewer_name}: </span>
                                    {c.comment} ({new Date(c.created_at).toLocaleString()})
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Links Dialog */}
      <LinksDialog
        task={linksDialogTask}
        onClose={() => setLinksDialogTask(null)}
      />
    </>
  );
}
{
  /* task modal */
}
