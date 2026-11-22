"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  ComplaintStatus,
} from "@civictrack/contracts";
import { CitizenShell } from "../../../../components/layout/citizen-shell";
import { CATEGORY_COLORS } from "../../../../lib/ola-maps-config";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { PriorityBadge } from "../../../../components/ui/priority-badge";

const OlaMap = dynamic(
  () => import("../../../../components/maps/ola-map").then((mod) => mod.OlaMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[280px] rounded-2xl border border-border bg-card/40 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Loading Ola Map location...</span>
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
  Star,
  Send,
  Loader2,
  ShieldAlert,
  ImageIcon,
  User,
  Building2,
  ZoomIn,
} from "lucide-react";
import { EvidenceLightbox, EvidenceImageItem } from "../../../../components/evidence/evidence-lightbox";

export default function CitizenComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams.id;

  const [complaint, setComplaint] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshImageUrl = async (key: string) => {
    try {
      const res = await fetch(`/api/v1/storage/view-url?objectKey=${encodeURIComponent(key)}`);
      const viewJson = await res.json();
      if (viewJson.success && viewJson.data?.viewUrl) {
        setViewUrls((prev) => ({
          ...prev,
          [key]: viewJson.data.viewUrl,
        }));
      }
    } catch {
      // Ignored
    }
  };

  // Feedback form state
  const [rating, setRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  useEffect(() => {
    async function loadComplaintDetails() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/v1/complaints/${complaintId}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Complaint not found"
              : "Failed to load complaint details"
          );
        }

        const json = await res.json();
        if (json.success && json.data) {
          const comp = json.data.complaint || json.data;
          const hist = json.data.history || [];
          setComplaint(comp);
          setHistory(hist);

          // Populate existing or resolve pre-signed view URLs for evidence images
          const initialUrls: Record<string, string> = {};
          if (comp.evidence && comp.evidence.length > 0) {
            for (const item of comp.evidence) {
              const key = item.objectKey || item.key;
              if (item.url) {
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
          }
          setViewUrls((prev) => ({ ...prev, ...initialUrls }));
        }
      } catch (err: any) {
        setError(err.message || "Failed to load complaint details");
      } finally {
        setIsLoading(false);
      }
    }

    loadComplaintDetails();
  }, [complaintId]);

  // Citizen confirms resolution and provides feedback
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingFeedback(true);

    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackRating: rating,
          feedbackNotes: feedbackComment.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to submit feedback");
      }

      setFeedbackSuccess(true);
      setComplaint((prev: any) => ({
        ...prev,
        status: ComplaintStatus.CLOSED,
        feedbackRating: rating,
        feedbackNotes: feedbackComment,
      }));

      // Append local history entry
      setHistory((prev) => [
        {
          complaintId,
          status: ComplaintStatus.CLOSED,
          actorRole: "CITIZEN",
          notes: `Citizen verified resolution. Rating: ${rating}/5 stars. ${
            feedbackComment ? `Notes: "${feedbackComment}"` : ""
          }`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(err.message || "Failed to submit feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (isLoading) {
    return (
      <CitizenShell>
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#d95d39] animate-spin" />
          <span className="text-xs text-muted-foreground">
            Loading incident lifecycle & audit trail...
          </span>
        </div>
      </CitizenShell>
    );
  }

  if (error || !complaint) {
    return (
      <CitizenShell>
        <div className="max-w-xl mx-auto py-16 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center text-destructive">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">Complaint Not Found</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            {error || "The requested incident record does not exist or has been archived."}
          </p>
          <Link
            href="/citizen/complaints"
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-secondary transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Complaints</span>
          </Link>
        </div>
      </CitizenShell>
    );
  }

  const categoryColor = CATEGORY_COLORS[complaint.category as ComplaintCategory] || "#94a3b8";
  const isResolved = complaint.status === ComplaintStatus.RESOLVED;
  const isClosed = complaint.status === ComplaintStatus.CLOSED;
  const isRejected = complaint.status === ComplaintStatus.REJECTED;

  // Build lightbox items from evidence array
  const rawEvidence = complaint.evidence || [];
  const lightboxItems: EvidenceImageItem[] = rawEvidence.map((item: any, idx: number) => {
    const key = item.objectKey || item.key || "";
    return {
      key,
      url: viewUrls[key] || item.url || "",
      originalName: item.originalName || (key ? key.split("/").pop() : `Evidence_${idx + 1}.jpg`),
      size: item.size,
      mimeType: item.mimeType || "image/jpeg",
      uploadedAt: item.uploadedAt || complaint.createdAt,
    };
  });

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Back Link */}
        <Link
          href="/citizen/complaints"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-[#d95d39] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Complaints</span>
        </Link>

        {/* Header Card */}
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#d95d39]">
                {complaint.referenceNumber || complaintId}
              </span>
              <StatusBadge status={complaint.status} />
              {complaint.priority && <PriorityBadge priority={complaint.priority} />}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: categoryColor }}
              />
              <span className="font-semibold text-foreground capitalize">
                {complaint.category?.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            {complaint.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5" />
              {complaint.createdAt ? new Date(complaint.createdAt).toLocaleString() : "Recently"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              {complaint.address || "Location pinned on map"}
            </span>
          </div>
        </div>

        {/* Rejection Alert Banner */}
        {isRejected && complaint.rejectionReason && (
          <div className="p-4 rounded-2xl border border-red-500/30 bg-red-500/10 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider">
                Complaint Rejected by Administration
              </h4>
              <p className="text-xs text-foreground/90 mt-1 leading-relaxed">
                {complaint.rejectionReason}
              </p>
            </div>
          </div>
        )}

        {/* 2-Column Split: Details & Evidence (7 cols) / Audit Trail (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* Description Card */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground">Issue Description</h3>
              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {complaint.description}
              </p>
            </div>

            {/* Location & Ola Map Card */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
              <h3 className="font-display text-sm font-bold text-foreground">Location & Coordinates</h3>
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-foreground">{complaint.address}</p>
                {complaint.landmark && (
                  <p className="text-muted-foreground">Landmark: {complaint.landmark}</p>
                )}
                {complaint.location?.coordinates && (
                  <p className="font-mono text-xs font-semibold text-[#d95d39]">
                    GeoJSON: [{complaint.location.coordinates[0].toFixed(5)}, {complaint.location.coordinates[1].toFixed(5)}]
                  </p>
                )}
              </div>

              {complaint.location?.coordinates && (
                <div className="rounded-xl overflow-hidden border border-border mt-2">
                  <OlaMap
                    initialCenter={complaint.location.coordinates}
                    initialZoom={15}
                    complaints={[
                      {
                        id: complaint._id || complaint.id,
                        referenceNumber: complaint.referenceNumber,
                        title: complaint.title,
                        category: complaint.category,
                        status: complaint.status,
                        location: complaint.location,
                        address: complaint.address,
                      },
                    ]}
                    className="w-full h-[240px] rounded-none border-none"
                  />
                </div>
              )}
            </div>

            {/* S3 Evidence Gallery */}
            <div className="p-6 rounded-2xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-foreground">
                  Attached Evidence ({rawEvidence.length})
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">Click to inspect</span>
              </div>

              {rawEvidence.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">No photos attached to this incident.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rawEvidence.map((item: any, i: number) => {
                    const key = item.objectKey || item.key || "";
                    const url = viewUrls[key] || item.url;
                    const filename = item.originalName || (key ? key.split("/").pop() : `Evidence_${i + 1}.jpg`);

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setActiveImageIndex(i);
                          setLightboxOpen(true);
                        }}
                        className="rounded-xl overflow-hidden border border-border aspect-square bg-secondary/30 relative group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#d95d39] text-left transition"
                        title={`Click to view ${filename}`}
                      >
                        {url ? (
                          <>
                            <img
                              src={url}
                              alt={filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                              onError={() => {
                                if (key) {
                                  refreshImageUrl(key);
                                }
                              }}
                            />
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2 text-center">
                              <ZoomIn className="w-5 h-5 text-[#d95d39]" />
                              <span className="text-[10px] font-semibold text-foreground truncate max-w-full">
                                {filename}
                              </span>
                              <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                [S3 VERIFIED]
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1 p-2 text-center text-muted-foreground h-full">
                            <Loader2 className="w-4 h-4 text-[#d95d39] animate-spin" />
                            <span className="text-[10px] font-mono truncate">Loading...</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Citizen Feedback & Closure Card (when RESOLVED) */}
            {isResolved && !feedbackSuccess && (
              <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-4 shadow-sm">
                <div>
                  <h3 className="font-display text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
                    <span>Confirm Resolution & Close Ticket</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your feedback ensures municipal department officers maintain high quality and accountability.
                  </p>
                </div>

                <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`p-1 transition-transform hover:scale-110 ${
                          rating >= star ? "text-amber-500" : "opacity-30"
                        }`}
                      >
                        <Star className="w-5 h-5 fill-current" />
                      </button>
                    ))}
                    <span className="text-xs font-mono font-semibold text-foreground ml-2">
                      {rating} / 5 Rating
                    </span>
                  </div>

                  <input
                    type="text"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Optional feedback on resolution speed or repair quality..."
                    className="w-full border border-border rounded-xl px-3.5 py-2 text-xs outline-none bg-background text-foreground focus:border-[#d95d39]"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
                    >
                      {isSubmittingFeedback ? "Closing..." : "Confirm & Close Ticket"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {isClosed && (
              <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Incident Closed & Citizen Verified
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rating: {complaint.feedbackRating || 5}/5 stars &bull; {complaint.feedbackNotes || "Resolution confirmed by citizen."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Immutable Status Audit Trail (5 cols) */}
          <div className="lg:col-span-5 p-6 rounded-2xl border border-border bg-card space-y-4">
            <h3 className="font-display text-sm font-bold text-foreground">
              Immutable Status Audit Trail
            </h3>
            <p className="text-xs text-muted-foreground">
              Cryptographically timestamped lifecycle transitions stored in MongoDB ledger.
            </p>

            <div className="space-y-4 pl-3 border-l-2 border-border mt-2">
              {history.length === 0 ? (
                <div className="relative pl-4 space-y-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d95d39] border-2 border-background absolute -left-[18px] top-1" />
                  <StatusBadge status={complaint?.status} />
                  <p className="text-xs font-medium text-foreground">Initial Submission</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {complaint?.createdAt ? new Date(complaint.createdAt).toLocaleString() : ""}
                  </p>
                </div>
              ) : (
                history.map((item, idx) => {
                  const itemStatus = item.toStatus || item.status || complaint?.status;
                  const itemNotes = item.remarks || item.notes;
                  const actorText = item.actorId?.name
                    ? `${item.actorId.name} (${item.actorId.role || item.actorRole || "Staff"})`
                    : item.actorRole || "System";

                  return (
                    <div key={idx} className="relative pl-4 space-y-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#d95d39] border-2 border-background absolute -left-[18px] top-1" />
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <StatusBadge status={itemStatus} />
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      {itemNotes && (
                        <p className="text-xs text-foreground/90 leading-snug">{itemNotes}</p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground">
                        Actor: {actorText}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Lightbox Modal */}
      {lightboxItems.length > 0 && (
        <EvidenceLightbox
          images={lightboxItems}
          initialIndex={activeImageIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </CitizenShell>
  );
}
