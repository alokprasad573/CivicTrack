"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import { OfficerShell } from "../../../../components/layout/officer-shell";
import { STATUS_COLORS, CATEGORY_COLORS } from "../../../../lib/ola-maps-config";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { PriorityBadge } from "../../../../components/ui/priority-badge";

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
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Navigation,
  Loader2,
  Play,
  UploadCloud,
  X,
  ImageIcon,
  Send,
  AlertCircle,
} from "lucide-react";

interface UploadedPhoto {
  file: File;
  previewUrl: string;
  objectKey?: string;
  isUploading: boolean;
  error?: string;
}

export default function OfficerComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams.id;

  const [complaint, setComplaint] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Workflow actions
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Resolution modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const loadDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Complaint not found" : "Failed to load details");
      }
      const json = await res.json();
      if (json.success && json.data) {
        const comp = json.data.complaint || json.data;
        const hist = json.data.history || [];
        setComplaint(comp);
        setHistory(hist);

        // Fetch or use pre-signed URLs for citizen and resolution evidence
        const initialUrls: Record<string, string> = {};
        const allEvidence = [...(comp.evidence || []), ...(comp.resolutionEvidence || [])];
        for (const item of allEvidence) {
          const key = item.objectKey || item.key;
          if (item.url && key) {
            initialUrls[key] = item.url;
          } else if (key) {
            fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(key)}`)
              .then((r) => r.json())
              .then((viewJson) => {
                if (viewJson.success && viewJson.data?.viewUrl) {
                  setViewUrls((prev) => ({
                    ...prev,
                    [key]: viewJson.data.viewUrl,
                  }));
                }
              })
              .catch(() => {});
          }
        }
        setViewUrls((prev) => ({ ...prev, ...initialUrls }));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load incident");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [complaintId]);

  const handleStartWork = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/start-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Field officer arrived at site and commenced work." }),
      });
      if (res.ok) {
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to start work");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to start work");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);

    for (const file of files) {
      const previewUrl = URL.createObjectURL(file);
      const newPhoto: UploadedPhoto = {
        file,
        previewUrl,
        isUploading: true,
      };

      setPhotos((prev) => [...prev, newPhoto]);

      try {
        const intentRes = await fetch("/api/v1/storage/upload-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: [{ contentType: file.type || "image/jpeg", size: file.size }],
          }),
        });

        if (!intentRes.ok) throw new Error("Could not get upload credentials");
        const intentJson = await intentRes.json();
        const uploadItem = intentJson.data?.uploadIntents?.[0];
        if (!uploadItem) throw new Error("Upload intent missing");

        await fetch(uploadItem.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });

        setPhotos((prev) =>
          prev.map((p) =>
            p.previewUrl === previewUrl
              ? { ...p, isUploading: false, objectKey: uploadItem.objectKey }
              : p
          )
        );
      } catch (err: any) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.previewUrl === previewUrl
              ? { ...p, isUploading: false, error: err.message || "Upload failed" }
              : p
          )
        );
      }
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resolutionRemarks.trim().length < 10) {
      setActionError("Resolution remarks must be at least 10 characters detailing repair work.");
      return;
    }

    const uploadedEvidence = photos
      .filter((p) => p.objectKey)
      .map((p) => ({
        objectKey: p.objectKey!,
        contentType: p.file.type || "image/jpeg",
        size: p.file.size,
      }));

    setActionLoading(true);
    setActionError(null);

    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remarks: resolutionRemarks.trim(),
          evidence: uploadedEvidence,
        }),
      });

      if (res.ok) {
        setIsResolveModalOpen(false);
        loadDetails();
      } else {
        const errJson = await res.json();
        setActionError(errJson.error?.message || "Failed to resolve complaint");
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to submit resolution");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <OfficerShell>
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading field incident details...</p>
        </div>
      </OfficerShell>
    );
  }

  if (error || !complaint) {
    return (
      <OfficerShell>
        <div className="p-8 text-center text-destructive bg-destructive/10 border border-destructive/20 rounded-2xl max-w-lg mx-auto">
          <AlertCircle className="w-10 h-10 mx-auto mb-3" />
          <h2 className="text-base font-bold mb-1">Incident Not Found</h2>
          <p className="text-xs mb-4">{error || "Unable to retrieve complaint record."}</p>
          <Link
            href="/officer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Work Queue</span>
          </Link>
        </div>
      </OfficerShell>
    );
  }

  const statusConfig = STATUS_COLORS[complaint.status as ComplaintStatus] || {
    label: complaint.status,
    bg: "bg-secondary",
    text: "text-foreground",
    border: "border-border",
  };

  const categoryConfig = CATEGORY_COLORS[complaint.category as ComplaintCategory] || {
    label: complaint.category,
    color: "#14b8a6",
  };

  const coords = complaint.location?.coordinates || [77.5946, 12.9716];

  return (
    <OfficerShell>
      <div className="flex flex-col gap-6">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between">
          <Link
            href="/officer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assigned Queue</span>
          </Link>

          {/* Turn-by-Turn GPS Navigation CTA */}
          <Link
            href={`/map?lng=${coords[0]}&lat=${coords[1]}&ref=${complaint.referenceNumber}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
          >
            <Navigation className="w-4 h-4" />
            <span>Start Field Turn-by-Turn Navigation</span>
          </Link>
        </div>

        {/* Top Header Card */}
        <div className="p-6 rounded-2xl border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-sm font-extrabold text-foreground bg-secondary px-2.5 py-1 rounded-lg border border-border">
                {complaint.referenceNumber}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
              >
                {complaint.status.replace(/_/g, " ")}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                  complaint.priority === ComplaintPriority.CRITICAL
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : complaint.priority === ComplaintPriority.HIGH
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {complaint.priority} PRIORITY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">{complaint.title}</h1>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
              <span>Reported on {new Date(complaint.createdAt).toLocaleDateString()}</span>
              {complaint.dueAt && (
                <span className="text-amber-400 font-semibold">
                  Due by {new Date(complaint.dueAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2">
            {complaint.status === ComplaintStatus.ASSIGNED && (
              <button
                type="button"
                onClick={handleStartWork}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>Start Field Work</span>
              </button>
            )}

            {complaint.status === ComplaintStatus.IN_PROGRESS && (
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setIsResolveModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-xs shadow-md hover:bg-emerald-400"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Resolution</span>
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            {actionError}
          </div>
        )}

        {/* 2-Column Incident Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Incident Location, Details, Evidence */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ola Map Location Box */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>Incident Location & Field Map</span>
                </h3>
                <span className="text-xs font-mono text-muted-foreground">
                  [{coords[0].toFixed(4)}, {coords[1].toFixed(4)}]
                </span>
              </div>

              <div className="h-64 rounded-xl overflow-hidden border border-border">
                <OlaMap
                  initialCenter={[coords[0], coords[1]]}
                  initialZoom={15}
                  complaints={[complaint]}
                />
              </div>

              <p className="text-xs text-muted-foreground">{complaint.address}</p>
            </div>

            {/* Citizen Report Description */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Citizen Description & Assessment</span>
              </h3>
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {complaint.description}
              </p>
            </div>

            {/* Evidence Gallery */}
            <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span>Citizen Photo Evidence</span>
              </h3>

              {(!complaint.evidence || complaint.evidence.length === 0) ? (
                <p className="text-xs text-muted-foreground italic">No evidence photos attached by citizen.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {complaint.evidence.map((item: any, idx: number) => {
                    const key = item.objectKey || item.key || `evidence-${idx}`;
                    const url = (key ? viewUrls[key] : null) || item.url;
                    return (
                      <div
                        key={key}
                        className="aspect-video rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center relative group"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt="Citizen Evidence"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="text-[10px] text-muted-foreground">Loading preview...</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Resolution Details (if completed) */}
            {complaint.resolvedAt && (
              <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Resolution Record</span>
                </h3>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                  {complaint.resolutionRemarks}
                </p>
                {complaint.resolutionEvidence && complaint.resolutionEvidence.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {complaint.resolutionEvidence.map((item: any, idx: number) => {
                      const key = item.objectKey || item.key || `res-${idx}`;
                      const url = (key ? viewUrls[key] : null) || item.url;
                      return (
                        <div
                          key={key}
                          className="aspect-video rounded-xl overflow-hidden border border-border bg-secondary flex items-center justify-center"
                        >
                          {url ? (
                            <img src={url} alt="Resolution Evidence" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-[10px] text-muted-foreground">Loading preview...</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Col: Chronological Audit History */}
          <div>
            <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>Audit & Status History</span>
              </h3>

              <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {history.map((h, idx) => (
                  <div key={h._id || idx} className="relative">
                    <span className="w-4 h-4 rounded-full bg-card border-2 border-primary absolute -left-6 top-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={h.toStatus} />
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{h.remarks}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Resolution Submission Modal */}
        {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Submit On-Site Resolution & Evidence</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Field Resolution Remarks *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe specific work performed (e.g. Cleared clogged storm drain, replaced broken streetlight fixture with LED unit)..."
                    value={resolutionRemarks}
                    onChange={(e) => setResolutionRemarks(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Min 10 characters.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Upload Repair Evidence Photos
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelect}
                    className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:font-semibold"
                  />

                  {photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {photos.map((p, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg overflow-hidden border border-border relative bg-secondary"
                        >
                          <img src={p.previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                          {p.isUploading && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsResolveModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Resolution</span>
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
