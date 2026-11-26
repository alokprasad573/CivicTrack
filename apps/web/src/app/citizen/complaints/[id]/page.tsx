"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from "@civictrack/contracts";
import { STATUS_COLORS, CATEGORY_COLORS } from "../../../../lib/ola-maps-config";
import { ComplaintStatusTracker } from "../../../../components/complaints/complaint-status-tracker";
import { EvidenceLightbox, EvidenceImageItem } from "../../../../components/evidence/evidence-lightbox";
import { StatusBadge } from "../../../../components/ui/status-badge";
import { PriorityBadge } from "../../../../components/ui/priority-badge";
import { PageHeader } from "../../../../components/ui/page-header";
import { useToast } from "../../../../components/ui/toast-context";
import { useComplaintDetailRealtime } from "../../../../hooks/use-complaint-detail-realtime";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Star,
  Loader2,
  ExternalLink,
  ImageIcon,
  ZoomIn,
  AlertCircle,
  Building2,
  User,
} from "lucide-react";

const OlaMap = dynamic(
  () => import("../../../../components/maps/ola-map").then((mod) => mod.OlaMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[280px] rounded-2xl border border-border bg-secondary/40 flex items-center justify-center text-xs text-muted-foreground">
        Loading Map View...
      </div>
    ),
  }
);

export default function CitizenComplaintDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const complaintId = resolvedParams.id;
  const { toast } = useToast();

  const [complaint, setComplaint] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Feedback state
  const [rating, setRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const refreshImageUrl = async (objectKey: string) => {
    try {
      const res = await fetch(
        `/api/v1/storage/view-url?objectKey=${encodeURIComponent(objectKey)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.viewUrl) {
          setViewUrls((prev) => ({
            ...prev,
            [objectKey]: json.data.viewUrl,
          }));
        }
      }
    } catch {
      // Ignore background URL fetch error
    }
  };

  const loadComplaintDetails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Report not found"
            : `Failed to load details (${res.status})`
        );
      }

      const json = await res.json();
      if (json.success && json.data) {
        const comp = json.data.complaint || json.data;
        const hist = json.data.history || [];
        setComplaint(comp);
        setHistory(hist);

        // Populate direct pre-signed URLs from server
        const initialMap: Record<string, string> = {};
        const allEv = [
          ...(comp.evidence || []),
          ...(comp.resolutionEvidence || []),
          ...hist.flatMap((h: any) => h.evidence || []),
        ];
        for (const ev of allEv) {
          const k = ev.objectKey || ev.key;
          if (k && ev.url) {
            initialMap[k] = ev.url;
          }
        }
        setViewUrls((prev) => ({ ...prev, ...initialMap }));

        // Fetch pre-signed URLs for citizen evidence
        const evidenceList = comp.evidence || [];
        for (const ev of evidenceList) {
          const key = ev.objectKey || ev.key;
          if (key && !initialMap[key]) {
            refreshImageUrl(key);
          }
        }

        // Fetch resolution evidence URLs
        const resEvidenceList = comp.resolutionEvidence || [];
        for (const ev of resEvidenceList) {
          const key = ev.objectKey || ev.key;
          if (key && !initialMap[key]) {
            refreshImageUrl(key);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load report");
    } finally {
      setIsLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    loadComplaintDetails();
  }, [loadComplaintDetails]);

  // Real-time live room updates for this complaint
  useComplaintDetailRealtime({
    complaintId,
    onRefresh: () => {
      loadComplaintDetails();
    },
    onStatusUpdated: (update) => {
      setComplaint((prev: any) => (prev ? { ...prev, status: update.status } : prev));
      loadComplaintDetails();
    },
    onAssigned: () => {
      loadComplaintDetails();
    },
  });

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingFeedback(true);
    try {
      const res = await fetch(`/api/v1/complaints/${complaintId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: feedbackComment }),
      });
      if (res.ok) {
        setFeedbackSuccess(true);
        toast.success("Feedback Submitted", "Thank you for rating the resolution quality.");
      } else {
        toast.error("Feedback Failed", "Unable to record your rating at this time.");
      }
    } catch {
      toast.error("Feedback Error", "Network error submitting feedback.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const citizenEvidenceItems: EvidenceImageItem[] = (complaint?.evidence || []).map((e: any, idx: number) => ({
    key: e.objectKey || e.key || `cit-${idx}`,
    objectKey: e.objectKey || e.key,
    url: (e.objectKey ? viewUrls[e.objectKey] : null) || (e.key ? viewUrls[e.key] : null) || e.url || "",
    originalName: e.filename || e.originalName || "Citizen Evidence",
    uploadedAt: e.uploadedAt,
  }));

  const resolutionEvidenceItems: EvidenceImageItem[] = (complaint?.resolutionEvidence || []).map((e: any, idx: number) => ({
    key: e.objectKey || e.key || `res-${idx}`,
    objectKey: e.objectKey || e.key,
    url: (e.objectKey ? viewUrls[e.objectKey] : null) || (e.key ? viewUrls[e.key] : null) || e.url || "",
    originalName: e.filename || e.originalName || "Resolution Evidence",
    uploadedAt: e.uploadedAt,
  }));

  const allEvidenceItems: EvidenceImageItem[] = [...citizenEvidenceItems, ...resolutionEvidenceItems];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        href="/citizen/complaints"
        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Reports</span>
      </Link>

      {isLoading ? (
        <div className="h-96 rounded-3xl border border-border bg-card flex flex-col items-center justify-center gap-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-muted-foreground">Retrieving report details...</span>
        </div>
      ) : error || !complaint ? (
        <div className="p-8 rounded-3xl border border-destructive/20 bg-destructive/10 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-base font-bold text-foreground">Report Unavailable</h2>
          <p className="text-xs text-muted-foreground">{error || "Unable to locate this report."}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Result Card */}
          <div className="bg-card rounded-3xl border border-border shadow-xl shadow-primary/5 overflow-hidden">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-center text-white">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/20 rounded-2xl mb-3 backdrop-blur-xs shadow-inner">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">{complaint.title}</h1>
              <p className="opacity-90 text-xs font-semibold mt-1">
                Reference ID: {complaint.referenceNumber || complaintId}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.priority} />
              </div>
            </div>

            {/* Details Grid */}
            <div className="p-6 sm:p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Submission Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Submission Details
                  </h3>
                  <div className="bg-secondary/40 p-6 rounded-2xl space-y-3.5 border border-border text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Category:</span>
                      <span className="font-semibold text-foreground capitalize">
                        {complaint.category?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reported On:</span>
                      <span className="font-semibold text-foreground">
                        {new Date(complaint.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coordinates:</span>
                      <span className="font-bold text-primary">
                        [{complaint.location?.coordinates?.[0]?.toFixed(4)}, {complaint.location?.coordinates?.[1]?.toFixed(4)}]
                      </span>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <span className="text-muted-foreground block mb-1">Street Address:</span>
                      <span className="font-medium text-foreground leading-relaxed block">
                        {complaint.address || "No address entered"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Assigned Team & Response Time */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Assigned Team & Target Time
                  </h3>
                  <div className="bg-primary/5 p-6 rounded-2xl space-y-3.5 border border-primary/10 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned Department:</span>
                      <span className="font-bold text-foreground">
                        {complaint.assignedDepartment?.name || "Pending Review"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Field Officer:</span>
                      <span className="font-bold text-foreground">
                        {complaint.assignedOfficer?.name || "Will be assigned shortly"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Target Resolution Time:</span>
                      <span className="font-bold text-primary">
                        {complaint.targetResolutionHours ? `${complaint.targetResolutionHours} hours` : "Standard 48h"}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-primary/10">
                      <span className="text-xs font-semibold py-1 px-3 rounded-full bg-primary/10 text-primary inline-block">
                        Active In City Queue
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description Body */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Issue Description
                </h3>
                <div className="p-5 rounded-2xl bg-card border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {complaint.description}
                </div>
              </div>

              {/* Map Location View */}
              {complaint.location && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span>Incident Location</span>
                    </h3>
                    <span className="text-xs font-medium text-muted-foreground">
                      [{complaint.location.coordinates?.[0]?.toFixed(4)}, {complaint.location.coordinates?.[1]?.toFixed(4)}]
                    </span>
                  </div>
                  <div className="rounded-3xl border border-border overflow-hidden shadow-xs h-64">
                    <OlaMap
                      initialCenter={complaint.location.coordinates}
                      initialZoom={15}
                      complaints={[
                        {
                          ...complaint,
                          id: complaint._id || complaint.id || complaintId,
                          referenceNumber: complaint.referenceNumber || String(complaintId).slice(-6).toUpperCase(),
                          title: complaint.title || "Incident Location",
                          description: complaint.description,
                          category: complaint.category || ComplaintCategory.GENERAL,
                          status: complaint.status || ComplaintStatus.SUBMITTED,
                          priority: complaint.priority,
                          location: complaint.location,
                          address: complaint.address || "Reported Location",
                          createdAt: complaint.createdAt,
                        },
                      ]}
                      selectedComplaintId={complaint._id || complaint.id || complaintId}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 px-1">
                    <p className="truncate flex items-center gap-1.5 max-w-[70%]">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{complaint.address || "Reported Location"}</span>
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${complaint.location.coordinates?.[1]},${complaint.location.coordinates?.[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-semibold hover:underline shrink-0 flex items-center gap-1 min-h-[44px]"
                    >
                      <span>Open in Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Citizen Photo Evidence Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Citizen Photo Evidence</span>
                  </h3>
                  {citizenEvidenceItems.length > 0 && (
                    <span className="text-[11px] font-bold text-muted-foreground bg-secondary px-2.5 py-0.5 rounded-full border border-border">
                      {citizenEvidenceItems.length} photo{citizenEvidenceItems.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {citizenEvidenceItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No evidence photos attached with report.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {citizenEvidenceItems.map((item, idx) => (
                      <div
                        key={item.key || idx}
                        onClick={() => {
                          setActiveImageIndex(idx);
                          setLightboxOpen(true);
                        }}
                        className="relative aspect-video rounded-2xl overflow-hidden border border-border bg-secondary cursor-pointer group hover:border-primary/50 transition"
                        title="Click to zoom photo in Lightbox"
                      >
                        {item.url ? (
                          <img
                            src={item.url}
                            alt={item.originalName || "Citizen Evidence"}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={() => {
                              if (item.objectKey) refreshImageUrl(item.objectKey);
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <ZoomIn className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Officer Resolution Photo Evidence */}
              {(resolutionEvidenceItems.length > 0 || complaint.resolvedAt || [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED].includes(complaint.status)) && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      <span>Officer Resolution Proof Evidence ({resolutionEvidenceItems.length})</span>
                    </h3>
                    {resolutionEvidenceItems.length > 0 && (
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Verified Work Proof ({resolutionEvidenceItems.length})
                      </span>
                    )}
                  </div>

                  {resolutionEvidenceItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No resolution photos attached by field staff.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {resolutionEvidenceItems.map((item, idx) => (
                        <div
                          key={item.key || idx}
                          onClick={() => {
                            setActiveImageIndex(citizenEvidenceItems.length + idx);
                            setLightboxOpen(true);
                          }}
                          className="relative aspect-video rounded-2xl overflow-hidden border border-emerald-500/30 bg-emerald-500/5 cursor-pointer group hover:border-emerald-500 transition"
                          title="Click to zoom resolution proof in Lightbox"
                        >
                          {item.url ? (
                            <img
                              src={item.url}
                              alt={item.originalName || "Officer Resolution Evidence"}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={() => {
                                if (item.objectKey) refreshImageUrl(item.objectKey);
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ZoomIn className="w-5 h-5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Status Timeline */}
              <div className="pt-4 border-t border-border">
                <ComplaintStatusTracker
                  currentStatus={complaint.status}
                  history={history}
                  viewUrls={viewUrls}
                  resolutionEvidence={complaint.resolutionEvidence}
                  resolutionRemarks={complaint.resolutionRemarks}
                  resolvedAt={complaint.resolvedAt}
                  onImageClick={(url) => {
                    const idx = allEvidenceItems.findIndex((e) => {
                      const k = e.objectKey || e.key;
                      const u = (k ? viewUrls[k] : null) || e.url;
                      return u === url || e.url === url;
                    });
                    if (idx !== -1) {
                      setActiveImageIndex(idx);
                      setLightboxOpen(true);
                    } else {
                      window.open(url, "_blank");
                    }
                  }}
                />
              </div>

              {/* Citizen Feedback Form if Resolved */}
              {complaint.status === ComplaintStatus.RESOLVED && !feedbackSuccess && (
                <div className="p-6 rounded-3xl border border-primary/20 bg-primary/5 space-y-4">
                  <h3 className="text-sm font-bold text-foreground">Rate Repair Quality</h3>
                  <p className="text-xs text-muted-foreground">
                    How satisfied are you with the speed and quality of this repair?
                  </p>
                  <form onSubmit={handleSubmitFeedback} className="space-y-4">
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRating(s)}
                          className="p-1 text-amber-400 hover:scale-110 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                          aria-label={`Rate ${s} stars out of 5`}
                        >
                          <Star
                            className={`w-6 h-6 ${
                              s <= rating ? "fill-amber-400" : "fill-none text-muted-foreground/40"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Optional comments on how the repair was handled..."
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-xs outline-none focus:ring-2 focus:ring-primary text-foreground"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition disabled:opacity-50 min-h-[44px]"
                    >
                      {isSubmittingFeedback ? "Submitting..." : "Submit Rating"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      <EvidenceLightbox
        images={allEvidenceItems}
        initialIndex={activeImageIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
