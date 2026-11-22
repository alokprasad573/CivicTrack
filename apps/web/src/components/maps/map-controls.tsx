"use client";

import React, { useState } from "react";
import { OlaMapMode, Coordinates } from "@civictrack/contracts";
import {
  Sun,
  Globe,
  Box,
  Plus,
  Minus,
  Locate,
  Compass,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";

export interface MapControlsProps {
  currentMode: OlaMapMode;
  onModeChange: (mode: OlaMapMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateMe: () => void;
  onResetNorth: () => void;
  isLocating?: boolean;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export function MapControls({
  currentMode,
  onModeChange,
  onZoomIn,
  onZoomOut,
  onLocateMe,
  onResetNorth,
  isLocating = false,
  containerRef,
}: MapControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!containerRef?.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 pointer-events-auto">
      {/* Map Mode Selector */}
      <div className="flex bg-card/95 backdrop-blur-md border border-border rounded-lg p-1 shadow-xl">
        <button
          type="button"
          onClick={() => onModeChange("default-light")}
          title="Default Light Mode"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            currentMode === "default-light"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange("satellite")}
          title="Satellite Imagery"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            currentMode === "satellite"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>

        <button
          type="button"
          onClick={() => onModeChange("3d")}
          title="3D Building Tiles"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            currentMode === "3d"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>3D View</span>
        </button>
      </div>

      {/* Navigation & Camera Controls */}
      <div className="flex flex-col bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden self-end">
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors border-b border-border/50"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors border-b border-border/50"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onLocateMe}
          disabled={isLocating}
          title="Find My Location"
          className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors border-b border-border/50 disabled:opacity-50"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          ) : (
            <Locate className="w-4 h-4" />
          )}
        </button>

        <button
          type="button"
          onClick={onResetNorth}
          title="Reset Bearing (North Up)"
          className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors border-b border-border/50"
        >
          <Compass className="w-4 h-4" />
        </button>

        {containerRef && (
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary/60 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
