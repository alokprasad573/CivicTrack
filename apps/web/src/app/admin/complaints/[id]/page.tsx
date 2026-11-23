"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { PriorityBadge } from "../../../../components/ui/priority-badge";
import { CATEGORY_COLORS } from "../../../../lib/ola-maps-config";
import { ComplaintStatusTracker } from "../../../../components/complaints/complaint-status-tracker";
import { EvidenceLightbox, EvidenceImageItem } from "../../../../components/evidence/evidence-lightbox";
import { useComplaintDetailRealtime } from "../../../../hooks/use-complaint-detail-realtime";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  FileText,
  User,
  Building2,
  Loader2,
  X,
  ShieldCheck,
  UserCheck,
  Send,
  Eye,
  ImageIcon,
  ZoomIn,
} from "lucide-react";

const OlaMap = dynamic(
  () => import("../../../../components/maps/ola-map").then((mod) => mod.OlaMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[280px] rounded-xl border border-border bg-card/40 flex items-center justify-center text-xs text-muted-foreground">
        Loading Incident Map...
      </div>
    ),
  }
);

export default function AdminComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams.id;

  const [complaint, setComplaint] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Workflow modals
  const [activeModal, setActiveModal] = useState<"VERIFY" | "REJECT" | "ASSIGN" | "CLOSE" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states
  const [verifyCategory, setVerifyCategory] = useState<ComplaintCategory>(ComplaintCategory.ROADS_POTHOLES);
  const [verifyPriority, setVerifyPriority] = useState<ComplaintPriority>(ComplaintPriority.HIGH);
  const [verifyDeptId, setVerifyDeptId] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");

  const [rejectReason, setRejectReason] = useState("");

  const [assignDeptId, setAssignDeptId] = useState("");
  const [assignOfficerId, setAssignOfficerId] = useState("");
  const [assignPriority, setAssignPriority] = useState<ComplaintPriority>(ComplaintPriority.HIGH);
  const [assignNotes, setAssignNotes] = useState("");
  const [closeRemarks, setCloseRemarks] = useState("");

  const refreshImageUrl = async (key: string) => {
    try {
      const res = await fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(key)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data?.viewUrl) {
          setViewUrls((prev) => ({ ...prev, [key]: data.data.viewUrl }));
        }
      }
    } catch {
      // Ignore background refresh error
    }
  };

  const loadDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [compRes, deptsRes] = await Promise.all([
        fetch(`/api/v1/complaints/${complaintId}`, { credentials: "include" }),
        fetch("/api/v1/departments", { credentials: "include" }),
      ]);

      if (!compRes.ok) {
        throw new Error(compRes.status === 404 ? "Complaint not found" : "Failed to load incident");
      }

      const compJson = await compRes.json();
      if (compJson.success && compJson.data) {
        const comp = compJson.data.complaint || compJson.data;
        const hist = compJson.data.history || [];
        setComplaint(comp);
        setHistory(hist);

        // Pre-populate verify/assign states
        setVerifyCategory(comp.category || ComplaintCategory.ROADS_POTHOLES);
        setVerifyPriority(comp.priority || ComplaintPriority.HIGH);
        const currentDeptId = comp.departmentId?._id || comp.departmentId || "";
        setVerifyDeptId(currentDeptId);
        setAssignDeptId(currentDeptId);
        setAssignOfficerId(comp.assignedOfficerId?._id || comp.assignedOfficerId || "");
        setAssignPriority(comp.priority || ComplaintPriority.HIGH);

        // Populate presigned view URLs
        const initialUrls: Record<string, string> = {};
        const allEv = [...(comp.evidence || []), ...(comp.resolutionEvidence || [])];
        for (const ev of allEv) {
          const key = ev.objectKey || ev.key;
          if (ev.url && key) {
            initialUrls[key] = ev.url;
          } else if (key) {
            fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(key)}`, { credentials: "include" })
              .then((r) => r.json())
              .then((vj) => {
                if (vj.success && vj.data?.viewUrl) {
                  setViewUrls((prev) => ({ ...prev, [key]: vj.data.viewUrl }));
                }
              })
              .catch(() => {});
          }
        }
        setViewUrls((prev) => ({ ...prev, ...initialUrls }));
      }

      if (deptsRes.ok) {
        const deptJson = await deptsRes.json();
        if (deptJson.success && deptJson.data) {
          setDepartments(deptJson.data || []);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load incident details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [complaintId]);

  // Real-time live room updates for this complaint
  useComplaintDetailRealtime({
    complaintId,
    onRefresh: () => {
      loadDetails();
    },
    onStatusUpdated: (update) => {
      setComplaint((prev: any) => (prev ? { ...prev, status: update.status } : prev));
      loadDetails();
    },
    onAssigned: () => {
      loadDetails();
    },
  });

  // Load officers when assign department changes
  useEffect(() => {
    const targetDeptId = activeModal === "ASSIGN" ? assignDeptId : verifyDeptId;
    if (!targetDeptId) {
      setOfficers([]);
      return;
    }

    fetch(`/api/v1/users?role=OFFICER&departmentId=${targetDeptId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setOfficers(json.data.users || json.data || []);
        }
      })
      .catch(() => setOfficers([]));
  }, [assignDeptId, verifyDeptId, activeModal]);

  const handleReview = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ remarks: "Municipal triage administrator reviewed citizen report." }),
      });
      if (res.ok) {
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to mark under review");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyDeptId) {
      setActionError("Please select a target department for verification");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          category: verifyCategory,
          priority: verifyPriority,
          departmentId: verifyDeptId,
          remarks: verifyNotes || "Complaint verified by municipal operations triage.",
        }),
      });
      if (res.ok) {
        setActiveModal(null);
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to verify complaint");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rejectReason.trim().length < 5) {
      setActionError("Please enter a valid rejection reason (min 5 characters)");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (res.ok) {
        setActiveModal(null);
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to reject complaint");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDeptId) {
      setActionError("Please select a department");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          departmentId: assignDeptId,
          assignedOfficerId: assignOfficerId || undefined,
          priority: assignPriority,
          remarks: assignNotes || "Dispatched by municipal operations triage command.",
        }),
      });
      if (res.ok) {
        setActiveModal(null);
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to assign complaint");
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          remarks: closeRemarks.trim() || "Municipal administrator formally closed this complaint.",
        }),
      });
      if (res.ok) {
        setActiveModal(null);
        setCloseRemarks("");
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to close complaint");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to close complaint");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading report record...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="p-8 text-center text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl max-w-lg mx-auto">
        <AlertOctagon className="w-10 h-10 mx-auto mb-3" />
        <h2 className="text-base font-bold mb-1">Report Not Found</h2>
        <p className="text-xs mb-4">{error || "Unable to retrieve report details."}</p>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Queue</span>
        </Link>
      </div>
    );
  }

  const coords = complaint.location?.coordinates || [77.5946, 12.9716];
  const citizenEvidence: EvidenceImageItem[] = (complaint.evidence || []).map((e: any, idx: number) => ({
    key: e.objectKey || e.key || `ev-${idx}`,
    objectKey: e.objectKey || e.key,
    url: (e.objectKey ? viewUrls[e.objectKey] : null) || (e.key ? viewUrls[e.key] : null) || e.url || "",
    originalName: e.filename || "Citizen Evidence",
    uploadedAt: e.uploadedAt,
  }));

  const resolutionEvidence: EvidenceImageItem[] = (complaint.resolutionEvidence || []).map((e: any, idx: number) => ({
    key: e.objectKey || e.key || `res-${idx}`,
    objectKey: e.objectKey || e.key,
    url: (e.objectKey ? viewUrls[e.objectKey] : null) || (e.key ? viewUrls[e.key] : null) || e.url || "",
    originalName: "Field Resolution Proof",
    uploadedAt: e.uploadedAt,
  }));

  const allEvidence: EvidenceImageItem[] = [...citizenEvidence, ...resolutionEvidence];

  return (
    <div className="flex flex-col gap-6">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Operations Hub & Triage</span>
          </Link>

          {/* Quick Action Buttons for Admin */}
          <div className="flex items-center gap-2">
            {complaint.status === ComplaintStatus.SUBMITTED && (
              <button
                type="button"
                onClick={handleReview}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/20 transition flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Mark Under Review</span>
              </button>
            )}

            {[ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW].includes(complaint.status) && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActiveModal("VERIFY");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition flex items-center gap-1.5 shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify Incident</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActiveModal("REJECT");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/20 transition flex items-center gap-1.5"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </>
            )}

            {[ComplaintStatus.VERIFIED, ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS].includes(complaint.status) && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActiveModal("ASSIGN");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition flex items-center gap-1.5 shadow-sm"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{complaint.status === ComplaintStatus.VERIFIED ? "Assign Department & Officer" : "Reassign Department/Officer"}</span>
              </button>
            )}

            {[ComplaintStatus.VERIFIED, ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED].includes(complaint.status) && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setCloseRemarks("");
                  setActiveModal("CLOSE");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                title="Formally close this complaint"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Close Complaint</span>
              </button>
            )}
          </div>
        </div>

        {/* Header Hero Card */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className=" text-sm font-extrabold text-foreground bg-secondary px-3 py-1 rounded-lg border border-border">
                {complaint.referenceNumber}
              </span>
              <StatusBadge status={complaint.status} />
              <PriorityBadge priority={complaint.priority} />
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-secondary text-foreground capitalize">
                {complaint.category?.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(complaint.createdAt).toLocaleDateString()}
              </span>
              {complaint.dueAt && (
                <span className="text-amber-500 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Due: {new Date(complaint.dueAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">{complaint.title}</h1>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{complaint.address || "No street address provided"}</span>
            </p>
          </div>
        </div>

        {/* 2-Column Incident Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Details, Ola Map, Evidence */}
          <div className="lg:col-span-2 space-y-6">
            {/* Citizen Description Card */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-2.5">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Citizen Description & Citizen Details</span>
              </h3>
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap bg-secondary/30 p-4 rounded-xl border border-border">
                {complaint.description}
              </p>

              {/* Citizen Identity */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <strong>Reporter:</strong> {complaint.citizenId?.name || "Anonymous Citizen"}
                </span>
                {complaint.citizenId?.email && (
                  <span className=" text-[11px]">{complaint.citizenId.email}</span>
                )}
              </div>
            </div>

            {/* Department Assignment Details */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Municipal Assignment & SLA Telemetry</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Department</span>
                  <p className="font-semibold text-foreground">
                    {complaint.departmentId?.name || "Pending Triage Assignment"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Assigned Field Officer</span>
                  <p className="font-semibold text-foreground">
                    {complaint.assignedOfficerId?.name || "Unassigned"}
                  </p>
                </div>
              </div>
            </div>

            {/* Ola Map Location Box */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>Geospatial Incident Location</span>
                </h3>
                <span className="text-xs  text-muted-foreground">
                  [{coords[0]?.toFixed(4)}, {coords[1]?.toFixed(4)}]
                </span>
              </div>
              <div className="h-64 rounded-xl overflow-hidden border border-border">
                <OlaMap
                  initialCenter={[coords[0], coords[1]]}
                  initialZoom={15}
                  complaints={[
                    {
                      ...complaint,
                      id: complaint._id || complaint.id || complaintId,
                      referenceNumber: complaint.referenceNumber || String(complaintId).slice(-6).toUpperCase(),
                      title: complaint.title || "Incident Location",
                      description: complaint.description,
                      category: complaint.category || ComplaintCategory.OTHER,
                      status: complaint.status || ComplaintStatus.SUBMITTED,
                      priority: complaint.priority,
                      location: complaint.location,
                      address: complaint.address || "Reported Location",
                      createdAt: complaint.createdAt,
                    },
                  ]}
                  selectedComplaintId={complaint._id || complaint.id || complaintId}
                />
              </div>
            </div>

            {/* Citizen Photo Evidence Gallery */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span>Citizen Photo Evidence ({citizenEvidence.length})</span>
                </h3>
                {citizenEvidence.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
                    {citizenEvidence.length} incident image{citizenEvidence.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {citizenEvidence.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">No photo evidence attached by citizen.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {citizenEvidence.map((item, idx) => (
                    <div
                      key={item.key || idx}
                      onClick={() => {
                        setActiveImageIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className="aspect-video rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center relative group cursor-pointer hover:border-primary/50 transition"
                      title="Click to zoom in Lightbox"
                    >
                      {item.url ? (
                        <img
                          src={item.url}
                          alt={item.originalName || "Citizen Evidence"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={() => {
                            const k = item.objectKey || item.key;
                            if (k) refreshImageUrl(k);
                          }}
                        />
                      ) : (
                        <div className="text-[10px] text-muted-foreground">Loading preview...</div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <ZoomIn className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Officer Resolution Photo Evidence */}
            {(resolutionEvidence.length > 0 || complaint.resolvedAt || [ComplaintStatus.IN_PROGRESS, ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED].includes(complaint.status)) && (
              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Officer Resolution Proof Evidence ({resolutionEvidence.length})</span>
                  </h3>
                  {resolutionEvidence.length > 0 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Verified Work Proof
                    </span>
                  )}
                </div>

                {resolutionEvidence.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No resolution photos attached by field staff.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {resolutionEvidence.map((item, idx) => (
                      <div
                        key={item.key || idx}
                        onClick={() => {
                          setActiveImageIndex(citizenEvidence.length + idx);
                          setLightboxOpen(true);
                        }}
                        className="aspect-video rounded-xl overflow-hidden border border-emerald-500/30 bg-background flex items-center justify-center relative group cursor-pointer hover:border-emerald-500 transition"
                        title="Click to zoom resolution proof in Lightbox"
                      >
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.originalName || "Resolution Evidence"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => {
                              const k = item.objectKey || item.key;
                              if (k) refreshImageUrl(k);
                            }}
                          />
                        ) : (
                          <div className="text-[10px] text-muted-foreground">Loading preview...</div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                          <ZoomIn className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resolution Record (if resolved) */}
            {complaint.resolvedAt && (
              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2.5">
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Officer Resolution Notes</span>
                </h3>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {complaint.resolutionRemarks || "Field resolution completed by assigned municipal officer."}
                </p>
              </div>
            )}
          </div>

          {/* Right Col: Standardized Complaint Status Tracker */}
          <div className="space-y-6">
            <ComplaintStatusTracker
              currentStatus={complaint.status}
              history={history}
              viewUrls={viewUrls}
              resolutionEvidence={complaint.resolutionEvidence}
              resolutionRemarks={complaint.resolutionRemarks}
              resolvedAt={complaint.resolvedAt}
              onImageClick={(url) => {
                const idx = allEvidence.findIndex((e) => e.url === url);
                if (idx !== -1) {
                  setActiveImageIndex(idx);
                  setLightboxOpen(true);
                }
              }}
            />
          </div>
        </div>

        {/* Evidence Lightbox */}
        <EvidenceLightbox
          images={allEvidence}
          initialIndex={activeImageIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />

        {/* VERIFY MODAL */}
        {activeModal === "VERIFY" && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-500" />
                  <span>Verify Incident & Confirm Triage</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Category *</label>
                  <select
                    value={verifyCategory}
                    onChange={(e) => setVerifyCategory(e.target.value as ComplaintCategory)}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground"
                  >
                    {Object.values(ComplaintCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Priority *</label>
                  <select
                    value={verifyPriority}
                    onChange={(e) => setVerifyPriority(e.target.value as ComplaintPriority)}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground"
                  >
                    {Object.values(ComplaintPriority).map((pri) => (
                      <option key={pri} value={pri}>
                        {pri} PRIORITY
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Target Department *</label>
                  <select
                    value={verifyDeptId}
                    onChange={(e) => setVerifyDeptId(e.target.value)}
                    required
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground"
                  >
                    <option value="">Select Municipal Department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Verification Notes</label>
                  <textarea
                    rows={3}
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    placeholder="e.g. Field inspection confirmed road pothole severity. Dispatched to infrastructure team."
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Verification</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* REJECT MODAL */}
        {activeModal === "REJECT" && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <AlertOctagon className="w-5 h-5 text-rose-500" />
                  <span>Reject Civic Complaint</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleReject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Mandatory Rejection Reason *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Specify why this incident cannot be serviced (e.g. Duplicate report, private property outside municipal jurisdiction, insufficient details)..."
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Min 5 characters.</p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Rejection</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ASSIGN / REASSIGN MODAL */}
        {activeModal === "ASSIGN" && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  <span>Assign Department & Officer</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Department *</label>
                  <select
                    value={assignDeptId}
                    onChange={(e) => {
                      setAssignDeptId(e.target.value);
                      setAssignOfficerId("");
                    }}
                    required
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Assign Specific Officer</label>
                  <select
                    value={assignOfficerId}
                    onChange={(e) => setAssignOfficerId(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground"
                  >
                    <option value="">Assign to Department Pool (Unassigned officer)</option>
                    {officers.map((o) => (
                      <option key={o._id} value={o._id}>
                        {o.name} ({o.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Priority</label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value as ComplaintPriority)}
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground"
                  >
                    {Object.values(ComplaintPriority).map((pri) => (
                      <option key={pri} value={pri}>
                        {pri} PRIORITY
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Dispatch Remarks</label>
                  <textarea
                    rows={3}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="Instructions for the assigned officer or department..."
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Assignment</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CLOSE COMPLAINT MODAL */}
        {activeModal === "CLOSE" && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span>Formally Close Complaint</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {actionError}
                </div>
              )}

              <form onSubmit={handleClose} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Closure Notes & Administrative Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={closeRemarks}
                    onChange={(e) => setCloseRemarks(e.target.value)}
                    placeholder="e.g. Field resolution verified on site and approved by municipal inspector. Complaint formally closed."
                    className="w-full bg-background border border-border rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Closing this complaint marks it as completed in municipal records and notifies the citizen and assigned officer.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Close Complaint</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
  );
}
