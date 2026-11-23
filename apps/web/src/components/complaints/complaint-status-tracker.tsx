"use client";

import React from "react";
import { ComplaintStatus } from "@civictrack/contracts";
import { StatusBadge } from "../ui/status-badge";
import {
  FileText,
  Eye,
  CheckCircle2,
  UserCheck,
  Wrench,
  CheckCircle,
  Award,
  AlertOctagon,
  Clock,
  User,
  Shield,
  ShieldAlert,
  ChevronRight,
  ImageIcon,
} from "lucide-react";

export interface StatusHistoryItem {
  _id?: string;
  fromStatus?: ComplaintStatus | string;
  toStatus?: ComplaintStatus | string;
  status?: ComplaintStatus | string;
  actorId?: {
    _id?: string;
    name?: string;
    role?: string;
  } | string;
  actorRole?: string;
  performedByRole?: string;
  remarks?: string;
  evidence?: Array<{
    objectKey?: string;
    key?: string;
    url?: string;
    contentType?: string;
    size?: number;
  }>;
  createdAt?: string | Date;
  timestamp?: string | Date;
}

interface ComplaintStatusTrackerProps {
  currentStatus: ComplaintStatus | string;
  history?: StatusHistoryItem[];
  className?: string;
  viewUrls?: Record<string, string>;
  onImageClick?: (url: string) => void;
  resolutionEvidence?: Array<{
    objectKey?: string;
    key?: string;
    url?: string;
    contentType?: string;
    size?: number;
  }>;
  resolutionRemarks?: string;
  resolvedAt?: string | Date;
}

interface StepDefinition {
  status: ComplaintStatus;
  label: string;
  icon: React.ElementType;
}

const LIFECYCLE_STEPS: StepDefinition[] = [
  { status: ComplaintStatus.SUBMITTED, label: "Submitted", icon: FileText },
  { status: ComplaintStatus.UNDER_REVIEW, label: "Under Review", icon: Eye },
  { status: ComplaintStatus.VERIFIED, label: "Verified", icon: CheckCircle2 },
  { status: ComplaintStatus.ASSIGNED, label: "Assigned", icon: UserCheck },
  { status: ComplaintStatus.IN_PROGRESS, label: "In Progress", icon: Wrench },
  { status: ComplaintStatus.RESOLVED, label: "Resolved", icon: CheckCircle },
  { status: ComplaintStatus.CLOSED, label: "Closed", icon: Award },
];

function getStepRank(status?: string | null): number {
  if (!status) return 0;
  const s = status.toUpperCase();
  switch (s) {
    case ComplaintStatus.SUBMITTED:
      return 0;
    case ComplaintStatus.UNDER_REVIEW:
      return 1;
    case ComplaintStatus.VERIFIED:
      return 2;
    case ComplaintStatus.ASSIGNED:
      return 3;
    case ComplaintStatus.IN_PROGRESS:
      return 4;
    case ComplaintStatus.RESOLVED:
      return 5;
    case ComplaintStatus.CLOSED:
      return 6;
    default:
      return 0;
  }
}

function getActorBadge(actor?: any, role?: string) {
  let actorName = "System";
  let actorRole = role || "";

  if (actor && typeof actor === "object") {
    actorName = actor.name || actorName;
    actorRole = actor.role || actorRole;
  } else if (typeof actor === "string") {
    actorName = actor;
  }

  const roleUpper = actorRole.toUpperCase();

  if (roleUpper === "ADMIN") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]  px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
        <ShieldAlert className="w-3 h-3" />
        Admin {actorName !== "System" ? `(${actorName})` : ""}
      </span>
    );
  }

  if (roleUpper === "OFFICER") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]  px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-semibold">
        <Shield className="w-3 h-3" />
        Field Officer {actorName !== "System" ? `(${actorName})` : ""}
      </span>
    );
  }

  if (roleUpper === "CITIZEN") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px]  px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
        <User className="w-3 h-3" />
        Citizen {actorName !== "System" ? `(${actorName})` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px]  px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
      {actorName}
    </span>
  );
}

export function ComplaintStatusTracker({
  currentStatus,
  history = [],
  className = "",
  viewUrls = {},
  onImageClick,
  resolutionEvidence = [],
  resolutionRemarks,
  resolvedAt,
}: ComplaintStatusTrackerProps) {
  const isRejected = currentStatus === ComplaintStatus.REJECTED;
  const currentRank = getStepRank(currentStatus);
  const isResolvedOrClosed =
    currentStatus === ComplaintStatus.RESOLVED ||
    currentStatus === ComplaintStatus.CLOSED ||
    currentRank >= 5;

  const handleImageOpen = (url?: string | null) => {
    if (!url) return;
    if (onImageClick) {
      onImageClick(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Horizontal Status Stepper Bar */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <span>Resolution Stage & Lifecycle</span>
          </h3>
          <StatusBadge status={currentStatus} />
        </div>

        {/* If Rejected, display specialized banner */}
        {isRejected ? (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">Complaint Rejected</p>
              <p className="text-xs text-foreground/80 mt-1">
                This civic report was reviewed and rejected during municipal triage. See chronological remarks below for specific justification.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 pt-1">
            <div className="flex items-center justify-between min-w-[560px] relative">
              {/* Background Connecting Line */}
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-border -z-0" />

              {/* Steps */}
              {LIFECYCLE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx < currentRank;
                const isCurrent = idx === currentRank;

                return (
                  <div key={step.status} className="flex flex-col items-center relative z-10 group">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isCompleted
                          ? "bg-emerald-500 text-white shadow-sm"
                          : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110 shadow-md font-bold"
                          : "bg-secondary text-muted-foreground border border-border"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                    </div>
                    <span
                      className={`text-[11px] mt-2 whitespace-nowrap text-center font-semibold ${
                        isCurrent
                          ? "text-primary font-bold"
                          : isCompleted
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Highlighted Resolution Proof Card (when incident is resolved) */}
      {isResolvedOrClosed && (resolutionEvidence.length > 0 || resolutionRemarks) && (
        <div className="p-4 sm:p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Resolution Proof & Field Work Evidence</span>
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              Verified Repair Proof
            </span>
          </div>

          {resolutionRemarks && (
            <div className="bg-background/80 p-3.5 rounded-xl border border-border/70 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
              <span className="font-semibold text-foreground block mb-0.5">Officer Resolution Notes:</span>
              {resolutionRemarks}
            </div>
          )}

          {resolutionEvidence.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                Attached Resolution Proof Photos ({resolutionEvidence.length})
              </p>
              <div className="flex flex-wrap gap-2.5">
                {resolutionEvidence.map((ev, idx) => {
                  const key = ev.objectKey || ev.key || `res-ev-${idx}`;
                  const imgUrl = ev.url || (key ? viewUrls[key] : null) || (ev.objectKey ? viewUrls[ev.objectKey] : null);
                  return (
                    <div
                      key={key}
                      onClick={() => handleImageOpen(imgUrl)}
                      className="relative group/proof w-24 h-20 sm:w-28 sm:h-24 rounded-xl border-2 border-emerald-500/30 bg-card overflow-hidden cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all shrink-0"
                      title="Click to zoom resolution photo proof"
                    >
                      {imgUrl ? (
                        <>
                          <img
                            src={imgUrl}
                            alt="Resolution Proof"
                            className="w-full h-full object-cover group-hover/proof:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/proof:bg-black/35 flex items-center justify-center transition-colors">
                            <Eye className="w-4 h-4 text-white opacity-0 group-hover/proof:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-[9px] text-muted-foreground bg-secondary/50">
                          <ImageIcon className="w-4 h-4 text-emerald-500/60" />
                          <span>Photo Proof</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Chronological Audit History Timeline */}
      <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span>Audit & Status Transition Log</span>
        </h3>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-3">
            No audit transitions recorded yet. Initial submission logged.
          </p>
        ) : (
          <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {history.map((h, idx) => {
              const targetStatus = h.toStatus || h.status || ComplaintStatus.SUBMITTED;
              const isResolvedStep = String(targetStatus).toUpperCase() === ComplaintStatus.RESOLVED;
              const dateVal = h.createdAt || h.timestamp;
              const formattedDate = dateVal ? new Date(dateVal).toLocaleString() : "";
              const actorRole =
                (typeof h.actorId === "object" && h.actorId ? h.actorId.role : undefined) ||
                h.actorRole ||
                h.performedByRole ||
                "";

              // Evidence to display on this transition item:
              // For RESOLVED step: use transition's evidence or fallback to resolutionEvidence
              const stepEvidence =
                h.evidence && h.evidence.length > 0
                  ? h.evidence
                  : isResolvedStep && resolutionEvidence.length > 0
                  ? resolutionEvidence
                  : [];

              return (
                <div key={h._id || idx} className="relative group">
                  {/* Timeline Bullet */}
                  <span className={`w-4 h-4 rounded-full bg-card border-2 absolute -left-6 top-1 transition-transform group-hover:scale-125 shadow-sm ${
                    isResolvedStep ? "border-emerald-500" : "border-primary"
                  }`} />

                  <div className="bg-secondary/40 border border-border rounded-xl p-3.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={targetStatus} />
                        {getActorBadge(h.actorId, actorRole)}
                      </div>

                      {formattedDate && (
                        <span className="text-[11px] text-muted-foreground">
                          {formattedDate}
                        </span>
                      )}
                    </div>

                    {(h.remarks || (isResolvedStep && resolutionRemarks)) && (
                      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {h.remarks || (isResolvedStep ? resolutionRemarks : "")}
                      </p>
                    )}

                    {/* Attached Evidence & Resolution Proof */}
                    {stepEvidence.length > 0 && (
                      <div className="pt-2 border-t border-border/50">
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${
                          isResolvedStep
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : "text-muted-foreground"
                        }`}>
                          {isResolvedStep ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Attached Resolution Proof & Evidence ({stepEvidence.length})
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-3 h-3 text-primary" /> Attached Incident Evidence ({stepEvidence.length})
                            </>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {stepEvidence.map((ev, eIdx) => {
                            const key = ev.objectKey || ev.key || `ev-${eIdx}`;
                            const imgUrl = ev.url || (key ? viewUrls[key] : null) || (ev.objectKey ? viewUrls[ev.objectKey] : null);
                            return (
                              <div
                                key={key}
                                onClick={() => handleImageOpen(imgUrl)}
                                className={`relative group/proof w-20 h-16 sm:w-24 sm:h-20 rounded-xl border overflow-hidden cursor-pointer hover:shadow-md transition shrink-0 ${
                                  isResolvedStep
                                    ? "border-emerald-500/40 bg-card hover:border-emerald-500"
                                    : "border-border bg-card hover:border-primary"
                                }`}
                                title={isResolvedStep ? "Click to view resolution photo proof" : "Click to view incident evidence"}
                              >
                                {imgUrl ? (
                                  <>
                                    <img
                                      src={imgUrl}
                                      alt={isResolvedStep ? "Resolution Proof" : "Transition Evidence"}
                                      className="w-full h-full object-cover group-hover/proof:scale-105 transition-transform duration-200"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover/proof:bg-black/35 flex items-center justify-center transition-colors">
                                      <Eye className="w-4 h-4 text-white opacity-0 group-hover/proof:opacity-100 transition-opacity drop-shadow" />
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-[9px] text-muted-foreground bg-secondary/50">
                                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground/60" />
                                    <span>Photo</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
