import { X, AlertTriangle, Calendar, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui";

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
      created_at?: string;
    }>;
  }>;
}

interface TaskRejectionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskId: string;
  rejectionEvents: RejectionEvent[];
}

export default function TaskRejectionDetailsModal({
  isOpen,
  onClose,
  taskTitle,
  taskId,
  rejectionEvents,
}: TaskRejectionDetailsModalProps) {
  if (!isOpen) return null;

  const sortedEvents = [...rejectionEvents].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-[90vw] sm:max-w-2xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h2 className="text-lg font-semibold text-foreground">
                Rejection History
              </h2>
            </div>
            <p className="text-sm text-foreground font-medium">{taskTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total Rejections:{" "}
              <span className="font-bold text-red-600">
                {rejectionEvents.length}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sortedEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No rejection history found for this task.
            </div>
          ) : (
            sortedEvents.map((event, index) => (
              <div
                key={event.id}
                className="rounded-lg border border-border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
              >
                {/* Rejection Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                      {sortedEvents.length - index}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Rejection #{sortedEvents.length - index}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Level {event.level_number}
                  </span>
                </div>

                {/* Reviewer Info */}
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {event.actor_name}
                  </span>
                  {event.actor_role && (
                    <span className="text-xs text-muted-foreground">
                      ({event.actor_role})
                    </span>
                  )}
                </div>

                {/* Timestamp */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                {/* Comment */}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Rejection Comment:
                      </p>
                      {event.comment ? (
                        <p className="text-sm text-foreground leading-relaxed">
                          {event.comment}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No comment provided
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reviewer Comments from Checklist */}
                {event.reviewer_comments &&
                  event.reviewer_comments.length > 0 && (() => {
                    const eventTime = new Date(event.created_at).getTime();

                    // For each checklist item, only keep comments made at or before this rejection
                    const filteredItems = event.reviewer_comments
                      .map((item) => ({
                        ...item,
                        reviewer_comments: (item.reviewer_comments || []).filter(
                          (c) => c.created_at
                            ? new Date(c.created_at).getTime() <= eventTime
                            : true
                        ),
                      }))
                      .filter((item) => item.reviewer_comments.length > 0);

                    if (filteredItems.length === 0) return null;

                    return (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Reviewer Comments on Checklist Items:
                        </p>
                        <div className="space-y-2">
                          {filteredItems.map((item) => (
                            <div
                              key={item.id}
                              className="bg-card rounded border border-border p-2"
                            >
                              <p className="text-xs font-medium text-foreground mb-1">
                                • {item.item_text}
                              </p>
                              <div className="ml-3 space-y-1">
                                {item.reviewer_comments.map(
                                  (comment, cIdx) => (
                                    <p
                                      key={cIdx}
                                      className="text-xs text-muted-foreground italic"
                                    >
                                      "{comment.comment || "No comment"}"
                                      {comment.reviewer_name && (
                                        <span className="text-muted-foreground font-medium ml-1">
                                          - {comment.reviewer_name} -{" "}
                                          {comment.created_at
                                            ? new Date(
                                                comment.created_at,
                                              ).toLocaleString("en-US", {
                                                dateStyle: "short",
                                                timeStyle: "short",
                                              })
                                            : ""}
                                        </span>
                                      )}
                                    </p>
                                  ),
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
