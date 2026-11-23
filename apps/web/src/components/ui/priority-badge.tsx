"use client";

import React from "react";
import { ComplaintPriority } from "@civictrack/contracts";

export const PRIORITY_META: Record<
  string,
  { label: string; badge: string }
> = {
  [ComplaintPriority.CRITICAL]: {
    label: "Critical",
    badge: "bg-rose-50 text-rose-700 border-rose-200/80",
  },
  [ComplaintPriority.HIGH]: {
    label: "High",
    badge: "bg-amber-50 text-amber-700 border-amber-200/80",
  },
  [ComplaintPriority.MEDIUM]: {
    label: "Medium",
    badge: "bg-blue-50 text-blue-700 border-blue-200/80",
  },
  [ComplaintPriority.LOW]: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200/80",
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
    badge: "bg-slate-100 text-slate-600 border-slate-200/80",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-wide uppercase border ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  );
}
