"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface BottomNavProps {
  items: BottomNavItem[];
  activeId: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export default function BottomNav({ items, activeId, onTabChange, className }: BottomNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('has-mobile-nav');
    return () => document.body.classList.remove('has-mobile-nav');
  }, []);

  // Auto-scroll active tab into center view
  useEffect(() => {
    const activeEl = scrollRef.current?.querySelector(`[data-id="${activeId}"]`) as HTMLElement | null;
    if (activeEl && scrollRef.current) {
      const containerWidth = scrollRef.current.offsetWidth;
      const elLeft = activeEl.offsetLeft;
      const elWidth = activeEl.offsetWidth;
      scrollRef.current.scrollTo({
        left: elLeft - containerWidth / 2 + elWidth / 2,
        behavior: "smooth",
      });
    }
  }, [activeId]);

  return (
    // Truly fixed to viewport bottom, hidden on md+
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-100 md:hidden mobile-nav-fade-transition",
        className
      )}
    >
      {/* Frosted glass pill container */}
      <div className="mx-3 bg-background/95 dark:bg-zinc-900/95 backdrop-blur-2xl border border-border/60 border-b-0 shadow-[0_-4px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_30px_rgba(0,0,0,0.4)] rounded-t-3xl overflow-hidden">
        <div
          ref={scrollRef}
          className="flex items-end overflow-x-auto px-2 py-2 gap-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;

            return (
              <button
                key={item.id}
                data-id={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex flex-col items-center justify-center min-w-[72px] py-1 px-1 rounded-2xl transition-all duration-500 shrink-0 group",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Active Circle Background/Badge */}
                <div
                  className={cn(
                    "absolute inset-x-2 inset-y-1.5 rounded-2xl transition-all duration-500 -z-10",
                    isActive
                      ? "bg-primary/10 shadow-[0_4px_12px_rgba(var(--primary-rgb),0.15)] scale-100 opacity-100"
                      : "scale-75 opacity-0"
                  )}
                />

                <div className="relative">
                  <Icon
                    className={cn(
                      "h-5 w-5 mb-1 transition-all duration-500",
                      isActive ? "translate-y-[-2px] scale-110" : "scale-100 group-hover:scale-110"
                    )}
                  />
                  {/* Indicator Dot */}
                  <span className={cn(
                    "absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary transition-all duration-500",
                    isActive ? "scale-100 opacity-100" : "scale-0 opacity-0"
                  )} />
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold tracking-tight leading-tight transition-all duration-500",
                    isActive ? "opacity-100 -translate-y-px" : "opacity-60"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Safe area spacer — handles iOS home indicator & Android gesture bar */}
        <div
          style={{
            height: "env(safe-area-inset-bottom, 0px)",
            minHeight: "0px",
          }}
        />
      </div>
    </div>
  );
}
