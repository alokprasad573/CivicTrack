"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  ImageIcon,
  AlertCircle,
  Loader2,
  Calendar,
  HardDrive,
  FileCode,
} from "lucide-react";

export interface EvidenceImageItem {
  key?: string;
  objectKey?: string;
  url?: string;
  originalName?: string;
  mimeType?: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string | Date;
}

interface EvidenceLightboxProps {
  images: EvidenceImageItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EvidenceLightbox({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}: EvidenceLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
    setImgLoading(true);
    setImgError(false);
  }, [initialIndex, isOpen]);

  const currentImage = images[currentIndex];

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setIsZoomed(false);
    setImgLoading(true);
    setImgError(false);
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setIsZoomed(false);
    setImgLoading(true);
    setImgError(false);
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || !currentImage) return null;

  const objectKey = currentImage.objectKey || currentImage.key || "";
  const filename =
    currentImage.originalName ||
    (objectKey ? objectKey.split("/").pop() : "evidence_image.jpg");
  const mimeType = currentImage.mimeType || currentImage.contentType || "image/jpeg";
  const sizeFormatted = formatBytes(currentImage.size);
  const uploadedDate = currentImage.uploadedAt
    ? new Date(currentImage.uploadedAt).toLocaleString()
    : null;
  const viewUrl = currentImage.url || "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evidence preview lightbox"
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{filename}</h3>
            <p className="text-[11px]  text-muted-foreground truncate">
              {objectKey || "Evidence File"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {images.length > 1 && (
            <span className="text-xs  font-medium text-muted-foreground mr-2">
              {currentIndex + 1} / {images.length}
            </span>
          )}

          {viewUrl && (
            <>
              <button
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors"
                title={isZoomed ? "Fit to screen" : "Zoom in"}
              >
                {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>

              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center"
                title="Open in new window"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <a
                href={viewUrl}
                download={filename}
                className="p-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors flex items-center"
                title="Download original image"
              >
                <Download className="w-4 h-4" />
              </a>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 border border-border transition-colors ml-1"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport Area */}
      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-auto">
        {/* Previous Image Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-card/80 hover:bg-card border border-border text-foreground shadow-xl transition-all"
            title="Previous image (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Loading Spinner */}
        {imgLoading && !imgError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 pointer-events-none">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Loading full evidence image...</span>
          </div>
        )}

        {/* Error Fallback */}
        {imgError && (
          <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl bg-destructive/10 border border-destructive/20 text-center max-w-sm">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <div>
              <p className="text-sm font-bold text-destructive">Failed to load evidence image</p>
              <p className="text-xs text-muted-foreground mt-1">
                The image URL may have expired or network is unreachable.
              </p>
            </div>
            {viewUrl && (
              <button
                type="button"
                onClick={() => {
                  setImgError(false);
                  setImgLoading(true);
                }}
                className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Actual Image */}
        {viewUrl && !imgError && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={viewUrl}
            alt={filename}
            onLoad={() => setImgLoading(false)}
            onError={async () => {
              if (objectKey) {
                try {
                  const res = await fetch(
                    `/api/v1/storage/view-url?objectKey=${encodeURIComponent(objectKey)}`
                  );
                  const data = await res.json();
                  if (data.success && data.data?.viewUrl) {
                    currentImage.url = data.data.viewUrl;
                    setImgLoading(true);
                    setImgError(false);
                    return;
                  }
                } catch {
                  // Fall through to error
                }
              }
              setImgLoading(false);
              setImgError(true);
            }}
            className={`transition-all duration-200 rounded-xl shadow-2xl object-contain max-h-full ${
              isZoomed
                ? "scale-150 cursor-zoom-out"
                : "max-w-full cursor-zoom-in hover:opacity-95"
            }`}
            onClick={() => setIsZoomed(!isZoomed)}
          />
        )}

        {/* Next Image Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-card/80 hover:bg-card border border-border text-foreground shadow-xl transition-all"
            title="Next image (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Footer Info Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-t border-border bg-card/80 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-primary" />
            <span className=" text-[11px]">{mimeType}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-primary" />
            <span className=" text-[11px]">{sizeFormatted}</span>
          </div>

          {uploadedDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{uploadedDate}</span>
            </div>
          )}
        </div>

        {/* Thumbnails strip if multiple */}
        {images.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-0.5">
            {images.map((img, idx) => (
              <button
                key={img.key || img.objectKey || idx}
                type="button"
                onClick={() => {
                  setCurrentIndex(idx);
                  setIsZoomed(false);
                  setImgLoading(true);
                  setImgError(false);
                }}
                className={`w-10 h-10 rounded-lg overflow-hidden border transition-all shrink-0 ${
                  idx === currentIndex
                    ? "border-primary ring-2 ring-primary/40 scale-105"
                    : "border-border opacity-60 hover:opacity-100"
                }`}
              >
                {img.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={img.url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
