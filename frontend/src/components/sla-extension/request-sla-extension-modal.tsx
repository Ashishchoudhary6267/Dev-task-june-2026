"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSLAExtensionStore } from "@/lib/zustand/sla-extension/sla-extension";
import { useToastStore } from "@/lib/zustand/toast-store";
import { Clock, AlertCircle } from "lucide-react";

interface RequestSLAExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  onSuccess?: () => void;
}

export default function RequestSLAExtensionModal({
  isOpen,
  onClose,
  task,
  onSuccess,
}: RequestSLAExtensionModalProps) {
  const [reason, setReason] = useState("");
  const [suggestedDeadline, setSuggestedDeadline] = useState("");
  const { requestExtension, loading } = useSLAExtensionStore();
  const { addToast } = useToastStore();

  const isWeekend = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDay(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
  };
  const handleSubmit = async () => {
    if (reason.trim().length < 20) {
      addToast({
        title: "Reason must be at least 20 characters",
        variant: "destructive",
      });
      return;
    }

    if (
      suggestedDeadline &&
      new Date(suggestedDeadline) <= new Date(task?.due_date)
    ) {
      addToast({
        title: "Suggested deadline must be greater than the original deadline",
        variant: "destructive",
      });
      return;
    }
    if (suggestedDeadline && isWeekend(suggestedDeadline)) {
      addToast({
        title: "Cannot request for Weekends",
        description: "Please select a weekday (Monday to Friday).",
        variant: "warning",
      });
      return;
    }

    const success = await requestExtension(
      task.id,
      reason.trim(),
      suggestedDeadline || undefined,
    );

    if (success) {
      addToast({
        title: "SLA extension request submitted successfully",
        variant: "success",
      });
      setReason("");
      setSuggestedDeadline("");
      onClose();
      onSuccess?.();
    } else {
      addToast({
        title:
          useSLAExtensionStore.getState().error || "Failed to submit request",
        variant: "destructive",
      });
    }
  };

  const calculateOverdueDays = () => {
    if (!task?.due_date) return 0;
    const dueDate = new Date(task.due_date);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const overdueDays = calculateOverdueDays();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request TAT Extension</DialogTitle>
          <DialogDescription>Task: {task?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overdue Alert */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">
                Task is {overdueDays} day{overdueDays !== 1 ? "s" : ""} overdue
              </p>
              <p className="text-xs text-red-700 mt-1">
                Original deadline:{" "}
                {task?.due_date
                  ? new Date(task.due_date).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <Label
              htmlFor="reason"
              className="text-sm font-medium text-gray-700"
            >
              Reason for Extension <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">
                (min 20 characters)
              </span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Client requested additional revisions, extra time needed for quality assurance..."
              rows={5}
              className="mt-2 w-full"
              maxLength={500}
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-xs text-gray-500">
                {reason.length}/500 characters
              </p>
              {reason.length > 0 && reason.length < 20 && (
                <p className="text-xs text-red-500">
                  {20 - reason.length} more characters needed
                </p>
              )}
            </div>
          </div>

          {/* Suggested Deadline (Optional) */}
          <div>
            <Label
              htmlFor="suggested-deadline"
              className="text-sm font-medium text-gray-700"
            >
              Suggested New Deadline{" "}
              <span className="text-xs text-gray-500">(Optional)</span>
            </Label>
            <Input
              id="suggested-deadline"
              type="date"
              value={suggestedDeadline}
              onChange={(e) => setSuggestedDeadline(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="mt-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Controller will review and set the final deadline
            </p>
          </div>

          {/* Info Note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900">
                <p className="font-medium">Note:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Your request will be reviewed by a controller</li>
                  <li>
                    You'll receive a notification once it's approved or rejected
                  </li>
                  <li>Maximum 2 extension requests allowed per task</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || reason.trim().length < 20}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
