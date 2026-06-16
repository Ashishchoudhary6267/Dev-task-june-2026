"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  Button,
} from "@/components/ui";

interface LinkItem {
  type: "link" | "title";
  value: string;
}

interface LinksDialogProps {
  task: any | null;
  onClose: () => void;
}

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

export function LinksDialog({ task, onClose }: LinksDialogProps) {
  return (
    <Dialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Deliverable Links
          </DialogTitle>
          <DialogDescription>{task?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {parseLinkItems(task?.links).map((item, idx) =>
            item.type === "link" ? (
              <a
                key={idx}
                href={item.value}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-start gap-2 p-3 rounded-lg border border-border hover:border-blue-300 hover:bg-blue-50/50 transition-colors group"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span className="text-sm text-blue-600 group-hover:text-blue-700 break-all leading-snug">
                  {item.value}
                </span>
              </a>
            ) : (
              <div key={idx} className="pt-2 pb-1 px-1">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {item.value}
                </h4>
              </div>
            ),
          )}
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="outline" size="sm">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
