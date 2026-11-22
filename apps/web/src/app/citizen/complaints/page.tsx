"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ComplaintCategory,
  ComplaintStatus,
} from "@civictrack/contracts";
import { CitizenShell } from "../../../components/layout/citizen-shell";
import { CATEGORY_COLORS } from "../../../lib/ola-maps-config";
import { StatusBadge } from "../../../components/ui/status-badge";
import { PriorityBadge } from "../../../components/ui/priority-badge";
import {
  FileText,
  Search,
  Filter,
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  AlertCircle,
  ImageIcon,
} from "lucide-react";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Submitted", value: ComplaintStatus.SUBMITTED },
  { label: "Under Review", value: ComplaintStatus.UNDER_REVIEW },
  { label: "Assigned", value: ComplaintStatus.ASSIGNED },
  { label: "In Progress", value: ComplaintStatus.IN_PROGRESS },
  { label: "Resolved", value: ComplaintStatus.RESOLVED },
  { label: "Closed", value: ComplaintStatus.CLOSED },
  { label: "Rejected", value: ComplaintStatus.REJECTED },
];

export default function CitizenComplaintsListPage() {
  const { getToken, isLoaded } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "8");
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (searchTerm) params.set("search", searchTerm);

    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/v1/complaints?${params.toString()}`, {
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
          setTotal(json.meta?.total ?? json.data?.total ?? list.length);
          setTotalPages(json.meta?.totalPages ?? json.data?.totalPages ?? 1);
        }
      } else if (res.status === 401) {
        setComplaints([]);
      } else {
        const errJson = await res.json().catch(() => null);
        setError(
          errJson?.error?.message ||
          (res.status === 404
            ? "API service unreachable. Please ensure backend server is running."
            : `Failed to fetch complaints (${res.status} ${res.statusText})`)
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to load complaints");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, categoryFilter, searchTerm, getToken]);

  useEffect(() => {
    if (isLoaded) {
      fetchComplaints();
    }
  }, [fetchComplaints, isLoaded]);

  return (
    <CitizenShell>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              My Submitted Complaints
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and track all civic issues you have reported across the municipality.
            </p>
          </div>

          <Link
            href="/citizen/report"
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#d95d39] hover:bg-[#c34e2c] text-white font-semibold text-xs shadow-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>File New Issue</span>
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setStatusFilter(f.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === f.value
                    ? "bg-[#d95d39] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search reference or street..."
                className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-[#d95d39]"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground font-medium focus:outline-none focus:border-[#d95d39] shrink-0"
            >
              <option value="">All Categories</option>
              {Object.values(ComplaintCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Complaints Grid Content */}
        {isLoading ? (
          <div className="p-16 rounded-2xl border border-border bg-card flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#d95d39] animate-spin" />
            <span className="text-xs text-muted-foreground">Loading complaints...</span>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-16 rounded-2xl border border-border bg-card flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-bold text-foreground">No complaints found</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              No complaint reports matched your search filters. Try clearing your filters or file a new issue report.
            </p>
            {statusFilter || categoryFilter || searchTerm ? (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("");
                  setCategoryFilter("");
                  setSearchTerm("");
                  setPage(1);
                }}
                className="mt-2 text-xs font-semibold text-[#d95d39] hover:underline"
              >
                Clear all filters
              </button>
            ) : (
              <Link
                href="/citizen/report"
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d95d39] hover:bg-[#c34e2c] text-white text-xs font-semibold transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Report an Issue</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complaints.map((c) => {
              const complaintId = c._id || c.id;
              const categoryColor = CATEGORY_COLORS[c.category as ComplaintCategory] || "#94a3b8";

              return (
                <Link
                  key={complaintId}
                  href={`/citizen/complaints/${complaintId}`}
                  className="rounded-2xl border border-border bg-card p-5 cursor-pointer transition flex flex-col justify-between gap-3 hover:border-[#d95d39]/60 hover:bg-secondary/40 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#d95d39]">
                          {c.referenceNumber || complaintId}
                        </span>
                        <StatusBadge status={c.status} />
                        {c.priority && <PriorityBadge priority={c.priority} />}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "Recent"}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground line-clamp-1">{c.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{c.description}</p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.address || "Location pinned on map"}</span>
                    </div>
                    <span className="font-semibold text-[#d95d39] hover:underline shrink-0">
                      Inspect &rarr;
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card">
            <span className="text-xs text-muted-foreground font-mono">
              Showing page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 hover:bg-secondary transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-border text-xs font-semibold disabled:opacity-40 hover:bg-secondary transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </CitizenShell>
  );
}
