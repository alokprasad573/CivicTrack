"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import { OfficerShell } from "../../components/layout/officer-shell";
import { CATEGORY_COLORS } from "../../lib/ola-maps-config";
import { StatusBadge } from "../../components/ui/status-badge";
import { PriorityBadge } from "../../components/ui/priority-badge";
import {
  Wrench,
  Navigation,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Loader2,
  AlertCircle,
  Play,
  RefreshCw,
  X,
  Send,
} from "lucide-react";

export default function OfficerWorkQueuePage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filter state
  const [scopeFilter, setScopeFilter] = useState<"ME" | "DEPT">("ME");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution modal state
  const [resolveModalComplaint, setResolveModalComplaint] = useState<any | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (statusFilter) params.set("status", statusFilter);
    if (scopeFilter === "ME") {
      params.set("assignedToMe", "true");
    }

    try {
      const res = await fetch(`/api/v1/complaints?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const list = Array.isArray(json.data)
            ? json.data
            : json.data.complaints || [];
          setComplaints(list);
          setTotal(json.meta?.total ?? json.data?.total ?? list.length);
          setTotalPages(json.meta?.totalPages ?? json.data?.totalPages ?? 1);
        }
      } else if (res.status === 401) {
        setComplaints([]);
      } else {
        setError("Failed to fetch assigned complaints queue");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load officer queue");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, scopeFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Start work quick action
  const handleStartWork = async (complaintId: string) => {
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/start-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Field officer acknowledged issue and began on-site investigation." }),
      });

      if (res.ok) {
        fetchQueue();
      } else {
        const errJson = await res.json();
        alert(errJson.error?.message || "Failed to start work");
      }
    } catch {
      alert("Network error starting work");
    }
  };

  // Submit resolution handler
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveModalComplaint || !resolutionRemarks.trim()) return;

    setIsSubmittingResolution(true);
    setResolutionError(null);

    try {
      const res = await fetch(`/api/v1/complaints/${resolveModalComplaint._id || resolveModalComplaint.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarks: resolutionRemarks.trim(),
        }),
      });

      if (res.ok) {
        setResolveModalComplaint(null);
        setResolutionRemarks("");
        fetchQueue();
      } else {
        const errJson = await res.json();
        setResolutionError(errJson.error?.message || "Failed to resolve complaint");
      }
    } catch (err: any) {
      setResolutionError(err.message || "Network error submitting resolution");
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const assignedCount = complaints.filter((c) => c.status === ComplaintStatus.ASSIGNED).length;
  const inProgressCount = complaints.filter((c) => c.status === ComplaintStatus.IN_PROGRESS).length;
  const resolvedCount = complaints.filter((c) => c.status === ComplaintStatus.RESOLVED).length;

  return (
    <OfficerShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Officer Field Workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Field response incident queue, turn-by-turn navigation routing, and on-site repair resolution.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-2 text-xs border border-border px-3.5 py-2 rounded-xl bg-card">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-foreground">GPS Telemetry Active</span>
            </div>

            <button
              type="button"
              onClick={() => fetchQueue()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card text-foreground text-xs font-semibold hover:bg-secondary border border-border transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Awaiting Work</span>
              <div className="font-display text-2xl sm:text-3xl font-bold text-amber-500 mt-1 tabular-nums">
                {assignedCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-muted-foreground">In Progress</span>
              <div className="font-display text-2xl sm:text-3xl font-bold text-[#d95d39] mt-1 tabular-nums">
                {inProgressCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[#d95d39]">
              <Wrench className="w-5 h-5" />
            </div>
          </div>

          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Resolved by Team</span>
              <div className="font-display text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {resolvedCount}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Queue Scope Tabs & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit">
            <button
              type="button"
              onClick={() => {
                setScopeFilter("ME");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scopeFilter === "ME"
                  ? "bg-[#d95d39] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Assigned Directly to Me
            </button>
            <button
              type="button"
              onClick={() => {
                setScopeFilter("DEPT");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                scopeFilter === "DEPT"
                  ? "bg-[#d95d39] text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Department Queue
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#d95d39]"
            >
              <option value="">All Workflow States</option>
              <option value={ComplaintStatus.ASSIGNED}>Assigned</option>
              <option value={ComplaintStatus.IN_PROGRESS}>In Progress</option>
              <option value={ComplaintStatus.RESOLVED}>Resolved</option>
              <option value={ComplaintStatus.CLOSED}>Closed</option>
            </select>
          </div>
        </div>

        {/* Complaints Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-7 h-7 animate-spin text-[#d95d39]" />
            <p className="text-xs">Loading assigned queue...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl">
            <AlertCircle className="w-7 h-7 mx-auto mb-2" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
            <Wrench className="w-10 h-10 stroke-1 text-muted-foreground/60" />
            <p className="text-sm font-semibold">No complaints in queue</p>
            <p className="text-xs text-muted-foreground/80">
              {scopeFilter === "ME"
                ? "You have no outstanding assigned complaints."
                : "Your department currently has no assigned incidents."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {complaints.map((item) => {
              const categoryColor = CATEGORY_COLORS[item.category as ComplaintCategory] || "#14b8a6";
              const coords = item.location?.coordinates || [77.5946, 12.9716];
              const isOverdue =
                item.dueAt &&
                new Date(item.dueAt) < new Date() &&
                ![ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED].includes(item.status);

              return (
                <div
                  key={item._id}
                  className="p-5 rounded-2xl border border-border bg-card flex flex-col justify-between hover:border-[#d95d39]/40 transition-all shadow-sm space-y-4"
                >
                  <div className="space-y-2">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#d95d39]">
                          {item.referenceNumber}
                        </span>
                        {item.priority && <PriorityBadge priority={item.priority} />}
                        {isOverdue && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 border border-rose-500/40 font-bold font-mono">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <h3 className="text-sm font-bold text-foreground line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Metadata details */}
                    <div className="border border-border rounded-xl p-3 text-xs space-y-1.5 bg-secondary/30">
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#d95d39] shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: categoryColor }}
                        />
                        <span className="truncate">{item.category?.replace(/_/g, " ")}</span>
                        {item.dueAt && (
                          <span className="ml-auto font-mono text-[10px]">
                            Due: {new Date(item.dueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                    <Link
                      href={`/map?lng=${coords[0]}&lat=${coords[1]}&ref=${item.referenceNumber}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary text-xs font-semibold transition"
                      title="Launch GPS Turn-by-Turn Navigation to this location"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#d95d39]" />
                      <span>Navigate</span>
                    </Link>

                    <div className="flex items-center gap-2">
                      {item.status === ComplaintStatus.ASSIGNED && (
                        <button
                          type="button"
                          onClick={() => handleStartWork(item._id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-sm transition"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Start Work</span>
                        </button>
                      )}

                      {item.status === ComplaintStatus.IN_PROGRESS && (
                        <button
                          type="button"
                          onClick={() => {
                            setResolveModalComplaint(item);
                            setResolutionRemarks("");
                            setResolutionError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Submit Resolution</span>
                        </button>
                      )}

                      <Link
                        href={`/officer/complaints/${item._id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-foreground text-xs font-semibold transition"
                      >
                        <span>Details</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Field Resolution Modal */}
        {resolveModalComplaint && (
          <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl bg-card">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-lg font-bold text-foreground">
                  Submit Field Resolution
                </h3>
                <button
                  type="button"
                  onClick={() => setResolveModalComplaint(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Resolving incident <span className="font-mono font-semibold text-[#d95d39]">{resolveModalComplaint.referenceNumber}</span>. Enter site repair notes for citizen verification.
              </p>

              {resolutionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  {resolutionError}
                </div>
              )}

              <form onSubmit={handleResolveSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Resolution Notes & Actions Taken *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={resolutionRemarks}
                    onChange={(e) => setResolutionRemarks(e.target.value)}
                    placeholder="e.g. Cleared drainage obstruction and replaced damaged concrete slab. Flow restored."
                    className="w-full border border-border rounded-xl px-3.5 py-2.5 text-xs outline-none bg-background text-foreground focus:border-[#d95d39] resize-y"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setResolveModalComplaint(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingResolution || !resolutionRemarks.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition disabled:opacity-40"
                  >
                    {isSubmittingResolution ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Resolution</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </OfficerShell>
  );
}
