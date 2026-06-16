import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Label,
  useToast,
  Button,
} from "@/components/ui";
import api from "@/lib/api";

interface ExtendSLAProps {
  isExtendSlaOpen: boolean;
  setIsExtendSlaOpen: (open: boolean) => void;
  selectedTask: any;
}

const ExtendSLA = ({
  isExtendSlaOpen,
  setIsExtendSlaOpen,
  selectedTask,
}: ExtendSLAProps) => {
  const [slaLoader, setSlaLoader] = useState(false);
  const { addToast } = useToast();
  const [newDeadline, setNewDeadline] = useState("");
  const [SLAreason, setSLAReason] = useState("");

  // Resolve which level is currently active and what deadline to show.
  // If the task is PENDING_APPROVAL the active actor is the lowest PENDING
  // approval level. Otherwise it's the worker (task row).
  const active = useMemo(() => {
    if (
      selectedTask?.status === "PENDING_APPROVAL" &&
      Array.isArray(selectedTask?.task_approval_levels)
    ) {
      const activeLevel = [...selectedTask.task_approval_levels]
        .filter((l: any) => l.status === "PENDING")
        .sort((a: any, b: any) => a.level_number - b.level_number)[0];

      if (activeLevel) {
        return {
          current: activeLevel.due_date || selectedTask?.due_date,
          original: activeLevel.original_due_date || activeLevel.due_date,
          levelLabel: `Approver — Level ${activeLevel.level_number}`,
          role: "APPROVER" as const,
        };
      }
    }

    // Default: worker level
    return {
      current: selectedTask?.due_date,
      original: selectedTask?.original_due_date,
      levelLabel: "Worker",
      role: "WORKER" as const,
    };
  }, [selectedTask]);

  const isOverdue = active.current
    ? new Date(active.current) < new Date()
    : false;

  const handleExtendSLA = async (
    taskId: any,
    deadline: any,
    reason: any,
  ) => {
    setSlaLoader(true);
    try {
      await api.put(`/tasks/${taskId}/extend-sla`, {
        new_deadline: new Date(deadline).toISOString(),
        reason,
      });

      addToast({
        title: "Success",
        description: "SLA extended successfully",
      });
      setNewDeadline("");
      setSLAReason("");
      setIsExtendSlaOpen(false);
    } catch (err: any) {
      addToast({
        title: "Error",
        description:
          err?.response?.data?.message || "Failed to extend SLA. Please try again.",
      });
    } finally {
      setSlaLoader(false);
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

    // Check time is within business hours (9:30 AM – 6:30 PM)
    const [hourStr, minuteStr] = deadline.split("T")[1].split(":");
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    const totalMinutes = hour * 60 + minute;

    const startMinutes = 9 * 60 + 30;  // 9:30 AM
    const endMinutes = 18 * 60 + 30;   // 6:30 PM

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

  return (
    <div>
      <Dialog open={isExtendSlaOpen} onOpenChange={setIsExtendSlaOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Extend SLA (Deadline)
            </DialogTitle>
            <DialogDescription>
              Extend deadline for &quot;{selectedTask?.title}&quot;
            </DialogDescription>
          </DialogHeader>

          {/* Active level + overdue badges */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Extending for:</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                active.role === "APPROVER"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-green-100 text-green-800"
              }`}
            >
              {active.levelLabel}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                ⚠ Overdue
              </span>
            )}
          </div>

          {/* Current & Original deadlines for the active level */}
          <div className="grid grid-cols-2 gap-6 text-sm mt-4">
            <div>
              <p className="text-muted-foreground mb-1">
                Current Deadline{active.role === "APPROVER" ? " (Approver)" : " (Worker)"}
              </p>
              <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
                {active.current
                  ? new Date(active.current).toLocaleString()
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground mb-1">Original SLA</p>
              <p className="font-medium">
                {active.original
                  ? new Date(active.original).toLocaleString()
                  : "—"}
              </p>
            </div>
          </div>

          {/* New Deadline */}
          <div className="mt-6 space-y-2">
            <Label>New Deadline *</Label>
            <div className="flex gap-2">
              <input
                type="date"
                value={newDeadline.split("T")[0] || ""}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  const time = newDeadline.split("T")[1] || "09:30";
                  setNewDeadline(`${e.target.value}T${time}`);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="time"
                value={newDeadline.split("T")[1] || ""}
                onChange={(e) => {
                  const date =
                    newDeadline.split("T")[0] ||
                    new Date().toISOString().split("T")[0];
                  setNewDeadline(`${date}T${e.target.value}`);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {newDeadline &&
              newDeadline.includes("T") &&
              newDeadline.split("T")[1] && (
                <p className="text-xs text-muted-foreground">
                  📅{" "}
                  {new Date(newDeadline).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
          </div>

          {/* Reason */}
          <div className="mt-6 space-y-2">
            <Label>Reason for Extension * (min 20 characters)</Label>
            <textarea
              value={SLAreason}
              onChange={(e) => setSLAReason(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              placeholder="E.g., Client requested additional revisions, extra time needed..."
            />
            <p className="text-xs text-muted-foreground">
              {SLAreason.length}/20 characters
            </p>
          </div>

          {/* Info Note */}
          <div className="mt-6 rounded-lg border border-purple-300 bg-purple-50 p-4 text-sm text-purple-800">
            <strong>Note:</strong> The original SLA will be preserved for
            reporting. Extension will be logged in audit trail.
            {active.role === "APPROVER" && (
              <span className="block mt-1">
                The overall task deadline will also be adjusted proportionally.
              </span>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsExtendSlaOpen(false)}>
              Cancel
            </Button>

            <Button
              disabled={
                !newDeadline ||
                !newDeadline.includes("T") ||
                SLAreason.length < 20 ||
                slaLoader
              }
              onClick={() => {
                if (!validateDeadline(newDeadline)) return;
                handleExtendSLA(selectedTask?.id, newDeadline, SLAreason);
              }}
            >
              {slaLoader ? "Extending..." : "Extend Deadline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExtendSLA;
