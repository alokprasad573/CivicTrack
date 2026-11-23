"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import { STATUS_COLORS, CATEGORY_COLORS } from "../../../../lib/ola-maps-config";
import { ComplaintStatusTracker } from "../../../../components/complaints/complaint-status-tracker";
import { OfficerNavigation } from "../../../../components/maps/officer-navigation";
import {
  EvidenceLightbox,
  EvidenceImageItem,
} from "../../../../components/evidence/evidence-lightbox";
import { useComplaintDetailRealtime } from "../../../../hooks/use-complaint-detail-realtime";

const OlaMap = dynamic(
  () => import("../../../../components/maps/ola-map").then((mod) => mod.OlaMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[280px] rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
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
  ExternalLink,
  ZoomIn,
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

  // Live Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [mapInstance, setMapInstance] = useState<any | null>(null);

  // Resolution modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolutionRemarks, setResolutionRemarks] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  // Evidence Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const refreshImageUrl = async (key: string) => {
    try {
      const res = await fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(key)}`, {
        credentials: "include",
      });
      if (res.ok) {
        const viewJson = await res.json();
        if (viewJson.success && viewJson.data?.viewUrl) {
          setViewUrls((prev) => ({ ...prev, [key]: viewJson.data.viewUrl }));
        }
      }
    } catch {
      // Ignore background refresh failure
    }
  };

  const loadDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}`, {
        credentials: "include",
      });
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
            fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(key)}`, {
              credentials: "include",
            })
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

  const handleStartWork = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/start-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      if (file.size > 10 * 1024 * 1024) {
        setActionError(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      const newPhoto: UploadedPhoto = {
        file,
        previewUrl,
        isUploading: true,
      };

      setPhotos((prev) => [...prev, newPhoto]);

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
              throw new Error(`S3 direct upload rejected with status ${putRes.status}`);
            }
          }
        }
      } catch (presignedErr: any) {
        // Log S3 direct PUT failure and fall back seamlessly to server multipart proxy
        console.warn("Direct S3 PUT failed, falling back to server multipart upload:", presignedErr?.message);
      }

      // Strategy 2: Fallback to Server Multipart Upload (Server -> S3, zero browser CORS issue)
      if (!uploadedKey) {
        try {
          const formData = new FormData();
          formData.append("evidenceImages", file);
          formData.append("folder", "resolved");
          formData.append("complaintId", complaintId);

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
        setPhotos((prev) =>
          prev.map((p) =>
            p.previewUrl === previewUrl
              ? { ...p, isUploading: false, objectKey: uploadedKey! }
              : p
          )
        );
      } else {
        setPhotos((prev) =>
          prev.map((p) =>
            p.previewUrl === previewUrl
              ? { ...p, isUploading: false, error: uploadError || "Upload failed" }
              : p
          )
        );
      }
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (resolutionRemarks.trim().length < 10) {
      setActionError("Resolution remarks must be at least 10 characters detailing repair work.");
      return;
    }

    if (photos.some((p) => p.isUploading)) {
      setActionError("Please wait for all resolution photos to finish uploading.");
      return;
    }

    const failedPhotos = photos.filter((p) => p.error || !p.objectKey);
    if (photos.length > 0 && failedPhotos.length > 0) {
      setActionError("One or more photos failed to upload. Please remove failed photos or re-upload before submitting.");
      return;
    }

    const uploadedEvidence = photos
      .filter((p) => p.objectKey)
      .map((p) => ({
        objectKey: p.objectKey!,
        key: p.objectKey!,
        contentType: p.file.type || "image/jpeg",
        size: p.file.size,
        originalName: p.file.name,
      }));

    setActionLoading(true);

    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/resolve`, {
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
        setIsResolveModalOpen(false);
        setPhotos([]);
        setResolutionRemarks("");
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
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-medium">Loading field task details...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="p-8 text-center text-destructive bg-destructive/10 border border-destructive/20 rounded-3xl max-w-lg mx-auto">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
        <h2 className="text-base font-bold mb-1">Task Not Found</h2>
        <p className="text-xs mb-4 text-muted-foreground">{error || "Unable to retrieve task record."}</p>
        <Link
          href="/officer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card text-foreground border border-border hover:bg-secondary text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Work Queue</span>
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_COLORS[complaint.status as ComplaintStatus] || {
    label: complaint.status,
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  };

  const coords = complaint.location?.coordinates || [77.5946, 12.9716];

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}&travelmode=driving`;

  const citizenEvidenceList: EvidenceImageItem[] = (complaint?.evidence || []).map((e: any, idx: number) => {
    const key = e.objectKey || e.key || `ev-${idx}`;
    return {
      key,
      objectKey: key,
      url: (key ? viewUrls[key] : null) || e.url || "",
      originalName: e.filename || e.originalName || "Citizen Evidence Photo",
      uploadedAt: e.uploadedAt,
    };
  });

  const resolutionEvidenceList: EvidenceImageItem[] = (complaint?.resolutionEvidence || []).map((e: any, idx: number) => {
    const key = e.objectKey || e.key || `res-${idx}`;
    return {
      key,
      objectKey: key,
      url: (key ? viewUrls[key] : null) || e.url || "",
      originalName: e.filename || e.originalName || "Officer Resolution Proof Photo",
      uploadedAt: e.uploadedAt,
    };
  });

  const allEvidenceItems: EvidenceImageItem[] = [...citizenEvidenceList, ...resolutionEvidenceList];

  return (
    <div className="flex flex-col gap-6">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/officer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assigned Queue</span>
          </Link>

          {/* Turn-by-Turn GPS Navigation CTA */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNavigating(!isNavigating)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition active:scale-95"
            >
              <Navigation className="w-4 h-4" />
              <span>{isNavigating ? "Hide In-App Navigation" : "Start Turn-by-Turn Navigation"}</span>
            </button>

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
              title="Open directly in Google Maps"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Top Header Card inspired by PolicyOracle */}
        <div className="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-xl shadow-blue-500/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                {complaint.referenceNumber}
              </span>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-bold border capitalize ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
              >
                {complaint.status.replace(/_/g, " ")}
              </span>
              <span
                className={`px-3 py-1 rounded-xl text-xs font-bold ${
                  complaint.priority === ComplaintPriority.CRITICAL
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : complaint.priority === ComplaintPriority.HIGH
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {complaint.priority} PRIORITY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {complaint.title}
            </h1>
            <p className="text-xs text-slate-500 flex flex-wrap items-center gap-4">
              <span>Reported on {new Date(complaint.createdAt).toLocaleDateString()}</span>
              {complaint.dueAt && (
                <span className="text-amber-600 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Due by {new Date(complaint.dueAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex items-center gap-2.5">
            {complaint.status === ComplaintStatus.ASSIGNED && (
              <button
                type="button"
                onClick={handleStartWork}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition active:scale-[0.98] disabled:opacity-50"
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition active:scale-[0.98]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Resolution</span>
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* 2-Column Incident Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Incident Location, Turn-by-Turn Navigation HUD, Evidence */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Navigation HUD & Interactive Map */}
            <div className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>Incident Location & Field Navigation</span>
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                    [{coords[0].toFixed(4)}, {coords[1].toFixed(4)}]
                  </span>
                </div>
              </div>

              {/* In-app Turn-by-Turn HUD */}
              {isNavigating && (
                <OfficerNavigation
                  mapInstance={mapInstance}
                  destinationCoordinates={[coords[0], coords[1]]}
                  destinationAddress={complaint.address}
                  referenceNumber={complaint.referenceNumber}
                  complaintTitle={complaint.title}
                  onClose={() => setIsNavigating(false)}
                />
              )}

              {/* Map viewport */}
              <div className={`${isNavigating ? "h-[360px]" : "h-64"} rounded-2xl overflow-hidden border border-slate-200 transition-all`}>
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
                  onMapLoaded={setMapInstance}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <p className="truncate flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{complaint.address}</span>
                </p>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-semibold hover:underline shrink-0 flex items-center gap-1"
                >
                  <span>Open Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Citizen Report Description */}
            <div className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Citizen Description & Assessment</span>
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {complaint.description}
              </p>
            </div>

            {/* Citizen Photo Evidence Gallery */}
            <div className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <span>Citizen Photo Evidence</span>
                </h3>
                {citizenEvidenceList.length > 0 && (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    {citizenEvidenceList.length} photo{citizenEvidenceList.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {citizenEvidenceList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No evidence photos attached by citizen.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {citizenEvidenceList.map((item, idx) => (
                    <div
                      key={item.key || idx}
                      onClick={() => {
                        setActiveImageIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className="aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center relative group shadow-sm cursor-pointer hover:border-blue-400 transition"
                      title="Click to zoom photo in Lightbox"
                    >
                      {item.url ? (
                        <>
                          <img
                            src={item.url}
                            alt={item.originalName || "Citizen Evidence"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => {
                              const k = item.objectKey || item.key;
                              if (k) refreshImageUrl(k);
                            }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ZoomIn className="w-5 h-5" />
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-slate-400">Loading preview...</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Officer Resolution Photo Evidence */}
            {(resolutionEvidenceList.length > 0 || complaint.resolvedAt || complaint.status === ComplaintStatus.IN_PROGRESS) && (
              <div className="p-5 sm:p-6 rounded-3xl border border-emerald-200 bg-white shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Officer Resolution Proof Evidence ({resolutionEvidenceList.length})</span>
                  </h3>
                  {resolutionEvidenceList.length > 0 ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified Work Proof ({resolutionEvidenceList.length})
                    </span>
                  ) : complaint.status === ComplaintStatus.IN_PROGRESS ? (
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setIsResolveModalOpen(true);
                      }}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-200 transition"
                    >
                      + Attach Resolution Photos
                    </button>
                  ) : null}
                </div>

                {resolutionEvidenceList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No resolution photos attached by field officer.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {resolutionEvidenceList.map((item, idx) => (
                      <div
                        key={item.key || idx}
                        onClick={() => {
                          setActiveImageIndex(citizenEvidenceList.length + idx);
                          setLightboxOpen(true);
                        }}
                        className="aspect-video rounded-2xl overflow-hidden border border-emerald-200 bg-slate-50 flex items-center justify-center relative group shadow-sm cursor-pointer hover:border-emerald-500 transition"
                        title="Click to zoom resolution proof in Lightbox"
                      >
                        {item.url ? (
                          <>
                            <img
                              src={item.url}
                              alt="Officer Resolution Proof"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={() => {
                                const k = item.objectKey || item.key;
                                if (k) refreshImageUrl(k);
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn className="w-5 h-5" />
                            </div>
                          </>
                        ) : (
                          <div className="text-[10px] text-slate-400">Loading preview...</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Resolution Record (if completed) */}
            {complaint.resolvedAt && (
              <div className="p-5 sm:p-6 rounded-3xl border border-emerald-200 bg-emerald-50/50 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Resolution Record</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {complaint.resolutionRemarks || "Field resolution completed by assigned municipal response officer."}
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
                const targetIdx = allEvidenceItems.findIndex((it) => it.url === url);
                if (targetIdx >= 0) {
                  setActiveImageIndex(targetIdx);
                  setLightboxOpen(true);
                } else {
                  window.open(url, "_blank");
                }
              }}
            />
          </div>
        </div>

        {/* Resolution Submission Modal */}
        {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Submit On-Site Resolution & Evidence</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResolveSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Field Resolution Remarks *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Describe specific work performed (e.g. Cleared clogged storm drain, replaced broken streetlight fixture with LED unit)..."
                    value={resolutionRemarks}
                    onChange={(e) => setResolutionRemarks(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <p className="text-[10px] text-slate-400">Min 10 characters.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Upload Repair Evidence Photos
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoSelect}
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-bold hover:file:bg-blue-700 cursor-pointer"
                  />

                  {photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {photos.map((p, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100 group"
                        >
                          <img src={p.previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                          {p.isUploading ? (
                            <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            </div>
                          ) : p.error ? (
                            <div className="absolute inset-0 bg-rose-900/80 flex flex-col items-center justify-center p-1 text-center">
                              <AlertCircle className="w-4 h-4 text-white mb-0.5" />
                              <span className="text-[9px] text-white font-medium leading-tight line-clamp-2">Upload failed</span>
                              <button
                                type="button"
                                onClick={() => handleRemovePhoto(idx)}
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
                                onClick={() => handleRemovePhoto(idx)}
                                className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/70 hover:bg-rose-600 text-white transition shadow-sm"
                                title="Remove photo"
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
                    onClick={() => setIsResolveModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 transition active:scale-[0.98]"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Resolution</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Evidence Fullscreen Lightbox */}
        <EvidenceLightbox
          images={allEvidenceItems}
          initialIndex={activeImageIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </div>
  );
}
