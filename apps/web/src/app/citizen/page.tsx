"use client";

import React, { useState, useEffect } from "react";
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
      <div className="w-full h-[480px] rounded-2xl border border-border bg-card/60 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-[#d95d39] animate-spin" />
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
} from "lucide-react";

export default function CitizenDashboardPage() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
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

  // Transform complaints into map markers with validation
  const mapComplaintItems: MapComplaintItem[] = complaints
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

  return (
    <CitizenShell>
      <div className="space-y-6">
        {/* Header with Title and Report Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              Welcome back, {user?.firstName || "Citizen"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track your reported civic issues and nearby neighborhood resolutions.
            </p>
          </div>
          <Link
            href="/citizen/report"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#d95d39] hover:bg-[#c34e2c] text-white shadow-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Issue</span>
          </Link>
        </div>

        {/* 3 Citizen KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "My Total Reports",
              value: totalCount,
              icon: FileText,
              accent: "text-[#d95d39]",
            },
            {
              label: "Active / In Progress",
              value: inProgressCount,
              icon: Clock,
              accent: "text-amber-500",
            },
            {
              label: "Resolved Issues",
              value: resolvedCount,
              icon: CheckCircle2,
              accent: "text-emerald-600 dark:text-emerald-400",
            },
          ].map((kpi, idx) => {
            const Icon = kpi.icon;
            return (
              <div key={idx} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                  <p className="font-display text-3xl font-bold mt-1 tabular-nums text-foreground">{kpi.value}</p>
                </div>
                <div className="w-11 h-11 rounded-xl border border-border bg-secondary/50 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${kpi.accent}`} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Split Grid: Recent Complaints + Nearby Spatial Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Recent Complaints (6 cols) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">My Recent Complaints</h2>
              {complaints.length > 0 && (
                <Link
                  href="/citizen/complaints"
                  className="text-xs font-semibold text-[#d95d39] hover:underline"
                >
                  View all ({totalCount})
                </Link>
              )}
            </div>

            {isLoading ? (
              <div className="p-12 rounded-2xl border border-border bg-card flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#d95d39]" />
                <span className="text-xs text-muted-foreground">Loading recent reports...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : complaints.length === 0 ? (
              <div className="p-10 rounded-2xl border border-border bg-card flex flex-col items-center justify-center text-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No complaints filed yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Spotted an issue? Report it to municipal departments with precise location and photo evidence.
                </p>
                <Link
                  href="/citizen/report"
                  className="mt-1 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#d95d39] hover:bg-[#c34e2c] text-white text-xs font-semibold transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Report an Issue</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => {
                  const complaintId = c._id || c.id;
                  const isSelected = selectedComplaintId === complaintId;
                  const categoryColor = CATEGORY_COLORS[c.category as ComplaintCategory] || "#94a3b8";

                  return (
                    <div
                      key={complaintId}
                      onClick={() => setSelectedComplaintId(isSelected ? null : complaintId)}
                      className={`rounded-2xl border p-4 cursor-pointer transition space-y-2.5 ${
                        isSelected
                          ? "border-[#d95d39] bg-secondary/80 ring-2 ring-[#d95d39]/30"
                          : "border-border bg-card hover:border-[#d95d39]/50 hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#d95d39]">
                            {c.referenceNumber || complaintId}
                          </span>
                          <StatusBadge status={c.status} />
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "Recent"}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-foreground line-clamp-1">{c.title}</h3>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: categoryColor }}
                          />
                          <span className="truncate">{c.category?.replace(/_/g, " ")}</span>
                        </div>
                        <Link
                          href={`/citizen/complaints/${complaintId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-xs text-[#d95d39] hover:underline flex items-center gap-1 shrink-0"
                        >
                          <span>{c.status === "RESOLVED" ? "Action: Rate & Close" : "View timeline"}</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Nearby Spatial Map (6 cols) */}
          <div className="lg:col-span-6 space-y-3 sticky top-24">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">Nearby Civic Issues (Ola Maps)</h2>
              <span className="text-[11px] font-mono text-muted-foreground">10 km radius</span>
            </div>
            <SpatialMapPreview
              complaints={mapComplaintItems}
              selectedComplaintId={selectedComplaintId}
              onSelectComplaint={(c) => setSelectedComplaintId(c ? c.id : null)}
              userRole="citizen"
              height="480px"
              title="Citizen Spatial View"
              description="Real GPS coordinates & 2dsphere proximity"
            />
          </div>
        </div>
      </div>
    </CitizenShell>
  );
}
