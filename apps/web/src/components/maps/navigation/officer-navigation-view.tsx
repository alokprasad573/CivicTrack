"use client";

import React, { useEffect } from "react";
import { Coordinates } from "@civictrack/contracts";
import { OlaMap } from "../ola-map";
import { RouteLayer } from "./route-layer";
import { NavigationPanel } from "./navigation-panel";
import { useNavigation } from "../../../hooks/use-navigation";
import { MapComplaintItem } from "../map-markers";
import { Navigation, AlertCircle } from "lucide-react";

export interface OfficerNavigationViewProps {
  complaint: MapComplaintItem;
  className?: string;
}

export function OfficerNavigationView({
  complaint,
  className = "w-full h-[600px]",
}: OfficerNavigationViewProps) {
  const {
    state,
    route,
    currentStep,
    remainingDistanceMeters,
    remainingDurationSeconds,
    currentGps,
    gpsHeading,
    isVoiceMuted,
    errorMessage,
    requestRoute,
    startNavigation,
    pauseNavigation,
    resumeNavigation,
    stopNavigation,
    toggleVoice,
  } = useNavigation();

  const destinationCoords: Coordinates = complaint.location.coordinates;

  // Auto calculate route on mount
  useEffect(() => {
    requestRoute(destinationCoords);
  }, [destinationCoords, requestRoute]);

  return (
    <div className={`relative flex flex-col rounded-2xl overflow-hidden border border-border bg-card shadow-2xl ${className}`}>
      {/* Officer Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <Navigation className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary font-mono">
                {complaint.referenceNumber}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-xs">
                {complaint.title}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              📍 Destination: {complaint.address}
            </p>
          </div>
        </div>

        {state === "IDLE" && (
          <button
            type="button"
            onClick={() => requestRoute(destinationCoords)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5 fill-primary-foreground" />
            <span>Recalculate Route</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Interactive Ola Map */}
      <div className="relative flex-1 w-full h-full">
        <OlaMap
          initialCenter={destinationCoords}
          initialZoom={14}
          complaints={[complaint]}
          selectedComplaintId={complaint.id}
          className="w-full h-full rounded-none border-none"
        >
          {({ map, isLoaded }) => {
            if (!isLoaded || !map) return null;

            return (
              <>
                <RouteLayer
                  map={map}
                  route={route}
                  currentGps={currentGps}
                  isNavigating={state === "NAVIGATING"}
                  heading={gpsHeading}
                />

                <NavigationPanel
                  state={state}
                  currentStep={currentStep}
                  remainingDistanceMeters={remainingDistanceMeters}
                  remainingDurationSeconds={remainingDurationSeconds}
                  isVoiceMuted={isVoiceMuted}
                  onStart={startNavigation}
                  onPause={pauseNavigation}
                  onResume={resumeNavigation}
                  onStop={stopNavigation}
                  onToggleVoice={toggleVoice}
                />
              </>
            );
          }}
        </OlaMap>
      </div>
    </div>
  );
}
