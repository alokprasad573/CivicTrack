"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  ComplaintCategory,
  ComplaintStatus,
} from "@civictrack/contracts";
import dynamic from "next/dynamic";
import { CitizenShell } from "../../components/layout/citizen-shell";
import { MapComplaintItem } from "../../hooks/use-complaint-markers";
import { CATEGORY_COLORS } from "../../lib/ola-maps-config";
import { StatusBadge } from "../../components/ui/status-badge";

const SpatialMapPreview = dynamic(
  () =>
    import("../../components/maps/spatial-map-preview").then(
      (mod) => mod.SpatialMapPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[460px] rounded-3xl border border-border bg-card flex flex-col items-center justify-center gap-3 shadow-xs">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">
          Loading Spatial Map Preview...
        </span>
      </div>
    ),
  }
);
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  MapPin,
  Calendar,
  Sparkles,
  EyeOff,
  Info,
} from "lucide-react";

export default function CitizenDashboardPage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [nearbyMapComplaints, setNearbyMapComplaints] = useState<any[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [showClosedOnMap, setShowClosedOnMap] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCitizenComplaints() {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const res = await fetch("/api/v1/complaints?page=1&limit=8", {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const list = Array.isArray(json.data)
              ? json.data
              : json.data.complaints || [];
            setComplaints(list);
          }
        } else if (res.status === 401) {
          setComplaints([]);
        } else {
          const errJson = await res.json().catch(() => null);
          setError(
            errJson?.error?.message ||
            (res.status === 404
              ? "API service unreachable. Please ensure the backend server is running on port 4000."
              : `Failed to retrieve complaints (${res.status} ${res.statusText})`)
          );
        }
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthLoaded) {
      loadCitizenComplaints();
    }
  }, [isAuthLoaded, getToken]);

  // Load nearby public issues for spatial map enrichment
  useEffect(() => {
    async function loadNearbyPublicIssues() {
      try {
        const res = await fetch(`/api/v1/complaints/nearby?radiusKm=50&includeClosed=${showClosedOnMap ? "true" : "false"}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setNearbyMapComplaints(json.data);
          }
        }
      } catch {
        // non-blocking spatial fallback
      }
    }
    loadNearbyPublicIssues();
  }, [showClosedOnMap]);

  // Derived KPI counts
  const totalCount = complaints.length;
  const inProgressCount = complaints.filter(
    (c) =>
      c.status === ComplaintStatus.IN_PROGRESS ||
      c.status === ComplaintStatus.ASSIGNED ||
      c.status === ComplaintStatus.UNDER_REVIEW ||
      c.status === ComplaintStatus.VERIFIED
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === ComplaintStatus.RESOLVED || c.status === ComplaintStatus.CLOSED
  ).length;

  // Transform complaints into map markers (use user's complaints or fallback to city complaints)
  // Feature: If issue status is CLOSED, do NOT show on map unless explicitly enabled by user
  const mapSourceList = useMemo(() => {
    const list = complaints.some((c) => c?.location?.coordinates)
      ? complaints
      : nearbyMapComplaints;
    if (!showClosedOnMap) {
      return list.filter((c) => c.status !== ComplaintStatus.CLOSED && c.status !== ComplaintStatus.REJECTED);
    }
    return list.filter((c) => c.status !== ComplaintStatus.REJECTED);
  }, [complaints, nearbyMapComplaints, showClosedOnMap]);

  const mapComplaintItems: MapComplaintItem[] = useMemo(() => {
    return mapSourceList
      .filter((c) => c && c.location && c.location.coordinates)
      .map((c) => ({
        id: c._id || c.id,
        referenceNumber: c.referenceNumber,
        title: c.title,
        description: c.description,
        category: c.category,
        status: c.status,
        priority: c.priority,
        location: c.location,
        address: c.address,
        createdAt: c.createdAt,
      }));
  }, [mapSourceList]);

  return (
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Verified Citizen Session</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              Welcome back, {user?.firstName || "Citizen"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Track your reported civic issues, follow field progress, and view nearby neighborhood resolutions.
            </p>
          </div>
          <Link
            href="/citizen/report"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition shrink-0 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Issue</span>
          </Link>
        </div>

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              label: "My Total Reports",
              value: totalCount,
              icon: FileText,
              iconBg: "bg-primary/10 border-primary/20 text-primary",
              accent: "text-primary",
            },
            {
              label: "Active / In Progress",
              value: inProgressCount,
              icon: Clock,
              iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-500",
              accent: "text-amber-500",
            },
            {
              label: "Resolved Issues",
              value: resolvedCount,
              icon: CheckCircle2,
              iconBg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
              accent: "text-emerald-500",
            },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl border border-border bg-card p-6 flex items-center justify-between shadow-xs hover:shadow-md transition-shadow"
              >
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-1.5 tabular-nums text-foreground">{kpi.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-xs ${kpi.iconBg}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Split Grid: Recent Complaints + Spatial Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Recent Complaints (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-foreground">My Recent Complaints</h2>
              {complaints.length > 0 && (
                <Link
                  href="/citizen/complaints"
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>View all ({totalCount})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLoading ? (
              <div className="h-64 rounded-3xl border border-border bg-card flex flex-col items-center justify-center gap-2 shadow-xs">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
                <span className="text-xs text-muted-foreground">Loading your complaints...</span>
              </div>
            ) : complaints.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No Complaints Reported Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Notice a pothole, broken streetlight, or garbage backlog? Submit your first report with location coordinates and photo evidence.
                </p>
                <div className="pt-2">
                  <Link
                    href="/citizen/report"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Report Now</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map((comp) => {
                  const compId = comp._id || comp.id;
                  const catColor = (CATEGORY_COLORS as Record<string, string>)[comp.category] || "#2563EB";
                  return (
                    <Link
                      key={compId}
                      href={`/citizen/complaints/${compId}`}
                      className="block p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                            {comp.referenceNumber || compId.slice(-8)}
                          </span>
                          <span className="text-muted-foreground/60">&bull;</span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: catColor }}
                            />
                            <span className="text-xs font-semibold text-foreground capitalize truncate">
                              {comp.category?.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={comp.status} />
                      </div>

                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition truncate">
                        {comp.title}
                      </h3>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border">
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{comp.address || "Location on city map"}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span>{new Date(comp.createdAt).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nearby Spatial Map (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">City Spatial Overview</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {mapComplaintItems.length} Active
                </span>
                {!showClosedOnMap && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                    Closed Hidden
                  </span>
                )}
              </div>

              {/* Feature: Hide / Show Closed Issues Toggle */}
              <button
                type="button"
                onClick={() => setShowClosedOnMap((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  showClosedOnMap
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shadow-xs"
                    : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                }`}
                title={showClosedOnMap ? "Closed complaints are shown on map. Click to hide." : "Closed complaints are hidden from map. Click to show."}
              >
                {showClosedOnMap ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Closed: Shown</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>Closed: Hidden</span>
                  </>
                )}
              </button>
            </div>

            {/* Zero active complaints advisory if all were closed */}
            {mapComplaintItems.length === 0 && (
              <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400 shrink-0" />
                  <p className="text-amber-300">
                    No active issues visible on map. Closed complaints are hidden by default.
                  </p>
                </div>
                {!showClosedOnMap && (
                  <button
                    type="button"
                    onClick={() => setShowClosedOnMap(true)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shrink-0 shadow-sm flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Show Closed</span>
                  </button>
                )}
              </div>
            )}

            <div className="rounded-3xl border border-border bg-card p-2 shadow-xs overflow-hidden">
              <SpatialMapPreview
                height="460px"
                complaints={mapComplaintItems}
                selectedComplaintId={selectedComplaintId}
                onSelectComplaint={(item) => setSelectedComplaintId(item ? item.id : null)}
              />
            </div>
          </div>
        </div>
      </div>
  );
}
