"use client";

import React from "react";
import { ComplaintStatus } from "@civictrack/contracts";

export const STATUS_META: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  [ComplaintStatus.SUBMITTED]: {
    label: "Submitted",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  },
  [ComplaintStatus.UNDER_REVIEW]: {
    label: "Under Review",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    dot: "bg-amber-600",
  },
  [ComplaintStatus.VERIFIED]: {
    label: "Verified",
    badge: "bg-sky-50 text-sky-800 border-sky-200",
    dot: "bg-sky-600",
  },
  [ComplaintStatus.ASSIGNED]: {
    label: "Assigned",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-600",
  },
  [ComplaintStatus.IN_PROGRESS]: {
    label: "In Progress",
    badge: "bg-teal-50 text-teal-800 border-teal-200",
    dot: "bg-teal-600",
  },
  [ComplaintStatus.RESOLVED]: {
    label: "Resolved",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-600",
  },
  [ComplaintStatus.CLOSED]: {
    label: "Closed",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
  },
  [ComplaintStatus.REJECTED]: {
    label: "Rejected",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-600",
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
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${meta.badge} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
