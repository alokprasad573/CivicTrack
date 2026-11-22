"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import dynamic from "next/dynamic";
import { AdminShell } from "../../components/layout/admin-shell";
import { MapComplaintItem } from "../../hooks/use-complaint-markers";
import { STATUS_COLORS, CATEGORY_COLORS } from "../../lib/ola-maps-config";
import { StatusBadge } from "../../components/ui/status-badge";
import { PriorityBadge } from "../../components/ui/priority-badge";

const SpatialMapPreview = dynamic(
  () =>
    import("../../components/maps/spatial-map-preview").then(
      (mod) => mod.SpatialMapPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[380px] rounded-2xl border border-border bg-card/60 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">
          Loading Admin Spatial Incident Queue...
        </span>
      </div>
    ),
  }
);
import {
  Inbox,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserCheck,
  Building2,
  Calendar,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Eye,
  RefreshCw,
  CopyCheck,
  Layers,
  ExternalLink,
  ShieldCheck,
  MapPin,
  Map,
  Camera,
  ImageIcon,
} from "lucide-react";
import { EvidenceLightbox, EvidenceImageItem } from "../../components/evidence/evidence-lightbox";

export default function AdminTriagePage() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Departments for assignment modal
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentOfficers, setDepartmentOfficers] = useState<any[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);

  // Active modal state
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [modalType, setModalType] = useState<"VERIFY" | "REJECT" | "ASSIGN" | "DUPLICATES" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Evidence Lightbox state
  const [evidenceLightboxOpen, setEvidenceLightboxOpen] = useState(false);
  const [evidenceImages, setEvidenceImages] = useState<EvidenceImageItem[]>([]);
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);

  const handleOpenEvidenceModal = useCallback((comp: any) => {
    const rawEvidence = comp.evidence || comp.evidenceImages || [];
    if (rawEvidence.length === 0) return;

    const items: EvidenceImageItem[] = rawEvidence.map((item: any) => {
      const key = item.objectKey || item.key || "";
      return {
        ...item,
        key,
        objectKey: key,
        url: item.url || "",
      };
    });

    setEvidenceImages(items);
    setActiveEvidenceIndex(0);
    setEvidenceLightboxOpen(true);

    // If any items are missing pre-signed view URLs, fetch them
    items.forEach((item, index) => {
      if (!item.url && item.objectKey) {
        fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(item.objectKey)}`)
          .then((r) => r.json())
          .then((viewJson) => {
            if (viewJson.success && viewJson.data?.viewUrl) {
              setEvidenceImages((prev) =>
                prev.map((p, idx) =>
                  idx === index ? { ...p, url: viewJson.data.viewUrl } : p
                )
              );
            }
          })
          .catch(() => {});
      }
    });
  }, []);

  // Duplicate candidates state
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [linkingComplaintId, setLinkingComplaintId] = useState<string | null>(null);
  const [linkNotes, setLinkNotes] = useState("");

  // Form states inside modal
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  const [assignedPriority, setAssignedPriority] = useState<ComplaintPriority>(ComplaintPriority.HIGH);
  const [assignedDueDays, setAssignedDueDays] = useState(3);
  const [actionRemarks, setActionRemarks] = useState("");

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "12");
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (searchTerm) params.set("search", searchTerm);

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
        setError("Failed to fetch triage queue");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load triage queue");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, categoryFilter, priorityFilter, searchTerm]);

  // Load active departments once
  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await fetch("/api/v1/departments");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setDepartments(json.data);
          }
        }
      } catch { }
    }
    loadDepartments();
  }, []);

  // Synchronize map selection with filtered complaints list
  useEffect(() => {
    if (selectedComplaintId && complaints.length > 0) {
      const exists = complaints.some(
        (c) => (c._id || c.id) === selectedComplaintId
      );
      if (!exists) {
        setSelectedComplaintId(null);
      }
    }
  }, [complaints, selectedComplaintId]);

  // Transform complaints into map markers with spatial coordinate validation
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

  // Fetch officers whenever department changes in assignment modal
  useEffect(() => {
    if (!selectedDeptId) {
      setDepartmentOfficers([]);
      setSelectedOfficerId("");
      return;
    }

    async function loadOfficers() {
      setLoadingOfficers(true);
      try {
        const res = await fetch(`/api/v1/departments/${selectedDeptId}/officers`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setDepartmentOfficers(json.data);
          }
        }
      } catch {
        setDepartmentOfficers([]);
      } finally {
        setLoadingOfficers(false);
      }
    }
    loadOfficers();
  }, [selectedDeptId]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Workflow actions
  const handleStartReview = async (complaintId: string) => {
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Administrator initiated triage review." }),
      });
      if (res.ok) {
        fetchComplaints();
      } else {
        const errJson = await res.json();
        alert(errJson.error?.message || "Failed to start review");
      }
    } catch {
      alert("Network error starting review");
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/v1/complaints/${selectedComplaint._id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: assignedPriority,
          remarks: actionRemarks || "Complaint verified as valid municipal issue.",
        }),
      });

      if (res.ok) {
        setModalType(null);
        setSelectedComplaint(null);
        fetchComplaints();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to verify complaint");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit verification");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (rejectionReason.trim().length < 5) {
      setActionError("Rejection reason must be at least 5 characters.");
      return;
    }
    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/v1/complaints/${selectedComplaint._id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });

      if (res.ok) {
        setModalType(null);
        setSelectedComplaint(null);
        setRejectionReason("");
        fetchComplaints();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to reject complaint");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit rejection");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !selectedDeptId) {
      setActionError("Please select a target municipal department.");
      return;
    }
    setActionLoading(true);
    setActionError(null);

    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + assignedDueDays);

    try {
      const res = await fetch(`/api/v1/complaints/${selectedComplaint._id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          assignedOfficerId: selectedOfficerId || undefined,
          priority: assignedPriority,
          dueAt: dueAt.toISOString(),
          remarks: actionRemarks || "Assigned by municipal administrator.",
        }),
      });

      if (res.ok) {
        setModalType(null);
        setSelectedComplaint(null);
        fetchComplaints();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to assign complaint");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit assignment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDuplicatesModal = async (complaint: any) => {
    setSelectedComplaint(complaint);
    setModalType("DUPLICATES");
    setDuplicateCandidates([]);
    setLoadingDuplicates(true);
    setActionError(null);
    setLinkNotes("");

    try {
      const res = await fetch(`/api/v1/duplicates/${complaint._id}/candidates`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDuplicateCandidates(json.data.candidates || []);
        }
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to fetch duplicate candidates");
      }
    } catch (err: any) {
      setActionError(err.message || "Network error querying duplicate candidates");
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const handleLinkDuplicate = async (originalComplaintId: string) => {
    if (!selectedComplaint) return;
    setLinkingComplaintId(originalComplaintId);
    setActionError(null);

    try {
      const res = await fetch(`/api/v1/duplicates/${selectedComplaint._id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalComplaintId,
          reason: "ADMIN_CONFIRMED",
          notes: linkNotes || "Linked by municipal triage administrator after manual review.",
        }),
      });

      if (res.ok) {
        setModalType(null);
        setSelectedComplaint(null);
        fetchComplaints();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to link duplicate complaint");
      }
    } catch (err: any) {
      setActionError(err.message || "Network error linking complaint");
    } finally {
      setLinkingComplaintId(null);
    }
  };

  // KPI Calculations
  const submittedCount = complaints.filter((c) => c.status === ComplaintStatus.SUBMITTED).length;
  const underReviewCount = complaints.filter((c) => c.status === ComplaintStatus.UNDER_REVIEW).length;
  const verifiedCount = complaints.filter((c) => c.status === ComplaintStatus.VERIFIED).length;
  const inProgressCount = complaints.filter((c) => c.status === ComplaintStatus.IN_PROGRESS).length;
  const pendingTriageCount = submittedCount + underReviewCount;
  const overdueCount = complaints.filter(
    (c) =>
      c.dueAt &&
      new Date(c.dueAt) < new Date() &&
      ![ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED].includes(c.status)
  ).length;
  const resolvedCount = complaints.filter(
    (c) => c.status === ComplaintStatus.RESOLVED || c.status === ComplaintStatus.CLOSED
  ).length;
  const resolutionRate = total > 0 ? Math.round((resolvedCount / Math.max(1, total)) * 100) : 0;

  return (
    <AdminShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Municipal Operations & Triage Console</span>
              <span className="text-xs px-2.5 py-1 rounded-full font-mono bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold">
                {total} Total
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verify citizen submissions, inspect duplicate candidates, set priorities, and dispatch department officers.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                showMap
                  ? "bg-[#d95d39] text-white border-[#d95d39] shadow-sm"
                  : "bg-card text-foreground hover:bg-secondary border-border"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>{showMap ? "Hide Map" : "Show Map"}</span>
            </button>

            <button
              type="button"
              onClick={() => fetchComplaints()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card text-foreground text-xs font-semibold hover:bg-secondary border border-border transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Queue</span>
            </button>
          </div>
        </div>

        {/* Operational KPI Counters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Total Complaints</span>
            <div className="font-display text-2xl sm:text-3xl font-bold mt-1 tabular-nums text-foreground">{total}</div>
          </div>

          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Pending Review / Triage</span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-amber-500 mt-1 tabular-nums">
              {pendingTriageCount}
            </div>
          </div>

          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">SLA Overdue Escalations</span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-rose-500 mt-1 tabular-nums">
              {overdueCount}
            </div>
          </div>

          <div className="border border-border rounded-2xl p-4 bg-card shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Resolution Rate</span>
            <div className="font-display text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {resolutionRate}%
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by reference ID, title, address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value={ComplaintStatus.SUBMITTED}>Submitted</option>
              <option value={ComplaintStatus.UNDER_REVIEW}>Under Review</option>
              <option value={ComplaintStatus.VERIFIED}>Verified</option>
              <option value={ComplaintStatus.ASSIGNED}>Assigned</option>
              <option value={ComplaintStatus.IN_PROGRESS}>In Progress</option>
              <option value={ComplaintStatus.RESOLVED}>Resolved</option>
              <option value={ComplaintStatus.CLOSED}>Closed</option>
              <option value={ComplaintStatus.REJECTED}>Rejected</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Categories</option>
              {Object.values(ComplaintCategory).map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Priorities</option>
              {Object.values(ComplaintPriority).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Spatial Map Preview Section */}
        {showMap && (
          <div className="rounded-2xl overflow-hidden border border-border shadow-xl">
            <SpatialMapPreview
              complaints={mapComplaintItems}
              selectedComplaintId={selectedComplaintId}
              onSelectComplaint={(c) => setSelectedComplaintId(c ? c.id : null)}
              userRole="admin"
              enableClustering={true}
              height="380px"
              title="Admin Spatial Incident Queue"
              description="Click any marker, cluster, or table row to inspect"
            />
          </div>
        )}

        {/* Complaints Table */}
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs">Loading triage queue...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : complaints.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
              <Inbox className="w-10 h-10 stroke-1 text-muted-foreground/60" />
              <p className="text-sm font-semibold">No complaints in triage matching filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/50 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">Ref / Date</th>
                    <th className="px-4 py-3.5">Title & Location</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Priority</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Department</th>
                    <th className="px-4 py-3.5 text-right">Workflow Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {complaints.map((item) => {
                    const statusConfig = STATUS_COLORS[item.status as ComplaintStatus] || {
                      bg: "bg-secondary",
                      text: "text-foreground",
                      border: "border-border",
                    };
                    const categoryColor = CATEGORY_COLORS[item.category as ComplaintCategory] || "#14b8a6";
                    const complaintId = item._id || item.id;
                    const isSelected = selectedComplaintId === complaintId;

                    return (
                      <tr
                        key={complaintId}
                        onClick={() => setSelectedComplaintId(isSelected ? null : complaintId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-primary/10 border-l-4 border-l-primary font-medium"
                            : "hover:bg-secondary/30"
                        }`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link
                            href={`/citizen/complaints/${complaintId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono font-bold text-foreground hover:text-primary transition-colors block"
                          >
                            {item.referenceNumber}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                            {item.isDuplicate && (
                              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <CopyCheck className="w-2.5 h-2.5" />
                                Duplicate
                              </span>
                            )}
                            {((item.evidence && item.evidence.length > 0) || (item.evidenceImages && item.evidenceImages.length > 0)) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEvidenceModal(item);
                                }}
                                className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                                title="Inspect Evidence Photos"
                              >
                                <Camera className="w-2.5 h-2.5" />
                                {(item.evidence || item.evidenceImages).length} photo{((item.evidence || item.evidenceImages).length > 1 ? "s" : "")}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 max-w-[240px]">
                          <p className="font-semibold text-foreground truncate flex items-center gap-1.5">
                            <span>{item.title}</span>
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase bg-primary text-primary-foreground tracking-wider shrink-0">
                                Active Pin
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate mt-0.5">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            <span className="truncate">{item.address}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: categoryColor }}
                            />
                            {item.category.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <PriorityBadge priority={item.priority} />
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={item.status} />
                            {item.dueAt && ![ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED].includes(item.status) && (
                              new Date(item.dueAt) < new Date() ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1 w-fit">
                                  <AlertTriangle className="w-2.5 h-2.5 text-rose-500 shrink-0" /> SLA OVERDUE
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  Due {new Date(item.dueAt).toLocaleDateString()}
                                </span>
                              )
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground">
                          {item.departmentId?.name || (
                            <span className="italic text-muted-foreground/60">Unassigned</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {((item.evidence && item.evidence.length > 0) || (item.evidenceImages && item.evidenceImages.length > 0)) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEvidenceModal(item);
                                }}
                                className="p-1.5 rounded-lg bg-card text-[#d95d39] hover:bg-secondary border border-border transition-colors"
                                title="Inspect Evidence Photos in Lightbox"
                              >
                                <Camera className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDuplicatesModal(item);
                              }}
                              className="p-1.5 rounded-lg bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
                              title="Check Duplicate Candidates (Spatial & Text)"
                            >
                              <CopyCheck className="w-3.5 h-3.5" />
                            </button>

                            {item.status === ComplaintStatus.SUBMITTED && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartReview(item._id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-semibold transition-colors"
                              >
                                Review
                              </button>
                            )}

                            {item.status === ComplaintStatus.UNDER_REVIEW && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedComplaint(item);
                                    setAssignedPriority(item.priority || ComplaintPriority.MEDIUM);
                                    setModalType("VERIFY");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#d95d39] hover:bg-[#c34e2c] text-white text-xs font-semibold shadow-sm transition-colors"
                                >
                                  Verify
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedComplaint(item);
                                    setModalType("REJECT");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-500 font-semibold text-xs transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {(item.status === ComplaintStatus.VERIFIED ||
                              item.status === ComplaintStatus.ASSIGNED) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedComplaint(item);
                                    setSelectedDeptId(item.departmentId?._id || item.departmentId || "");
                                    setSelectedOfficerId(item.assignedOfficerId?._id || item.assignedOfficerId || "");
                                    setAssignedPriority(item.priority || ComplaintPriority.HIGH);
                                    setModalType("ASSIGN");
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-semibold transition-colors"
                                >
                                  {item.status === ComplaintStatus.ASSIGNED ? "Reassign" : "Assign"}
                                </button>
                              )}

                            <Link
                              href={`/citizen/complaints/${item._id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                              title="Inspect Full Details"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Modals */}
        {modalType && selectedComplaint && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {modalType === "VERIFY" && "Verify Complaint Legitimacy"}
                    {modalType === "REJECT" && "Reject Complaint Report"}
                    {modalType === "ASSIGN" && "Assign Municipal Department & Officer"}
                    {modalType === "DUPLICATES" && "Duplicate Detection & Advisory Inspector"}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {selectedComplaint.referenceNumber} — {selectedComplaint.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModalType(null);
                    setActionError(null);
                  }}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs mb-4">
                  {actionError}
                </div>
              )}

              {modalType === "VERIFY" && (
                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Operational Priority
                    </label>
                    <select
                      value={assignedPriority}
                      onChange={(e) => setAssignedPriority(e.target.value as ComplaintPriority)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value={ComplaintPriority.LOW}>LOW</option>
                      <option value={ComplaintPriority.MEDIUM}>MEDIUM</option>
                      <option value={ComplaintPriority.HIGH}>HIGH</option>
                      <option value={ComplaintPriority.CRITICAL}>CRITICAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Verification Remarks (Audit Log)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Field inspection confirmed water pipeline rupture..."
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalType(null)}
                      className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Approve & Verify</span>
                    </button>
                  </div>
                </form>
              )}

              {modalType === "REJECT" && (
                <form onSubmit={handleRejectSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Rejection Reason (Mandatory)
                    </label>
                    <textarea
                      rows={4}
                      required
                      placeholder="State clearly why this complaint is rejected (e.g. Duplicate report, private property issue, outside municipal jurisdiction)..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Min 5 characters. This reason will be recorded in the public audit history and shown to the citizen.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalType(null)}
                      className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm Rejection</span>
                    </button>
                  </div>
                </form>
              )}

              {modalType === "ASSIGN" && (
                <form onSubmit={handleAssignSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Municipal Department *
                    </label>
                    <select
                      required
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Responsible Department</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Assign Specific Officer (Optional)
                    </label>
                    <select
                      value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)}
                      disabled={!selectedDeptId || loadingOfficers}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="">Leave in Department Queue</option>
                      {departmentOfficers.map((off) => (
                        <option key={off._id} value={off._id}>
                          {off.name} ({off.email})
                        </option>
                      ))}
                    </select>
                    {loadingOfficers && (
                      <p className="text-[10px] text-muted-foreground mt-1">Loading officers...</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        Priority Level
                      </label>
                      <select
                        value={assignedPriority}
                        onChange={(e) => setAssignedPriority(e.target.value as ComplaintPriority)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value={ComplaintPriority.LOW}>LOW</option>
                        <option value={ComplaintPriority.MEDIUM}>MEDIUM</option>
                        <option value={ComplaintPriority.HIGH}>HIGH</option>
                        <option value={ComplaintPriority.CRITICAL}>CRITICAL</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">
                        SLA Due Date
                      </label>
                      <select
                        value={assignedDueDays}
                        onChange={(e) => setAssignedDueDays(Number(e.target.value))}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value={1}>1 Day (24 hrs - Urgent)</option>
                        <option value={3}>3 Days (Standard SLA)</option>
                        <option value={7}>7 Days (Major Works)</option>
                        <option value={14}>14 Days (Capital Projects)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Assignment Remarks
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Assigned to Road Maintenance squad for immediate patch repair..."
                      value={actionRemarks}
                      onChange={(e) => setActionRemarks(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalType(null)}
                      className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 disabled:opacity-50"
                    >
                      {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Dispatch Assignment</span>
                    </button>
                  </div>
                </form>
              )}

              {modalType === "DUPLICATES" && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-secondary/50 border border-border text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-foreground">Advisory Duplicate Triage:</span>{" "}
                    CivicTrack scans for active incidents within 250 meters sharing category and semantic similarity.
                    Complaints are never automatically rejected or deleted; link verified duplicates to group field work.
                  </div>

                  {loadingDuplicates ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-xs">Analyzing spatial coordinates & text similarity...</p>
                    </div>
                  ) : duplicateCandidates.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2 border border-border/50 rounded-xl bg-background/50">
                      <ShieldCheck className="w-8 h-8 text-emerald-400/80" />
                      <p className="text-xs font-semibold text-foreground">No Duplicate Incidents Detected</p>
                      <p className="text-[11px] text-muted-foreground max-w-xs">
                        No active complaints within 250 meters share significant category or description matches.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                      <p className="text-xs font-semibold text-foreground">
                        {duplicateCandidates.length} Potential Match{duplicateCandidates.length > 1 ? "es" : ""} Detected:
                      </p>
                      {duplicateCandidates.map((candidate) => {
                        const isHighMatch = candidate.score >= 70;

                        return (
                          <div
                            key={candidate._id}
                            className="p-3.5 rounded-xl border border-border bg-background hover:border-primary/40 transition-colors flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {candidate.referenceNumber}
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${isHighMatch
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    }`}
                                >
                                  {candidate.score}% Match
                                </span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {candidate.distanceMeters}m away
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-foreground">{candidate.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{candidate.address}</p>
                            </div>

                            {/* Signal chips */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {candidate.signals?.map((sig: string) => (
                                <span
                                  key={sig}
                                  className="text-[9px] px-2 py-0.5 rounded font-mono bg-secondary text-muted-foreground border border-border"
                                >
                                  {sig === "SAME_CATEGORY" && "Same Category"}
                                  {sig === "WITHIN_DISTANCE" && "<250m Proximity"}
                                  {sig === "DESCRIPTION_SIMILARITY" && `Text Match (${candidate.textSimilarity}%)`}
                                  {sig === "ADDRESS_MATCH" && "Address Match"}
                                </span>
                              ))}
                            </div>

                            {/* Link duplicate action */}
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                Status: {candidate.status}
                              </span>

                              <button
                                type="button"
                                disabled={linkingComplaintId === candidate._id}
                                onClick={() => handleLinkDuplicate(candidate._id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 text-xs font-semibold transition-colors disabled:opacity-50"
                              >
                                {linkingComplaintId === candidate._id && (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                )}
                                <span>Link as Duplicate</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setModalType(null)}
                      className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold"
                    >
                      Close Inspector
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Evidence Inspection Lightbox */}
        <EvidenceLightbox
          images={evidenceImages}
          initialIndex={activeEvidenceIndex}
          isOpen={evidenceLightboxOpen}
          onClose={() => setEvidenceLightboxOpen(false)}
        />
      </div>
    </AdminShell>
  );
}
