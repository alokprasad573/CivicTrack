import { z } from "zod";

/**
 * Coordinate tuple schema: [longitude, latitude]
 * MongoDB GeoJSON standard: Longitude (-180..180), Latitude (-90..90)
 */
export const CoordinatesSchema = z.tuple([
  z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
]);

export type Coordinates = [number, number];

/**
 * Map display modes supported by CivicTrack's Ola Maps integration
 */
export type OlaMapMode = "default-light" | "satellite" | "3d";

/**
 * Reverse geocoding query schema
 */
export const ReverseGeocodeQuerySchema = z.object({
  lng: z.coerce.number().min(-180).max(180),
  lat: z.coerce.number().min(-90).max(90),
});

export type ReverseGeocodeQuery = z.infer<typeof ReverseGeocodeQuerySchema>;

/**
 * Forward geocoding query schema
 */
export const ForwardGeocodeQuerySchema = z.object({
  query: z.string().trim().min(2, "Search query must be at least 2 characters"),
});

export type ForwardGeocodeQuery = z.infer<typeof ForwardGeocodeQuerySchema>;

/**
 * Unified geocoding address result
 */
export interface GeocodeResult {
  formattedAddress: string;
  street?: string;
  landmark?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  coordinates: Coordinates; // [lng, lat]
}

/**
 * Navigation maneuver types
 */
export type ManeuverType =
  | "depart"
  | "turn-left"
  | "turn-right"
  | "turn-slight-left"
  | "turn-slight-right"
  | "turn-sharp-left"
  | "turn-sharp-right"
  | "continue"
  | "u-turn"
  | "roundabout"
  | "merge"
  | "fork"
  | "arrive";

/**
 * Individual turn-by-turn instruction step
 */
export interface NavigationStep {
  instruction: string;
  maneuver: ManeuverType;
  distanceMeters: number;
  durationSeconds: number;
  roadName?: string;
  location: Coordinates; // [lng, lat]
}

/**
 * GeoJSON LineString geometry for route polyline
 */
export interface RouteGeometry {
  type: "LineString";
  coordinates: Coordinates[]; // Array of [lng, lat] points
}

/**
 * Comprehensive route calculation response
 */
export interface RouteCalculationResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RouteGeometry;
  steps: NavigationStep[];
  origin: Coordinates;
  destination: Coordinates;
}

/**
 * Directions request schema
 */
export const DirectionsRequestSchema = z.object({
  origin: CoordinatesSchema,
  destination: CoordinatesSchema,
  mode: z.enum(["driving", "walking"]).optional().default("driving"),
});

export type DirectionsRequest = z.infer<typeof DirectionsRequestSchema>;

/**
 * Officer Navigation state machine states
 */
export enum NavigationState {
  IDLE = "IDLE",
  ROUTE_LOADING = "ROUTE_LOADING",
  ROUTE_READY = "ROUTE_READY",
  NAVIGATING = "NAVIGATING",
  REROUTING = "REROUTING",
  PAUSED = "PAUSED",
  ARRIVED = "ARRIVED",
  ERROR = "ERROR",
}
