"use client";

import React, { useId, useRef, useEffect } from "react";
import { Coordinates, OlaMapMode } from "@civictrack/contracts";
import { useOlaMap } from "../../hooks/use-ola-map";
import { useGeolocation } from "../../hooks/use-geolocation";
import { MapControls } from "./map-controls";
import { MapMarkers, MapComplaintItem } from "./map-markers";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export interface OlaMapProps {
  initialCenter?: Coordinates;
  initialZoom?: number;
  initialMode?: OlaMapMode;
  complaints?: MapComplaintItem[];
  selectedComplaintId?: string | null;
  onSelectComplaint?: (complaint: MapComplaintItem) => void;
  onMapClick?: (coords: Coordinates) => void;
  onMapLoaded?: (map: any) => void;
  className?: string;
  children?: (mapState: { map: any; isLoaded: boolean }) => React.ReactNode;
}

export function OlaMap({
  initialCenter,
  initialZoom,
  initialMode = "default-light",
  complaints = [],
  selectedComplaintId,
  onSelectComplaint,
  onMapClick,
  onMapLoaded,
  className = "w-full h-[500px]",
  children,
}: OlaMapProps) {
  const generatedId = useId().replace(/:/g, "_");
  const containerId = `ola_map_${generatedId}`;
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    map,
    mode,
    setMode,
    isLoading,
    isLoaded,
    error,
    retry,
    flyTo,
    zoomIn,
    zoomOut,
    resetNorth,
  } = useOlaMap({
    containerId,
    initialCenter,
    initialZoom,
    initialMode,
    onMapClick,
  });

  const { getCurrentPosition, isTracking } = useGeolocation();

  const handleLocateMe = async () => {
    try {
      const coords = await getCurrentPosition();
      flyTo(coords, 16);
    } catch {
      // Handled in useGeolocation hook
    }
  };

  useEffect(() => {
    if (isLoaded && map && onMapLoaded) {
      onMapLoaded(map);
    }
  }, [isLoaded, map, onMapLoaded]);

  return (
    <div
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden border border-border bg-card/60 shadow-lg ${className}`}
    >
      {/* Map Target DOM Element */}
      <div id={containerId} className="w-full h-full min-h-[300px]" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">
            Initializing Ola Maps Web SDK...
          </p>
          <span className="text-xs text-muted-foreground">
            Loading vector tiles and 3D terrain
          </span>
        </div>
      )}

      {/* Error / Retry Overlay */}
      {error && !isLoading && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-20">
          <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h4 className="text-base font-semibold text-foreground mb-1">
            Unable to Load Ola Maps
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
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Map Controls */}
      {isLoaded && !error && (
        <MapControls
          currentMode={mode}
          onModeChange={setMode}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onLocateMe={handleLocateMe}
          onResetNorth={resetNorth}
          isLocating={isTracking}
          containerRef={containerRef}
        />
      )}

      {/* Map Complaint Markers */}
      {isLoaded && complaints.length > 0 && (
        <MapMarkers
          map={map}
          complaints={complaints}
          selectedComplaintId={selectedComplaintId}
          onSelectComplaint={onSelectComplaint}
        />
      )}

      {/* Custom Children (e.g. Navigation HUD or Pin Selector) */}
      {children && children({ map, isLoaded })}
    </div>
  );
}
