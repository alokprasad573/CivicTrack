"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  IAnalyticsSummary,
} from "@civictrack/contracts";
import { AdminShell } from "../../../components/layout/admin-shell";
import { CATEGORY_COLORS } from "../../../lib/ola-maps-config";
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Building2,
  Calendar,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldAlert,
  ArrowUpRight,
  Zap,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<IAnalyticsSummary | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [timeframeDays, setTimeframeDays] = useState<number>(14);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // SLA Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    scannedCount: number;
    escalatedCount: number;
    overdueCount: number;
    timestamp: string;
  } | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (timeframeDays > 0) {
      const start = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
      params.set("startDate", start.toISOString());
    }
    if (selectedDeptId) params.set("departmentId", selectedDeptId);

    try {
      const res = await fetch(`/api/v1/analytics/summary?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSummary(json.data);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setError("Authentication required to access analytics. Please sign in.");
        } else if (res.status === 403) {
          setError(
            errJson?.error?.message ||
              "Access Denied: Administrator privileges are required to view municipal operational analytics."
          );
        } else {
          setError(errJson?.error?.message || "Failed to load municipal analytics data.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch analytics summary.");
    } finally {
      setIsLoading(false);
    }
  }, [timeframeDays, selectedDeptId]);

  // Load department list for filtering
  useEffect(() => {
    async function loadDepts() {
      try {
        const res = await fetch("/api/v1/departments");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setDepartments(json.data);
          }
        }
      } catch {}
    }
    loadDepts();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Manual SLA Scan trigger
  const handleTriggerSlaScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/v1/sla/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setScanResult(json.data);
          // Refresh analytics after escalation updates
          fetchAnalytics();
        }
      } else {
        alert("SLA scan failed. Check server permissions.");
      }
    } catch {
      alert("Network error triggering SLA scan.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <AdminShell>
      <div className="space-y-6">
        {/* Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Operational Analytics & SLA Performance</span>
              <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-orange-500/10 text-[#d95d39] border border-orange-500/20 font-bold">
                Operational KPIs
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Server-side MongoDB aggregation pipelines &bull; Real-time department workload and SLA compliance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Timeframe selector */}
            <div className="flex items-center bg-secondary/80 border border-border rounded-xl p-1 text-xs">
              {[
                { label: "7 Days", val: 7 },
                { label: "14 Days", val: 14 },
                { label: "30 Days", val: 30 },
                { label: "90 Days", val: 90 },
                { label: "All Time", val: 0 },
              ].map((tf) => (
                <button
                  key={tf.val}
                  type="button"
                  onClick={() => setTimeframeDays(tf.val)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    timeframeDays === tf.val
                      ? "bg-[#d95d39] text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Department Filter */}
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-[#d95d39] font-medium"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchAnalytics()}
              className="p-2 rounded-xl bg-card text-foreground hover:bg-secondary border border-border transition-colors"
              title="Refresh Analytics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Manual SLA Scan Trigger */}
            <button
              type="button"
              onClick={handleTriggerSlaScan}
              disabled={isScanning}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card hover:bg-secondary border border-border text-xs font-bold transition-all disabled:opacity-50 text-foreground"
            >
              {isScanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d95d39]" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-[#d95d39]" />
              )}
              <span>Run SLA Escalation Scan</span>
            </button>
          </div>
        </div>

        {/* Scan Result Notification Banner */}
        {scanResult && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>SLA Audit Completed:</strong> Scanned {scanResult.scannedCount} active incidents.
                Escalated {scanResult.escalatedCount} overdue breaches. {scanResult.overdueCount} total active breaches logged.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScanResult(null)}
              className="text-amber-400 hover:text-amber-200 font-bold ml-3"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="py-28 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-medium">Aggregating municipal telemetry...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-foreground bg-destructive/10 border border-destructive/20 rounded-2xl flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm font-semibold">{error}</p>
            {error.includes("Access Denied") || error.includes("Citizen") ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch("/api/v1/users/me/switch-role", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ role: "ADMIN" }),
                    });
                    fetchAnalytics();
                  } catch {}
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-[#d95d39] text-white text-xs font-semibold hover:bg-[#c34e2c] transition shadow-sm"
              >
                Switch Active Persona to Administrator
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fetchAnalytics()}
                className="mt-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition"
              >
                Retry Loading Analytics
              </button>
            )}
          </div>
        ) : !summary ? null : (
          <>
            {/* Top Operational KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* Total Ingested */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Total Reports</span>
                  <Inbox className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">{summary.totalComplaints}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ingested in window</p>
                </div>
              </div>

              {/* Resolution Rate */}
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-emerald-400 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Resolution Rate</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-emerald-400">
                    {summary.resolutionRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {summary.resolvedComplaints} resolved
                  </p>
                </div>
              </div>

              {/* SLA Adherence */}
              <div
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  summary.slaAdherenceRate >= 80
                    ? "border-primary/20 bg-primary/5"
                    : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    SLA Compliance
                  </span>
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p
                    className={`text-2xl font-extrabold ${
                      summary.slaAdherenceRate >= 80 ? "text-primary" : "text-amber-400"
                    }`}
                  >
                    {summary.slaAdherenceRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Resolved within target</p>
                </div>
              </div>

              {/* Overdue Incidents */}
              <div
                className={`p-4 rounded-xl border flex flex-col justify-between ${
                  summary.overdueCount > 0
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">
                    Overdue Breaches
                  </span>
                  <AlertTriangle
                    className={`w-4 h-4 ${
                      summary.overdueCount > 0 ? "text-rose-400" : "text-muted-foreground"
                    }`}
                  />
                </div>
                <div>
                  <p
                    className={`text-2xl font-extrabold ${
                      summary.overdueCount > 0 ? "text-rose-400" : "text-foreground"
                    }`}
                  >
                    {summary.overdueCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Active past due</p>
                </div>
              </div>

              {/* Turnaround Time */}
              <div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Avg Turnaround</span>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground">
                    {summary.averageResolutionHours ? `${summary.averageResolutionHours}h` : "N/A"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {summary.averageResolutionHours
                      ? `${(summary.averageResolutionHours / 24).toFixed(1)} days avg`
                      : "No resolutions yet"}
                  </p>
                </div>
              </div>

              {/* In Progress */}
              <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-cyan-400 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">In Progress</span>
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-cyan-400">
                    {summary.inProgressComplaints}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Under field repair</p>
                </div>
              </div>
            </div>

            {/* Daily Submission vs Resolution Activity Trend */}
            <div className="p-5 rounded-2xl border border-border bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span>Daily Incident Intake vs. Resolution Velocity</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Compare newly reported citizen complaints against successfully resolved field incidents over time.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-400" />
                    <span className="text-muted-foreground">New Reports</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-primary" />
                    <span className="text-muted-foreground">Resolved</span>
                  </div>
                </div>
              </div>

              {/* Responsive Visual Bar Chart */}
              {summary.dailyTrend.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No activity recorded in selected timeframe.
                </div>
              ) : (
                <div className="pt-2 pb-4">
                  {(() => {
                    const maxCount = Math.max(
                      1,
                      ...summary.dailyTrend.flatMap((d) => [d.submitted, d.resolved])
                    );

                    return (
                      <div className="h-48 flex items-end gap-2 sm:gap-4 overflow-x-auto pb-2 border-b border-border">
                        {summary.dailyTrend.map((day) => {
                          const subHeight = Math.max(4, Math.round((day.submitted / maxCount) * 160));
                          const resHeight = Math.max(4, Math.round((day.resolved / maxCount) * 160));

                          return (
                            <div
                              key={day.date}
                              className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group relative"
                            >
                              {/* Hover Tooltip */}
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20 font-mono">
                                {day.date}: {day.submitted} in / {day.resolved} done
                              </div>

                              <div className="w-full flex items-end justify-center gap-1 h-40">
                                {/* Submitted bar */}
                                <div
                                  style={{ height: `${subHeight}px` }}
                                  className="w-1/2 bg-amber-400/80 hover:bg-amber-400 rounded-t transition-all"
                                  title={`Submitted: ${day.submitted}`}
                                />
                                {/* Resolved bar */}
                                <div
                                  style={{ height: `${resHeight}px` }}
                                  className="w-1/2 bg-primary/80 hover:bg-primary rounded-t transition-all"
                                  title={`Resolved: ${day.resolved}`}
                                />
                              </div>

                              <span className="text-[10px] font-mono text-muted-foreground truncate max-w-full">
                                {day.date.slice(5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Department Performance & SLA Table */}
            <div className="p-5 rounded-2xl border border-border bg-card overflow-hidden">
              <div className="mb-4">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Department SLA Performance Matrix</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Breakdown of incident assignments, resolution throughput, and overdue breaches by municipal agency.
                </p>
              </div>

              {summary.departmentBreakdown.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No department assignments recorded for this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3 text-center">Total Assigned</th>
                        <th className="px-4 py-3 text-center">Resolved</th>
                        <th className="px-4 py-3 text-center">Resolution %</th>
                        <th className="px-4 py-3 text-center">Overdue</th>
                        <th className="px-4 py-3 text-right">SLA Standing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {summary.departmentBreakdown.map((dept) => {
                        const resolutionPct =
                          dept.total > 0 ? Math.round((dept.resolved / dept.total) * 100) : 0;
                        const isCompliant = dept.overdue === 0 && resolutionPct >= 70;
                        const isCritical = dept.overdue > 3 || (dept.total > 5 && resolutionPct < 40);

                        return (
                          <tr key={dept.departmentId} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-foreground block">{dept.departmentName}</span>
                            </td>

                            <td className="px-4 py-3 text-center font-mono font-medium text-foreground">
                              {dept.total}
                            </td>

                            <td className="px-4 py-3 text-center font-mono font-semibold text-emerald-400">
                              {dept.resolved}
                            </td>

                            <td className="px-4 py-3 text-center">
                              <span className="font-mono font-bold text-foreground">
                                {resolutionPct}%
                              </span>
                            </td>

                            <td className="px-4 py-3 text-center">
                              {dept.overdue > 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  {dept.overdue} overdue
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">0</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isCritical
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : isCompliant
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}
                              >
                                {isCritical ? "At Risk" : isCompliant ? "Compliant" : "Moderate"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Category Distribution & Priority Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Category Breakdown */}
              <div className="p-5 rounded-2xl border border-border bg-card">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-foreground">Incident Volume by Category</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Proportion of civic issues grouped by domain classification.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {summary.categoryBreakdown.map((cat) => {
                    const color = CATEGORY_COLORS[cat.category] || "#14b8a6";
                    const percentage =
                      summary.totalComplaints > 0
                        ? Math.round((cat.count / summary.totalComplaints) * 100)
                        : 0;

                    return (
                      <div key={cat.category} className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            {cat.category.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {cat.count} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Priority & Status Breakdown */}
              <div className="p-5 rounded-2xl border border-border bg-card flex flex-col justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Priority & Status Distribution</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Severity ranking and workflow pipeline stage representation.
                  </p>

                  {/* Priority Badges */}
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Severity Distribution
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {summary.priorityBreakdown.map((prio) => (
                        <div
                          key={prio.priority}
                          className="p-2.5 rounded-xl border border-border bg-secondary/30 flex flex-col items-center"
                        >
                          <span className="text-[10px] font-mono font-bold text-muted-foreground">
                            {prio.priority}
                          </span>
                          <span className="text-lg font-extrabold text-foreground">{prio.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="mt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Workflow Lifecycle Stage
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {summary.statusBreakdown.map((st) => (
                        <div
                          key={st.status}
                          className="p-2 rounded-lg border border-border/60 bg-background text-center"
                        >
                          <p className="text-[9px] font-mono text-muted-foreground uppercase truncate">
                            {st.status.replace(/_/g, " ")}
                          </p>
                          <p className="text-base font-bold text-foreground mt-0.5">{st.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Telemetry window: {timeframeDays > 0 ? `${timeframeDays} days` : "All time"}</span>
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                  >
                    <span>Inspect Triage Queue</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
