"use client";

import { useMemo } from "react";
import { Coordinates, GeoJsonPoint, ComplaintCategory, ComplaintStatus, ComplaintPriority } from "@civictrack/contracts";

export interface MapComplaintItem {
  id: string;
  referenceNumber: string;
  title: string;
  description?: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority?: ComplaintPriority | string;
  location: GeoJsonPoint;
  address: string;
  createdAt?: string | Date;
}

export interface MarkerCluster {
  id: string;
  coordinates: Coordinates;
  complaints: MapComplaintItem[];
}

/**
 * Validates that coordinates array contains valid numbers in proper longitude/latitude range.
 */
export function isValidCoordinatePair(coords: unknown): coords is Coordinates {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const lng = typeof coords[0] === "number" ? coords[0] : Number(coords[0]);
  const lat = typeof coords[1] === "number" ? coords[1] : Number(coords[1]);
  return (
    !isNaN(lng) &&
    !isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/**
 * Hook to filter, sanitize, and validate complaints for spatial map rendering.
 */
export function useComplaintMarkers(complaints: MapComplaintItem[]) {
  const validComplaints = useMemo(() => {
    if (!Array.isArray(complaints)) return [];
    return complaints.filter((c) => {
      if (!c || !c.location || !isValidCoordinatePair(c.location.coordinates)) {
        return false;
      }
      return true;
    });
  }, [complaints]);

  return {
    validComplaints,
    totalCount: complaints?.length || 0,
    validCount: validComplaints.length,
    hasMissingCoordinates: (complaints?.length || 0) > validComplaints.length,
  };
}
