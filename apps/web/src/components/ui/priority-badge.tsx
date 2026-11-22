"use client";

import React from "react";
import { ComplaintPriority } from "@civictrack/contracts";

export const PRIORITY_META: Record<
  string,
  { label: string; badge: string }
> = {
  [ComplaintPriority.CRITICAL]: {
    label: "Critical",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  [ComplaintPriority.HIGH]: {
    label: "High",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  },
  [ComplaintPriority.MEDIUM]: {
    label: "Medium",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  [ComplaintPriority.LOW]: {
    label: "Low",
    badge: "bg-stone-500/15 text-stone-600 dark:text-stone-400 border-stone-500/30",
  },
};

export function PriorityBadge({
  priority,
  className = "",
}: {
  priority?: string | null;
  className?: string;
}) {
  const safePriority = typeof priority === "string" ? priority.toUpperCase() : ComplaintPriority.MEDIUM;
  const meta = PRIORITY_META[safePriority] || {
    label: typeof priority === "string" && priority.length > 0 ? priority.replace(/_/g, " ") : "Medium",
    badge: "bg-stone-500/15 text-stone-400 border-stone-500/30",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase border ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  );
}
