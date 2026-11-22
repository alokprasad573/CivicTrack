"use client";

import { MapMarkerLayer, MapMarkerLayerProps } from "./map-marker-layer";
import { MapComplaintItem } from "../../hooks/use-complaint-markers";

export type { MapComplaintItem };
export type MapMarkersProps = MapMarkerLayerProps;

/**
 * Re-export MapMarkerLayer as MapMarkers for backwards compatibility.
 */
export function MapMarkers(props: MapMarkersProps) {
  return <MapMarkerLayer {...props} />;
}
