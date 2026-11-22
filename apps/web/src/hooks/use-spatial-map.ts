"use client";

import { useEffect, useRef, useCallback } from "react";
import { Coordinates, OlaMapMode } from "@civictrack/contracts";
import { useOlaMap } from "./use-ola-map";
import { useGeolocation } from "./use-geolocation";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from "../lib/ola-maps-config";
import { MapComplaintItem, isValidCoordinatePair } from "./use-complaint-markers";

export interface UseSpatialMapOptions {
  containerId: string;
  initialCenter?: Coordinates;
  initialZoom?: number;
  initialMode?: OlaMapMode;
  selectedComplaintId?: string | null;
  complaints?: MapComplaintItem[];
  autoLocate?: boolean;
  onMapClick?: (coords: Coordinates) => void;
}

export function useSpatialMap(options: UseSpatialMapOptions) {
  const {
    containerId,
    initialCenter = DEFAULT_MAP_CENTER,
    initialZoom = DEFAULT_MAP_ZOOM,
    initialMode = "default-light",
    selectedComplaintId,
    complaints = [],
    autoLocate = true,
    onMapClick,
  } = options;

  const mapControls = useOlaMap({
    containerId,
    initialCenter,
    initialZoom,
    initialMode,
    onMapClick,
  });

  const {
    coords: userLocation,
    accuracy: locationAccuracy,
    isTracking,
    permissionGranted,
    getCurrentPosition,
  } = useGeolocation(autoLocate);

  const hasAutoCenteredOnUserRef = useRef(false);
  const lastFlownComplaintIdRef = useRef<string | null>(null);

  // 1. When user location resolves for the first time, center map on user (if no complaint is selected)
  useEffect(() => {
    if (!mapControls.isLoaded || !mapControls.map) return;
    if (hasAutoCenteredOnUserRef.current) return;

    if (userLocation && isValidCoordinatePair(userLocation)) {
      if (!selectedComplaintId) {
        mapControls.flyTo(userLocation, 14);
      }
      hasAutoCenteredOnUserRef.current = true;
    }
  }, [mapControls.isLoaded, mapControls.map, userLocation, selectedComplaintId, mapControls]);

  // 2. Camera synchronization: When selectedComplaintId changes, smoothly fly to its coordinates
  useEffect(() => {
    if (!mapControls.isLoaded || !mapControls.map) return;
    if (!selectedComplaintId) {
      lastFlownComplaintIdRef.current = null;
      return;
    }

    if (lastFlownComplaintIdRef.current === selectedComplaintId) {
      return; // Already focused on this complaint
    }

    const complaint = complaints.find((c) => c && c.id === selectedComplaintId);
    if (complaint && complaint.location && isValidCoordinatePair(complaint.location.coordinates)) {
      lastFlownComplaintIdRef.current = selectedComplaintId;
      mapControls.flyTo(complaint.location.coordinates, 16);
    }
  }, [selectedComplaintId, complaints, mapControls.isLoaded, mapControls.map, mapControls]);

  // Handler for manual "Locate Me" button
  const handleLocateMe = useCallback(async () => {
    try {
      const coords = await getCurrentPosition();
      mapControls.flyTo(coords, 16);
    } catch {
      // Gracefully handled in useGeolocation hook
    }
  }, [getCurrentPosition, mapControls]);

  return {
    ...mapControls,
    userLocation,
    locationAccuracy,
    isLocating: isTracking,
    permissionGranted,
    handleLocateMe,
  };
}
