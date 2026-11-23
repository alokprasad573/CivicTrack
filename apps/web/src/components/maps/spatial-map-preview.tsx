"use client";

import React, { useId, useRef } from "react";
import { Coordinates, OlaMapMode } from "@civictrack/contracts";
import { useSpatialMap } from "../../hooks/use-spatial-map";
import { useComplaintMarkers, MapComplaintItem } from "../../hooks/use-complaint-markers";
import { MapControls } from "./map-controls";
import { CurrentLocationMarker } from "./current-location-marker";
import { MapMarkerLayer } from "./map-marker-layer";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  MapPin,
  Compass,
  X,
  ExternalLink,
  ShieldCheck,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS, CATEGORY_COLORS } from "../../lib/ola-maps-config";

export interface SpatialMapPreviewProps {
  complaints: MapComplaintItem[];
  selectedComplaintId?: string | null;
  onSelectComplaint?: (complaint: MapComplaintItem | null) => void;
  userRole?: "citizen" | "admin" | "officer";
  initialCenter?: Coordinates;
  initialZoom?: number;
  initialMode?: OlaMapMode;
  enableClustering?: boolean;
  className?: string;
  height?: string;
  title?: string;
  description?: string;
}

export function SpatialMapPreview({
  complaints = [],
  selectedComplaintId,
  onSelectComplaint,
  userRole = "citizen",
  initialCenter,
  initialZoom,
  initialMode = "default-light",
  enableClustering = false,
  className = "",
  height = "420px",
  title = "Spatial Map Preview",
  description = "Geographic visualization of reported civic incidents",
}: SpatialMapPreviewProps) {
  const generatedId = useId().replace(/:/g, "_");
  const containerId = `spatial_map_${generatedId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { validComplaints, validCount, totalCount } = useComplaintMarkers(complaints);

  const {
    map,
    mode,
    setMode,
    isLoading,
    isLoaded,
    error,
    retry,
    zoomIn,
    zoomOut,
    resetNorth,
    userLocation,
    locationAccuracy,
    isLocating,
    handleLocateMe,
  } = useSpatialMap({
    containerId,
    initialCenter,
    initialZoom,
    initialMode,
    selectedComplaintId,
    complaints: validComplaints,
    autoLocate: true,
  });

  const selectedComplaint = validComplaints.find((c) => c.id === selectedComplaintId);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl overflow-hidden border border-border bg-card/60 shadow-xl flex flex-col ${className}`}
      style={{ height }}
    >
      {/* Map Target DOM Element */}
      <div id={containerId} className="w-full h-full min-h-[300px]" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30 pointer-events-auto">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs font-semibold text-foreground tracking-wide">
            Loading Ola Maps SDK...
          </p>
          <span className="text-[11px] text-muted-foreground">
            Initializing vector tiles & spatial layers
          </span>
        </div>
      )}

      {/* Error / Retry Overlay */}
      {error && !isLoading && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 pointer-events-auto">
          <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Unable to Load Spatial Map
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mb-4">
            {error}
          </p>
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Map</span>
          </button>
        </div>
      )}

      {/* Top Left Information Badge */}
      {isLoaded && !error && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="bg-card/90 backdrop-blur-md border border-border/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{title}</span>
              </div>
              {validCount > 0 && (
                <p className="text-[10px] px-1.5 py-0.2 rounded font-bold text-primary">
                  {validCount > 1 ? `${validCount} Issues` : "1 Issue"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Right Controls */}
      {isLoaded && !error && (
        <MapControls
          currentMode={mode}
          onModeChange={setMode}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onLocateMe={handleLocateMe}
          onResetNorth={resetNorth}
          isLocating={isLocating}
          containerRef={containerRef}
        />
      )}

      {/* Dedicated GPS Current Location Marker */}
      {isLoaded && (
        <CurrentLocationMarker
          map={map}
          coords={userLocation}
          accuracy={locationAccuracy}
          label={userRole === "admin" ? "Admin Current Location" : "Your Current Location"}
          isLocating={isLocating}
        />
      )}

      {/* Dynamic Complaint Markers & Clustering Layer */}
      {isLoaded && (
        <MapMarkerLayer
          map={map}
          complaints={validComplaints}
          selectedComplaintId={selectedComplaintId}
          onSelectComplaint={(c) => onSelectComplaint?.(c)}
          enableClustering={enableClustering}
          userRole={userRole}
        />
      )}

      {/* Floating Selected Complaint Mini-HUD Card */}
      {isLoaded && selectedComplaint && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:max-w-md z-10 pointer-events-auto">
          <div className="bg-card/95 backdrop-blur-md border border-primary/40 rounded-xl p-3 shadow-2xl flex flex-col gap-2 ring-1 ring-primary/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary">
                  {selectedComplaint.referenceNumber}
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded border capitalize bg-secondary text-foreground border-border">
                  {selectedComplaint.status.replace(/_/g, " ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onSelectComplaint?.(null)}
                title="Deselect and reset view"
                className="w-5 h-5 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <h5 className="text-xs font-semibold text-foreground line-clamp-1">
              {selectedComplaint.title}
            </h5>

            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              <span className="truncate flex items-center gap-1 max-w-[200px]">
                <MapPin className="w-3 h-3 text-primary shrink-0" />
                <span className="truncate">{selectedComplaint.address}</span>
              </span>

              <Link
                href={`/citizen/complaints/${selectedComplaint.id}`}
                className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0"
              >
                <span>Full Details</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Empty State Banner when no complaints exist in view */}
      {isLoaded && validCount === 0 && !isLoading && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto z-10 pointer-events-none">
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-xl px-3.5 py-2 text-xs text-muted-foreground flex items-center gap-2 shadow-lg">
            <Compass className="w-4 h-4 text-primary shrink-0" />
            <span>No complaints in this view • Centered on device location</span>
          </div>
        </div>
      )}
    </div>
  );
}
