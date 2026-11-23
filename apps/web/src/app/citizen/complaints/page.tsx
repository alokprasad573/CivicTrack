"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ComplaintCategory,
  ComplaintStatus,
} from "@civictrack/contracts";
import { CATEGORY_COLORS } from "../../../lib/ola-maps-config";
import { StatusBadge } from "../../../components/ui/status-badge";
import { PriorityBadge } from "../../../components/ui/priority-badge";
import { PageHeader } from "../../../components/ui/page-header";
import { EmptyState } from "../../../components/ui/empty-state";
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
            ? "Service unreachable. Please ensure the backend server is running."
            : `Failed to fetch reports (${res.status})`)
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to load reports");
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
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="My Reported Issues"
        subtitle="Search and track the status of all your submitted complaints across their lifecycle."
        action={{
          label: "Report New Issue",
          href: "/citizen/report",
          icon: Plus,
        }}
      />

      {/* Filter & Search Bar */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, description, or tracking ID..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-auto px-3.5 py-2.5 text-xs rounded-xl border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
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

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => {
            const isSelected = statusFilter === s.value;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setStatusFilter(s.value);
                  setPage(1);
                }}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition min-h-[36px] ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Complaints List */}
      {error && (
        <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="h-64 rounded-3xl border border-border bg-card flex flex-col items-center justify-center gap-2 shadow-xs">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Loading reports...</span>
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Reports Match Filters"
          description="Try clearing your search term or choosing a different status filter."
          action={{
            label: "Report an Issue",
            href: "/citizen/report",
            icon: Plus,
          }}
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((comp) => {
            const compId = comp._id || comp.id;
            const catColor = (CATEGORY_COLORS as Record<string, string>)[comp.category] || "#2563EB";
            return (
              <Link
                key={compId}
                href={`/citizen/complaints/${compId}`}
                className="block p-5 sm:p-6 rounded-3xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all group min-h-[48px]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                      {comp.referenceNumber || compId.slice(-8)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: catColor }}
                      />
                      <span className="text-xs font-semibold text-foreground capitalize">
                        {comp.category?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={comp.priority} />
                    <StatusBadge status={comp.status} />
                  </div>
                </div>

                <h3 className="text-base font-bold text-foreground group-hover:text-primary transition">
                  {comp.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                  {comp.description}
                </p>

                <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
                  <span className="flex items-center gap-1 truncate max-w-md">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{comp.address || "Location on city map"}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{new Date(comp.createdAt).toLocaleDateString()}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page <span className="font-bold text-foreground">{page}</span> of{" "}
            <span className="font-bold text-foreground">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 transition shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-secondary disabled:opacity-40 transition shadow-xs min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
