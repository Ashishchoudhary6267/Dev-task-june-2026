import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useToast } from "@/components/ui";

interface CommentModalProps {
  commentTask: any;
  onClose: () => void;
  onCommentAdded?: (newComment: any) => void;
}

const CommentModal = ({ commentTask, onClose, onCommentAdded }: CommentModalProps) => {
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const { addToast } = useToast();

  const handleSaveComment = async () => {
    if (!commentTask || !comment.trim()) return;
    try {
      const res = await api.post(`/tasks/${commentTask.id}/comments`, {
        comment: comment.trim(),
      });
      if (res.status === 200) {
        addToast({
          title: "Success",
          description: "Comment added successfully",
        });
        const newComment = res.data.comment;
        if (onCommentAdded) {
          onCommentAdded(newComment);
        }
        setComment("");
        setShowCommentBox(false);
      }
    } catch (err) {
      addToast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={!!commentTask} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comment & Approval History</DialogTitle>
          <DialogDescription>{commentTask?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 max-h-[450px] overflow-y-auto custom-scrollbar px-1">
          {(() => {
            const approvalHistory = (
              commentTask?.task_approval_history || []
            ).filter((h: any) => h.comment && h.comment.trim() !== "");
            const generalComments = commentTask?.comments || [];
            const combined = [
              ...approvalHistory.map((h: any) => ({ ...h, type: "approval" })),
              ...generalComments.map((c: any) => ({ ...c, type: "comment" })),
            ].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );

            if (combined.length === 0) {
              return (
                <p className="text-sm text-muted-foreground text-center py-8 italic">
                  No meaningful comments or history to show.
                </p>
              );
            }

            return (
              <div className="space-y-3">
                {combined?.map((entry: any) => {
                  const isApproval = entry.type === "approval";
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "p-3 rounded-xl border shadow-sm transition-all hover:shadow-md",
                        isApproval
                          ? entry.action === "REJECTED"
                            ? "bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30"
                            : "bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30"
                          : "bg-card border-border",
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1.5 opacity-80">
                        <div className="flex items-center gap-1.5">
                          {isApproval && (
                            <span
                              className={`px-1.5 py-0.5 rounded-sm font-bold uppercase text-[9px] ${entry.action === "REJECTED" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                            >
                              {entry.action}
                            </span>
                          )}
                          <span className="font-bold text-foreground">
                            {isApproval
                              ? entry.actor?.name || "Approver"
                              : entry.author_name || "Member"}
                          </span>
                          <span>·</span>
                          <span className="capitalize">
                            {isApproval
                              ? `Level ${entry.level_number}`
                              : entry.author_role || "Member"}
                          </span>
                        </div>
                        <span className="font-medium whitespace-nowrap">
                          {new Date(entry.created_at).toLocaleString(
                            "en-IN",
                            { dateStyle: "short", timeStyle: "short" },
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {isApproval
                          ? entry.comment || "No comment provided"
                          : entry.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {showCommentBox && (
            <div className="mt-4 p-4 border border-border rounded-lg bg-card shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-200">
              <textarea
                className="w-full min-h-[90px] p-2.5 rounded border bg-background text-sm mb-3 outline-none focus:ring-1 focus:ring-primary/20 resize-none"
                placeholder="Type your message..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCommentBox(false);
                    setComment("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="px-4"
                  onClick={handleSaveComment}
                  disabled={!comment.trim()}
                >
                  Post
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          {!showCommentBox && (
            <Button
              variant="outline"
              onClick={() => setShowCommentBox(true)}
            >
              Add a comment
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CommentModal
