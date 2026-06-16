import React from "react";
import { CheckCircle2, XCircle, Loader2, CircleDashed, Clock, Circle } from "lucide-react";
import { LiveTask } from "@/lib/types/auth";
import { cn } from "@/lib/utils";

interface ConveyorBeltTasksProps {
  tasks: LiveTask[];
  selectedTaskId: string | null | undefined;
  onTaskClick: (task: LiveTask) => void;
}

function getTaskStatus(task: LiveTask): "done" | "late" | "active" | "idle" {
  if (task.status === "COMPLETED") {
    if (
      task.bottleneck ||
      (task.due_date &&
        new Date(task.due_date) < new Date(task.submitted_at || new Date()))
    ) {
      return "late";
    }
    return "done";
  }
  if (task.status === "IN_PROGRESS" || task.status === "PENDING_APPROVAL") {
    return "active";
  }
  return "idle";
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
  late: { label: "Late", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  active: { label: "Active", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  idle: { label: "Queued", cls: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
};

const NODE_STYLE: Record<string, string> = {
  done: "bg-green-500 border-green-400 shadow-green-500/30 shadow-md",
  late: "bg-red-500 border-red-400 shadow-red-500/30 shadow-md",
  active: "bg-amber-500 border-amber-400 shadow-amber-500/40 shadow-lg",
  idle: "bg-muted border-border text-muted-foreground",
};

const LINE_STYLE: Record<string, string> = {
  done: "bg-green-500",
  late: "bg-red-500",
  active: "bg-gradient-to-r from-amber-500 to-muted",
  idle: "bg-border",
};

export function ConveyorBeltTasks({
  tasks,
  selectedTaskId,
  onTaskClick,
}: ConveyorBeltTasksProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="w-full px-4 py-4 overflow-x-auto">
      <style>{`
        @keyframes cb-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(245,158,11,0.25); }
          50%       { box-shadow: 0 0 0 6px rgba(245,158,11,0.08); }
        }
        .cb-pulse { animation: cb-pulse 1.8s ease-in-out infinite; }
        @keyframes cb-line-flow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
          @keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.animate-blink {
  animation: blink 1s infinite;
}
      `}</style>

      {/* ── Compact single-row belt ── */}
      <div className="flex items-center w-full">
        {tasks.map((task, idx) => {
          const status = getTaskStatus(task);
          const isSelected = selectedTaskId === task.id;
          const isLast = idx === tasks.length - 1;
          const badge = STATUS_BADGE[status];
          const nodeStyle = NODE_STYLE[status];
          const lineStyle = LINE_STYLE[status];

          const icon =
            status === "done" ? <CheckCircle2 className="h-4 w-4 text-white" /> :
              status === "late" ? <XCircle className="h-4 w-4 text-white" /> :
                status === "active" ? <Circle className="h-4 w-4 text-white animate-blink" /> :
                  <CircleDashed className="h-4 w-4 text-muted-foreground" />;

          return (
            <React.Fragment key={task.id}>
              {/* Node column */}
              <div
                className={cn(
                  "flex flex-col items-center gap-1 cursor-pointer group relative flex-shrink-0",
                  isMobile ? "w-[72px]" : "w-[90px]"
                )}
                onClick={() => onTaskClick(task)}
              >
                {/* Step number */}
                <span className="text-[9px] font-bold text-muted-foreground/60 tracking-widest uppercase">
                  {idx + 1}
                </span>

                {/* Circle node */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200 group-hover:scale-110",
                    nodeStyle,
                    status === "active" && "cb-pulse",
                    isSelected && "ring-2 ring-offset-2 ring-primary ring-offset-background"
                  )}
                >
                  {icon}
                </div>

                {/* Status badge */}
                <span
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] rounded-full border whitespace-nowrap",
                    badge.cls
                  )}
                >
                  {badge.label}
                </span>

                {/* Task title */}
                <span
                  className={cn(
                    "text-[10px] font-semibold text-center leading-tight line-clamp-2 w-full px-0.5 transition-colors",
                    isSelected ? "text-primary" : "text-foreground/80",
                    "group-hover:text-primary"
                  )}
                  style={{ minHeight: "2.4em" }}
                >
                  {task.title}
                </span>

                {/* Selected indicator dot */}
                {isSelected && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 flex items-center pb-6 min-w-[12px]">
                  <div
                    className={cn(
                      "w-full h-[3px] rounded-full transition-colors",
                      lineStyle
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
