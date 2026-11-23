"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  GeoJsonPoint,
} from "@civictrack/contracts";
import { CATEGORY_COLORS } from "../../../lib/ola-maps-config";
import { useToast } from "../../../components/ui/toast-context";
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
  Send,
  Info,
} from "lucide-react";

const LocationPicker = dynamic(
  () => import("../../../components/maps/location-picker").then((mod) => mod.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-2xl border border-border bg-secondary/50 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span>Loading map location picker...</span>
      </div>
    ),
  }
);

const CATEGORY_DEFINITIONS = [
  {
    category: ComplaintCategory.ROADS_POTHOLES,
    label: "Roads & Potholes",
    targetDays: "2 days",
    description: "Potholes, broken curbs, damaged asphalt, road cave-ins",
  },
  {
    category: ComplaintCategory.WATER_SUPPLY,
    label: "Water Supply & Leaks",
    targetDays: "1 day",
    description: "Burst pipes, contaminated tap water, low water pressure",
  },
  {
    category: ComplaintCategory.GARBAGE_SANITATION,
    label: "Garbage & Sanitation",
    targetDays: "1 day",
    description: "Overflowing trash bins, illegal dumping, street waste",
  },
  {
    category: ComplaintCategory.DRAINAGE_SEWAGE,
    label: "Drainage & Sewage",
    targetDays: "2 days",
    description: "Blocked storm drains, overflowing sewage, open manholes",
  },
  {
    category: ComplaintCategory.STREETLIGHTS,
    label: "Streetlights & Poles",
    targetDays: "1 day",
    description: "Broken streetlights, dark streets, leaning poles",
  },
  {
    category: ComplaintCategory.ELECTRICITY,
    label: "Electricity & Wiring",
    targetDays: "12 hours",
    description: "Exposed live wires, sparks, hazardous electrical equipment",
  },
  {
    category: ComplaintCategory.OTHER,
    label: "Other Civic Inquiries",
    targetDays: "2 days",
    description: "General public infrastructure issues and civic reports",
  },
];

interface UploadedPhoto {
  file: File;
  previewUrl: string;
}

export default function ReportComplaintPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Wizard step state (1 to 4)
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

  // Photo selection with accessible toast notifications instead of alert()
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      toast.error("Too many photos", "Maximum 5 photos allowed per report.");
      return;
    }

    const validMimes = ["image/jpeg", "image/png", "image/webp"];
    const validPhotos: UploadedPhoto[] = [];

    for (const file of files) {
      if (!validMimes.includes(file.type)) {
        toast.error("Unsupported file", `"${file.name}" must be a JPEG, PNG, or WebP image.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File too large", `"${file.name}" exceeds the 10MB limit.`);
        continue;
      }
      if (file.size === 0) {
        toast.error("Empty file", `"${file.name}" contains no data.`);
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

  // Submit Complaint to Backend
  const handleSubmitComplaint = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("address", address.trim() || "Address identified on city map");
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
        throw new Error(json.error?.message || "Failed to submit report");
      }

      toast.success("Report Submitted", "Your report has been logged and assigned a tracking ID.");
      setCreatedReference(json.data.referenceNumber);
      setCreatedId(json.data._id || json.data.id);
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred during submission");
      toast.error("Submission Failed", err.message || "Could not lodge report");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step Validation checks
  const isStep1Valid = title.trim().length >= 5 && description.trim().length >= 20;
  const isStep2Valid = address.trim().length >= 3;

  // Render Confirmation Screen
  if (createdReference && createdId) {
    return (
      <div className="max-w-xl mx-auto py-12 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-500/10">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Report Received
          </span>
          <h1 className="text-3xl font-bold text-foreground tracking-tight mt-3">
            Issue Registered Successfully
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md leading-relaxed">
            Your issue is in the city queue. Municipal staff will review the report and dispatch a field team.
          </p>
        </div>

        <div className="w-full p-6 rounded-3xl border border-border bg-card flex flex-col items-center gap-1 shadow-xs">
          <span className="text-xs font-medium text-muted-foreground">Tracking Reference ID</span>
          <span className="text-3xl font-bold text-primary tracking-wide mt-1">
            {createdReference}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
          <Link
            href={`/citizen/complaints/${createdId}`}
            className="w-full sm:flex-1 py-3.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-md shadow-primary/25 text-center transition-all min-h-[44px] flex items-center justify-center"
          >
            Track Repair Progress &rarr;
          </Link>
          <Link
            href="/citizen"
            className="w-full sm:flex-1 py-3.5 px-4 bg-card text-foreground font-semibold text-xs rounded-xl hover:bg-secondary text-center transition-all border border-border shadow-xs min-h-[44px] flex items-center justify-center"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Report a Local Problem
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Tell us what needs fixing, where it is, and attach photos to help the field team.
        </p>
      </div>

      {/* Stepped Form Container */}
      <div className="rounded-3xl border border-border bg-card shadow-xl shadow-primary/5 overflow-hidden">
        {/* Step Progress Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 sm:px-8 py-5 flex items-center justify-between text-white">
          <span className="font-semibold text-sm sm:text-base">
            {step === 1 && "Step 1: What is the issue?"}
            {step === 2 && "Step 2: Where is it located?"}
            {step === 3 && "Step 3: Add photos (optional)"}
            {step === 4 && "Step 4: Review & send"}
          </span>
          <div className="flex space-x-1.5 items-center">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  step === s ? "w-8 bg-white" : step > s ? "w-6 bg-white/70" : "w-4 bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-10 space-y-8">
          {/* Step 1: Issue Classification */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">
                  Category *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CATEGORY_DEFINITIONS.map((cat) => {
                    const isSelected = category === cat.category;
                    const color = CATEGORY_COLORS[cat.category];

                    return (
                      <button
                        key={cat.category}
                        type="button"
                        onClick={() => setCategory(cat.category)}
                        className={`p-4 rounded-2xl border text-left transition flex items-center justify-between min-h-[48px] ${
                          isSelected
                            ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/20"
                            : "border-border bg-card hover:bg-secondary text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <div>
                            <span className="text-xs font-bold block">{cat.label}</span>
                            <span className="text-[11px] text-muted-foreground block line-clamp-1">{cat.description}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-md border border-border shrink-0 ml-2">
                          {cat.targetDays}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Problem Name *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Deep pothole near grocery store entrance"
                    maxLength={150}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm text-foreground min-h-[44px]"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    At least 5 characters. ({title.length}/150)
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Detailed Description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe how severe it is, any safety hazards, and exactly what needs attention..."
                    rows={4}
                    maxLength={2000}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm text-foreground resize-y"
                  />
                  <span className="text-[11px] text-muted-foreground block">
                    At least 20 characters. ({description.length}/2000)
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none transition active:scale-[0.98] min-h-[44px]"
                >
                  <span>Next: Choose Location</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-foreground">Where is the issue located?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click anywhere on the map or use your device GPS to pinpoint the exact incident spot.
                </p>
              </div>

              <div className="p-4 sm:p-5 rounded-3xl border border-border bg-secondary/30 shadow-xs space-y-4">
                <LocationPicker
                  value={location}
                  address={address}
                  onChange={(loc, addr) => {
                    setLocation(loc);
                    if (addr) setAddress(addr);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 100 Feet Rd, Indiranagar"
                    maxLength={300}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none text-xs text-foreground min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-foreground">
                    Nearby Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Opposite Metro Pillar 42"
                    maxLength={150}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none text-xs text-foreground min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition min-h-[44px]"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!isStep2Valid}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 disabled:opacity-40 disabled:pointer-events-none transition active:scale-[0.98] min-h-[44px]"
                >
                  <span>Next: Add Photos</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-primary/10 p-5 rounded-2xl border border-primary/20 flex gap-4 items-center">
                <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  <Info className="w-4 h-4" />
                </div>
                <div className="text-xs text-foreground leading-relaxed">
                  <p className="font-bold mb-0.5">Photo Tips:</p>
                  <p className="text-muted-foreground">
                    Clear photos help field crews identify the exact problem and bring the right tools.
                  </p>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="relative group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-border rounded-3xl p-10 text-center group-hover:border-primary group-hover:bg-primary/5 transition-all duration-200 bg-secondary/30">
                  <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-foreground font-bold text-sm mt-3 mb-1">
                    Click to add photos or drag and drop
                  </p>
                  <p className="text-muted-foreground text-xs">
                    JPEG, PNG, or WebP &bull; Max 5 photos &bull; Up to 10MB each
                  </p>
                </div>
              </div>

              {/* Thumbnails list */}
              {photos.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-foreground">
                    Attached Photos ({photos.length}/5)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {photos.map((photo, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between border border-border p-3 rounded-2xl bg-card shadow-xs"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <img
                            src={photo.previewUrl}
                            alt="preview"
                            className="w-10 h-10 rounded-xl object-cover border border-border"
                          />
                          <span className="font-semibold text-foreground text-xs truncate">
                            {photo.file.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Remove photo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition min-h-[44px]"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition active:scale-[0.98] min-h-[44px]"
                >
                  <span>Review Details</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-foreground">Check Your Report</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review the details before submitting to the municipal service team.
                </p>
              </div>

              {submitError && (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="border border-border rounded-3xl p-6 bg-secondary/30 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b border-border">
                  <div>
                    <span className="text-muted-foreground block mb-1">Issue Category</span>
                    <span className="font-bold text-foreground text-sm capitalize">
                      {category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Location Coordinates</span>
                    <span className="font-bold text-primary text-xs">
                      [{location.coordinates[0].toFixed(5)}, {location.coordinates[1].toFixed(5)}]
                    </span>
                  </div>
                </div>

                <div className="pb-3 border-b border-border">
                  <span className="text-muted-foreground block mb-1">Summary Title</span>
                  <span className="font-bold text-foreground text-sm">{title}</span>
                </div>

                <div className="pb-3 border-b border-border">
                  <span className="text-muted-foreground block mb-1">Full Description</span>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground block mb-1">Street Address</span>
                    <span className="font-semibold text-foreground">{address}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-1">Attached Photos</span>
                    <span className="font-semibold text-foreground">{photos.length} photo(s) ready</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition min-h-[44px]"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmitComplaint}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/25 transition active:scale-[0.98] disabled:opacity-50 min-h-[48px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Report...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
