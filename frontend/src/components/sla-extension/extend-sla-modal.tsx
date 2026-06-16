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
import { Calendar, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/zustand/user/user";

interface ExtendSLAModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  onSuccess?: () => void;
}

export default function ExtendSLAModal({
  isOpen,
  onClose,
  request,
  onSuccess,
}: ExtendSLAModalProps) {
  const [newDeadline, setNewDeadline] = useState(
    request.suggested_new_deadline
      ? new Date(request.suggested_new_deadline).toISOString().split("T")[0]
      : "",
  );
  const [reason, setReason] = useState(request.reason || "");
  const [comment, setComment] = useState("");
  const { user } = useAuthStore();

  const { approveRequest, loading, rejectRequest } = useSLAExtensionStore();
  const { addToast } = useToastStore();

  const taskPermission = user?.permissions?.find((p: any) => p.module === 'tasks');
  const canReadTasks = user?.workflow_role === 'interim_manager' ? !!taskPermission?.can_read : true;
  const canWriteTasks = user?.workflow_role === 'interim_manager' ? !!taskPermission?.can_write : true;

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

  const handleApprove = async () => {
    if (!newDeadline) {
      addToast({
        title: "Please select a new deadline",
        variant: "destructive",
      });
      return;
    }

    if (reason.trim().length < 20) {
      addToast({
        title: "Reason must be at least 20 characters",
        variant: "destructive",
      });
      return;
    }

    const success = await approveRequest(
      request.id,
      new Date(newDeadline).toISOString(),
      reason.trim(),
      comment.trim() || undefined,
    );

    if (success) {
      addToast({
        title: "SLA extension approved successfully",
        variant: "success",
      });
      onClose();
      onSuccess?.();
    } else {
      addToast({
        title:
          useSLAExtensionStore.getState().error || "Failed to approve request",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (comment.trim().length < 10) {
      addToast({
        title: "Rejection comment must be at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    const success = await rejectRequest(request.id, comment.trim());

    if (success) {
      addToast({
        title: "SLA extension request rejected",
        variant: "success",
      });
      onClose();
      onSuccess?.();
    } else {
      addToast({
        title:
          useSLAExtensionStore.getState().error || "Failed to reject request",
        variant: "destructive",
      });
    }
  };



  const currentDeadline = request.tasks?.due_date
    ? new Date(request.tasks.due_date).toLocaleString()
    : "N/A";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>Extend SLA (Deadline)</DialogTitle>
          <DialogDescription>
            Extend deadline for "{request.tasks?.title}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">
                Current Deadline
              </p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {currentDeadline}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Original SLA</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">—</p>
            </div>
          </div>

          {/* Member's Request Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs font-medium text-blue-900 mb-2">
              MEMBER'S REQUEST
            </p>
            <p className="text-sm text-blue-800 mb-2">
              <span className="font-medium">Requested by:</span>{" "}
              {request.requested_by_user?.name}
            </p>
            <p className="text-sm text-blue-800">
              <span className="font-medium">Reason:</span> {request.reason}
            </p>
            {request.suggested_new_deadline && (
              <p className="text-sm text-blue-800 mt-2">
                <span className="font-medium">Suggested deadline:</span>{" "}
                {new Date(request.suggested_new_deadline).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* New Deadline */}
          <div>
            <Label className="text-sm font-medium text-gray-700">
              New Deadline <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {/* <Input
                                    type="date"
                                    value={newDeadline}
                                    onChange={(e) => setNewDeadline(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                /> */}
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
          </div>

          {/* Reason for Extension */}
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Reason for Extension <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-2">
                (min 20 characters)
              </span>
            </Label>
            <Textarea
              value={reason}
              readOnly
              onChange={(e) => setReason(e.target.value)}
              placeholder="E.g., Client requested additional revisions, extra time nereded..."
              rows={4}
              className="mt-2"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">
              {reason.length}/500 characters
            </p>
          </div>

          {/* Additional Comment (Optional) */}
          <div>
            <Label className="text-sm font-medium text-gray-700">
              Additional Comment{" "} <span className="text-red-500">*</span>
              {/* <span className="text-xs text-gray-500">(Optional)</span> */}
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Any additional notes for the team member..."
              rows={3}
              className="mt-2"
              maxLength={300}
            />
          </div>

          {/* Note */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-900">
              <span className="font-medium">Note:</span> The original SLA will
              be preserved for reporting. Extension will be logged in audit
              trail.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <DialogFooter>
            {/* <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button> */}
            {(user?.workflow_role === 'interim_manager' && !canWriteTasks) ? (
              null
            ) : (
              <>
                <Button
                  onClick={() => {
                    if (!validateDeadline(newDeadline)) return;
                    handleApprove()
                  }}
                  disabled={loading || !newDeadline || reason.trim().length < 20}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? "Approving" : "Extend Deadline"}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={loading || !newDeadline || reason.trim().length < 20}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Rejecting" : "Reject Request "}
                </Button>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
