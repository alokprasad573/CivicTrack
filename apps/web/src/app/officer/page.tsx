"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import { CATEGORY_COLORS } from "../../lib/ola-maps-config";
import { StatusBadge } from "../../components/ui/status-badge";
import { PriorityBadge } from "../../components/ui/priority-badge";
import { useToast } from "../../components/ui/toast-context";
import { useRealtimeComplaints } from "../../hooks/use-realtime-complaints";
import {
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  Navigation,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Filter,
  Upload,
  Camera,
  ImageIcon,
} from "lucide-react";

interface UploadedResolutionPhoto {
  file: File;
  previewUrl: string;
  objectKey?: string;
  isUploading: boolean;
  error?: string;
}

export default function OfficerDashboardPage() {
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [scopeFilter, setScopeFilter] = useState<"ME" | "DEPT">("ME");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution modal state
  const [resolveModalComplaint, setResolveModalComplaint] = useState<any | null>(null);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [resolutionPhotos, setResolutionPhotos] = useState<UploadedResolutionPhoto[]>([]);
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
      const res = await fetch(`/api/v1/complaints?${params.toString()}`, {
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

  // Real-time live queue and task assignment updates
  useRealtimeComplaints({
    onAssigned: (assignment) => {
      fetchQueue();
      toast.info("New Task Assigned", `Complaint #${assignment.referenceNumber} has been assigned.`);
    },
    onStatusUpdated: (update) => {
      setComplaints((prev) =>
        prev.map((c) =>
          (c._id || c.id) === update.complaintId
            ? { ...c, status: update.status }
            : c
        )
      );
    },
    onReconnect: () => {
      fetchQueue();
    },
  });

  // Start work quick action
  const handleStartWork = async (complaintId: string) => {
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/start-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ remarks: "Field officer acknowledged issue and began on-site investigation." }),
      });

      if (res.ok) {
        toast.success("Work Started", "Task has been moved to In Progress.");
        fetchQueue();
      } else {
        const errJson = await res.json();
        toast.error("Action Failed", errJson.error?.message || "Failed to start work");
      }
    } catch {
      toast.error("Network Error", "Network error starting work");
    }
  };

  const handleResolutionPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const complaintId = resolveModalComplaint?._id || resolveModalComplaint?.id;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setResolutionError(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const newPhoto: UploadedResolutionPhoto = {
        file,
        previewUrl,
        isUploading: true,
      };

      setResolutionPhotos((prev) => [...prev, newPhoto]);

      let uploadedKey: string | null = null;
      let uploadError: string | null = null;

      // Strategy 1: Attempt S3 Pre-signed Upload
      try {
        const intentRes = await fetch("/api/v1/storage/upload-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            folder: "resolved",
            complaintId,
            files: [
              {
                filename: file.name,
                contentType: file.type || "image/jpeg",
                size: file.size,
              },
            ],
          }),
        });

        if (intentRes.ok) {
          const intentJson = await intentRes.json();
          const uploadItem = intentJson.data?.uploads?.[0] || intentJson.data?.uploadIntents?.[0];
          if (uploadItem?.uploadUrl) {
            const putRes = await fetch(uploadItem.uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Type": file.type || "image/jpeg",
                ...(uploadItem.headers || {}),
              },
              body: file,
            });

            if (putRes.ok) {
              uploadedKey = uploadItem.objectKey;
            } else {
              throw new Error(`Direct S3 upload rejected with status ${putRes.status}`);
            }
          }
        }
      } catch (presignedErr: any) {
        console.warn("Direct S3 PUT failed, falling back to server multipart upload:", presignedErr?.message);
      }

      // Strategy 2: Fallback to Server Multipart Upload (Server -> S3, zero browser CORS issue)
      if (!uploadedKey) {
        try {
          const formData = new FormData();
          formData.append("evidenceImages", file);
          formData.append("folder", "resolved");
          if (complaintId) {
            formData.append("complaintId", complaintId);
          }

          const uploadRes = await fetch("/api/v1/storage/upload", {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          if (uploadRes.ok) {
            const uploadJson = await uploadRes.json();
            const item = uploadJson.data?.uploads?.[0];
            if (item?.objectKey || item?.key) {
              uploadedKey = item.objectKey || item.key;
            } else {
              throw new Error("Server upload succeeded but objectKey missing in response");
            }
          } else {
            const errJson = await uploadRes.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `Upload failed (${uploadRes.status})`);
          }
        } catch (fallbackErr: any) {
          uploadError = fallbackErr?.message || "Photo upload failed";
        }
      }

      if (uploadedKey) {
        setResolutionPhotos((prev) =>
          prev.map((p) =>
            p.previewUrl === previewUrl
              ? { ...p, isUploading: false, objectKey: uploadedKey! }
              : p
          )
        );
      } else {
        setResolutionPhotos((prev) =>
          prev.map((p) =>
            p.previewUrl === previewUrl
              ? { ...p, isUploading: false, error: uploadError || "Upload failed" }
              : p
          )
        );
      }
    }
  };

  const removeResolutionPhoto = (index: number) => {
    setResolutionPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit resolution handler
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolutionError(null);

    if (!resolveModalComplaint) return;
    if (resolutionRemarks.trim().length < 10) {
      setResolutionError("Resolution remarks must be at least 10 characters detailing repair work.");
      return;
    }

    if (resolutionPhotos.some((p) => p.isUploading)) {
      setResolutionError("Please wait for all resolution photos to finish uploading.");
      return;
    }

    const failedPhotos = resolutionPhotos.filter((p) => p.error || !p.objectKey);
    if (resolutionPhotos.length > 0 && failedPhotos.length > 0) {
      setResolutionError("One or more photos failed to upload. Please remove failed photos or re-upload before submitting.");
      return;
    }

    const uploadedEvidence = resolutionPhotos
      .filter((p) => p.objectKey)
      .map((p) => ({
        objectKey: p.objectKey!,
        key: p.objectKey!,
        contentType: p.file.type || "image/jpeg",
        size: p.file.size,
        originalName: p.file.name,
      }));

    setIsSubmittingResolution(true);

    try {
      const res = await fetch(`/api/v1/complaints/${resolveModalComplaint._id || resolveModalComplaint.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          remarks: resolutionRemarks.trim(),
          evidence: uploadedEvidence,
          resolutionEvidence: uploadedEvidence,
        }),
      });

      if (res.ok) {
        setResolveModalComplaint(null);
        setResolutionRemarks("");
        setResolutionPhotos([]);
        fetchQueue();
      } else {
        const errJson = await res.json();
        setResolutionError(errJson.error?.message || "Failed to submit resolution");
      }
    } catch (err: any) {
      setResolutionError(err.message || "Failed to resolve complaint");
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // Compute stat counts
  const assignedCount = complaints.filter((c) => c.status === ComplaintStatus.ASSIGNED).length;
  const inProgressCount = complaints.filter((c) => c.status === ComplaintStatus.IN_PROGRESS).length;
  const resolvedCount = complaints.filter((c) => [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED].includes(c.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Assigned Field Tasks
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Site inspections, investigation work, and verified resolution actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-xs shadow-hairline">
            <Wrench className="w-3.5 h-3.5" />
            <span>{total} Assigned Tasks</span>
          </span>
        </div>
      </div>

        {/* Metric Cards inspired by PolicyOracle */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Awaiting Investigation</span>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 tabular-nums">
                {assignedCount}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Work in Progress</span>
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 mt-1 tabular-nums">
                {inProgressCount}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Wrench className="w-6 h-6" />
            </div>
          </div>

          <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">Resolved by Team</span>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 tabular-nums">
                {resolvedCount}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Queue Scope Tabs & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200 w-fit">
            <button
              type="button"
              onClick={() => {
                setScopeFilter("ME");
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                scopeFilter === "ME"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
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
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                scopeFilter === "DEPT"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Department Queue
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition"
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
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Loading assigned queue...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-700 bg-rose-50 border border-rose-200 rounded-3xl max-w-lg mx-auto">
            <AlertCircle className="w-7 h-7 mx-auto mb-2 text-rose-600" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <Wrench className="w-10 h-10 stroke-1 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No complaints in queue</p>
            <p className="text-xs text-slate-500">
              {scopeFilter === "ME"
                ? "You have no outstanding assigned complaints."
                : "Your department currently has no assigned incidents."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {complaints.map((item) => {
              const categoryColor = CATEGORY_COLORS[item.category as ComplaintCategory] || "#2563eb";
              const coords = item.location?.coordinates || [77.5946, 12.9716];
              const isOverdue =
                item.dueAt &&
                new Date(item.dueAt) < new Date() &&
                ![ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED].includes(item.status);

              return (
                <div
                  key={item._id}
                  className="p-6 rounded-3xl border border-slate-200 bg-white flex flex-col justify-between hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/5 transition-all shadow-sm space-y-4"
                >
                  <div className="space-y-2">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                          {item.referenceNumber}
                        </span>
                        {item.priority && <PriorityBadge priority={item.priority} />}
                        {isOverdue && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                            OVERDUE
                          </span>
                        )}
                        {item.evidence && item.evidence.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold flex items-center gap-1" title="Citizen Evidence Attached">
                            <ImageIcon className="w-3 h-3" />
                            {item.evidence.length}
                          </span>
                        )}
                        {item.resolutionEvidence && item.resolutionEvidence.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1" title="Officer Resolution Proof Attached">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {item.resolutionEvidence.length} Proof
                          </span>
                        )}
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    {/* Metadata details */}
                    <div className="border border-slate-100 rounded-2xl p-3 text-xs space-y-1.5 bg-slate-50">
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{item.address}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: categoryColor }}
                        />
                        <span className="truncate">{item.category?.replace(/_/g, " ")}</span>
                        {item.dueAt && (
                          <span className="ml-auto text-[10px] text-amber-700 font-semibold">
                            Due: {new Date(item.dueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/officer/complaints/${item._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-sm"
                      title="Launch GPS Turn-by-Turn Navigation to this location"
                    >
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      <span>Navigate</span>
                    </Link>

                    <div className="flex items-center gap-2">
                      {item.status === ComplaintStatus.ASSIGNED && (
                        <button
                          type="button"
                          onClick={() => handleStartWork(item._id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition active:scale-95"
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition active:scale-95"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolve</span>
                        </button>
                      )}

                      <Link
                        href={`/officer/complaints/${item._id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
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
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Submit Field Resolution</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setResolveModalComplaint(null)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Resolving incident <span className="font-bold text-blue-600">{resolveModalComplaint.referenceNumber}</span>. Enter site repair notes for citizen verification.
              </p>

              {resolutionError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {resolutionError}
                </div>
              )}

              <form onSubmit={handleResolveSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Resolution Notes & Actions Taken *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={resolutionRemarks}
                    onChange={(e) => setResolutionRemarks(e.target.value)}
                    placeholder="e.g. Cleared drainage obstruction and replaced damaged concrete slab. Flow restored."
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs outline-none bg-slate-50 text-slate-900 focus:ring-2 focus:ring-blue-500 resize-y transition"
                  />
                </div>

                {/* Upload Resolution Photos */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Attach Repair Photo Evidence (Proof of Work)
                  </label>
                  <label className="border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition">
                    <Camera className="w-5 h-5 text-slate-400" />
                    <span className="text-xs font-semibold text-blue-600">Upload site repair photos</span>
                    <span className="text-[10px] text-slate-400">PNG, JPG, or WEBP up to 10MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleResolutionPhotoSelect}
                      className="hidden"
                    />
                  </label>

                  {resolutionPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {resolutionPhotos.map((photo, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group"
                        >
                          <img
                            src={photo.previewUrl}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          {photo.isUploading ? (
                            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white">
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                          ) : photo.error ? (
                            <div className="absolute inset-0 bg-rose-900/80 flex flex-col items-center justify-center p-1 text-center">
                              <AlertCircle className="w-4 h-4 text-white mb-0.5" />
                              <span className="text-[9px] text-white font-medium leading-tight line-clamp-2">Upload failed</span>
                              <button
                                type="button"
                                onClick={() => removeResolutionPhoto(idx)}
                                className="mt-1 p-0.5 rounded-full bg-white/20 hover:bg-rose-600 text-white transition"
                                title="Remove photo"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-bold flex items-center gap-0.5 shadow-sm">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>Ready</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeResolutionPhoto(idx)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResolveModalComplaint(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingResolution || !resolutionRemarks.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition disabled:opacity-40 active:scale-[0.98]"
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
  );
}
