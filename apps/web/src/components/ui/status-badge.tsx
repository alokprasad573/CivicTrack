"use client";

import React from "react";
import { ComplaintStatus } from "@civictrack/contracts";

export const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  [ComplaintStatus.SUBMITTED]: {
    label: "Submitted",
    badge: "bg-stone-500/15 text-stone-600 dark:text-stone-300 border-stone-500/30",
    dot: "bg-stone-400",
  },
  [ComplaintStatus.UNDER_REVIEW]: {
    label: "Under Review",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    dot: "bg-amber-500",
  },
  [ComplaintStatus.VERIFIED]: {
    label: "Verified",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  [ComplaintStatus.ASSIGNED]: {
    label: "Assigned",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
    dot: "bg-sky-500",
  },
  [ComplaintStatus.IN_PROGRESS]: {
    label: "In Progress",
    badge: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    dot: "bg-orange-500",
  },
  [ComplaintStatus.RESOLVED]: {
    label: "Resolved",
    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30",
    dot: "bg-teal-500",
  },
  [ComplaintStatus.CLOSED]: {
    label: "Closed",
    badge: "bg-neutral-500/15 text-neutral-600 dark:text-neutral-400 border-neutral-500/30",
    dot: "bg-neutral-400",
  },
  [ComplaintStatus.REJECTED]: {
    label: "Rejected",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    dot: "bg-rose-500",
  },
};

export function StatusBadge({
  status,
  className = "",
}: {
  status?: string | null;
  className?: string;
}) {
  const safeStatus = typeof status === "string" ? status.toUpperCase() : ComplaintStatus.SUBMITTED;
  const meta = STATUS_META[safeStatus] || {
    label: typeof status === "string" && status.length > 0 ? status.replace(/_/g, " ") : "Submitted",
    badge: "bg-stone-500/15 text-stone-400 border-stone-500/30",
    dot: "bg-stone-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${meta.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
