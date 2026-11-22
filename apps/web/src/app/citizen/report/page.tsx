"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  CreateComplaintDto,
  EvidenceItem,
  GeoJsonPoint,
} from "@civictrack/contracts";
import { CitizenShell } from "../../../components/layout/citizen-shell";
import { CATEGORY_COLORS } from "../../../lib/ola-maps-config";

const LocationPicker = dynamic(
  () => import("../../../components/maps/location-picker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-2xl border border-border bg-card/40 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-6 h-6 text-[#d95d39] animate-spin" />
        <span>Loading Ola Maps location picker...</span>
      </div>
    ),
  }
);
import {
  FileText,
  MapPin,
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  UploadCloud,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Send,
} from "lucide-react";

const CATEGORY_DEFINITIONS = [
  {
    category: ComplaintCategory.ROADS_POTHOLES,
    label: "Roads & Potholes",
    slaHours: 48,
    description: "Craters, road cave-ins, broken curbs, damaged asphalt",
  },
  {
    category: ComplaintCategory.WATER_SUPPLY,
    label: "Water Supply & Leaks",
    slaHours: 24,
    description: "Pipeline bursts, contaminated tap water, low pressure",
  },
  {
    category: ComplaintCategory.GARBAGE_SANITATION,
    label: "Garbage & Sanitation",
    slaHours: 24,
    description: "Overflowing dumpsters, illegal trash dumping, dead animals",
  },
  {
    category: ComplaintCategory.DRAINAGE_SEWAGE,
    label: "Drainage & Sewage",
    slaHours: 48,
    description: "Blocked storm drains, overflowing sewage, open manholes",
  },
  {
    category: ComplaintCategory.STREETLIGHTS,
    label: "Streetlights & Poles",
    slaHours: 24,
    description: "Dark streetlights, flickering fixtures, broken poles",
  },
  {
    category: ComplaintCategory.ELECTRICITY,
    label: "Electricity Grid",
    slaHours: 12,
    description: "Exposed wires, transformer sparks, leaning electricity poles",
  },
  {
    category: ComplaintCategory.OTHER,
    label: "Other Civic Inquiries",
    slaHours: 48,
    description: "General municipal infrastructure issues and civic reports",
  },
];

interface UploadedPhoto {
  file: File;
  previewUrl: string;
}

export default function ReportComplaintPage() {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form state
  const [category, setCategory] = useState<ComplaintCategory>(
    ComplaintCategory.ROADS_POTHOLES
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [location, setLocation] = useState<GeoJsonPoint>({
    type: "Point",
    coordinates: [77.5946, 12.9716],
  });
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");

  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdReference, setCreatedReference] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Photo selection with client-side validation
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      alert("Maximum 5 evidence images allowed per complaint.");
      return;
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    const validPhotos: UploadedPhoto[] = [];

    for (const file of files) {
      if (!validMimes.includes(file.type)) {
        alert(`File "${file.name}" has an unsupported format. Allowed formats: JPEG, PNG, WebP.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the maximum allowed size of 10MB.`);
        continue;
      }
      if (file.size === 0) {
        alert(`File "${file.name}" is empty.`);
        continue;
      }

      validPhotos.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setPhotos((prev) => [...prev, ...validPhotos]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Complaint to Backend via multipart/form-data with physical AWS S3 upload
  const handleSubmitComplaint = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("address", address.trim() || "Address identified on municipal map");
      if (landmark.trim()) {
        formData.append("landmark", landmark.trim());
      }
      formData.append("location", JSON.stringify(location));

      photos.forEach((photo) => {
        formData.append("evidenceImages", photo.file);
      });

      const res = await fetch("/api/v1/complaints", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to submit complaint");
      }

      setCreatedReference(json.data.referenceNumber);
      setCreatedId(json.data._id || json.data.id);
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred during submission");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step Validation checks
  const isStep1Valid = title.trim().length >= 5 && description.trim().length >= 20;
  const isStep2Valid = address.trim().length >= 3;

  // Render Success Screen
  if (createdReference && createdId) {
    return (
      <CitizenShell>
        <div className="max-w-xl mx-auto py-12 flex flex-col items-center text-center gap-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#d95d39]">
              Submission Confirmed
            </span>
            <h1 className="font-display text-3xl font-bold text-foreground tracking-tight mt-1">
              Complaint Registered
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md">
              Your issue has been logged into the municipal queue. An administrator will review and assign an investigating department officer shortly.
            </p>
          </div>

          <div className="w-full p-4 rounded-2xl border border-border bg-card flex flex-col items-center gap-1 shadow-inner">
            <span className="text-xs text-muted-foreground">Permanent Tracking Reference</span>
            <span className="text-2xl font-mono font-bold text-[#d95d39]">
              {createdReference}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <Link
              href={`/citizen/complaints/${createdId}`}
              className="w-full sm:flex-1 py-3 px-4 bg-[#d95d39] hover:bg-[#c34e2c] text-white font-semibold text-xs rounded-xl shadow-md text-center transition-all"
            >
              Track Complaint Timeline
            </Link>
            <Link
              href="/citizen"
              className="w-full sm:flex-1 py-3 px-4 bg-card text-foreground font-semibold text-xs rounded-xl hover:bg-secondary text-center transition-all border border-border"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </CitizenShell>
    );
  }

  return (
    <CitizenShell>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header & Steps Indicator */}
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            Report a Civic Issue
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Provide accurate details, map coordinates, and photo evidence for rapid municipal routing.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="grid grid-cols-4 gap-2 border border-border p-2 rounded-2xl bg-card">
          {[
            { step: 1, label: "1. Issue Details" },
            { step: 2, label: "2. Pin Location" },
            { step: 3, label: "3. S3 Evidence" },
            { step: 4, label: "4. Review & Submit" },
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => {
                if (s.step === 1) setStep(1);
                if (s.step === 2 && isStep1Valid) setStep(2);
                if (s.step === 3 && isStep1Valid && isStep2Valid) setStep(3);
                if (s.step === 4 && isStep1Valid && isStep2Valid) setStep(4);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold text-center transition ${
                step === s.step
                  ? "bg-[#d95d39] text-white shadow-sm"
                  : step > s.step
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground/60"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Wizard Step 1: Issue Classification */}
        {step === 1 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                Issue Category *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CATEGORY_DEFINITIONS.map((cat) => {
                  const isSelected = category === cat.category;
                  const color = CATEGORY_COLORS[cat.category];

                  return (
                    <button
                      key={cat.category}
                      type="button"
                      onClick={() => setCategory(cat.category)}
                      className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? "border-[#d95d39] bg-[#d95d39]/10 text-foreground ring-1 ring-[#d95d39]"
                          : "border-border bg-secondary/30 hover:border-[#d95d39]/40 hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-xs font-semibold text-foreground">{cat.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                        SLA {cat.slaHours}h
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Complaint Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Broken storm drain cover near 4th Cross junction"
                  maxLength={150}
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none bg-background text-foreground focus:border-[#d95d39] transition-colors"
                />
                <span className="text-[10px] font-mono text-muted-foreground block mt-1">
                  At least 5 characters. ({title.length}/150)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Detailed Description *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe severity, safety impact, and duration of the municipal issue..."
                  rows={4}
                  maxLength={2000}
                  className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm outline-none bg-background text-foreground focus:border-[#d95d39] transition-colors resize-y"
                />
                <span className="text-[10px] font-mono text-muted-foreground block mt-1">
                  At least 20 characters. ({description.length}/2000)
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!isStep1Valid}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#d95d39] hover:bg-[#c34e2c] text-white shadow-sm disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <span>Next: Pin Location</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 2: Location on Ola Map */}
        {step === 2 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pin Exact Coordinates on Ola Maps</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drop a pin on the map or click Use My GPS. Real-time reverse geocoding fills the address automatically.
              </p>
            </div>

            <LocationPicker
              value={location}
              address={address}
              onChange={(loc, addr) => {
                setLocation(loc);
                if (addr) setAddress(addr);
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Reverse-Geocoded Address *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 100 Feet Rd, Indiranagar, Bengaluru"
                  maxLength={300}
                  className="w-full border border-border rounded-xl px-3 py-2 text-xs outline-none bg-background text-foreground focus:border-[#d95d39]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nearby Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite Metro Pillar 42"
                  maxLength={150}
                  className="w-full border border-border rounded-xl px-3 py-2 text-xs outline-none bg-background text-foreground focus:border-[#d95d39]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!isStep2Valid}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#d95d39] hover:bg-[#c34e2c] text-white shadow-sm disabled:opacity-40 disabled:pointer-events-none transition"
              >
                <span>Next: S3 Evidence</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 3: Photo Evidence */}
        {step === 3 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
            <div className="border-2 border-dashed border-border hover:border-[#d95d39]/60 rounded-2xl p-6 text-center space-y-2 bg-secondary/20 transition-colors relative">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-[#d95d39] mx-auto" />
              <p className="text-sm font-bold text-foreground">Attach Photo Evidence (Private AWS S3 Storage)</p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, or WebP up to 10MB each (max 5 photos) &bull; Encrypted server-side storage
              </p>
              <div className="pt-2">
                <span className="inline-block px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-card text-foreground">
                  Browse Files
                </span>
              </div>
            </div>

            {/* Thumbnail Previews with [S3 VERIFIED] */}
            {photos.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground">
                  Attached Evidence Keys ({photos.length}/5)
                </p>
                <div className="space-y-2">
                  {photos.map((photo, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border border-border px-3.5 py-2.5 rounded-xl text-xs bg-secondary/30"
                    >
                      <div className="flex items-center gap-2.5 truncate max-w-sm">
                        <img
                          src={photo.previewUrl}
                          alt="preview"
                          className="w-8 h-8 rounded-lg object-cover border border-border"
                        />
                        <span className="font-medium text-foreground truncate">{photo.file.name}</span>
                        <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          [S3 VERIFIED]
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 transition-colors"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#d95d39] hover:bg-[#c34e2c] text-white shadow-sm transition"
              >
                <span>Review Submission</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Wizard Step 4: Review & Submit */}
        {step === 4 && (
          <div className="p-6 rounded-2xl border border-border bg-card space-y-5 shadow-sm">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">Review Your Complaint</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirm your submission details before registering the complaint with the municipal authorities.
              </p>
            </div>

            {submitError && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="border border-border rounded-2xl p-4 space-y-3 text-xs bg-secondary/20">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="text-muted-foreground">Category</span>
                <span className="font-semibold text-foreground capitalize">
                  {category.replace(/_/g, " ")}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="text-muted-foreground">Title</span>
                <span className="font-semibold text-foreground text-right max-w-xs truncate">{title}</span>
              </div>

              <div className="space-y-1 border-b border-border pb-2.5">
                <span className="text-muted-foreground block">Description</span>
                <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">{description}</p>
              </div>

              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="text-muted-foreground">GeoJSON Coordinates</span>
                <span className="font-mono font-semibold text-[#d95d39]">
                  [{location.coordinates[0].toFixed(5)}, {location.coordinates[1].toFixed(5)}]
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <span className="text-muted-foreground">Resolved Address</span>
                <span className="font-semibold text-foreground text-right max-w-xs truncate">{address}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">S3 Evidence Attachments</span>
                <span className="font-semibold text-foreground">{photos.length} file(s) attached</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleSubmitComplaint}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#d95d39] hover:bg-[#c34e2c] text-white shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting to Ledger...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Official Complaint</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </CitizenShell>
  );
}
