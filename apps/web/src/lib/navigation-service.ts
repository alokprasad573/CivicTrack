import {
  Coordinates,
  DirectionsRequest,
  RouteCalculationResult,
} from "@civictrack/contracts";

/**
 * Calculates Haversine distance in meters between two [lng, lat] points
 */
export function calculateDistanceMeters(p1: Coordinates, p2: Coordinates): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1[1] * Math.PI) / 180) *
      Math.cos((p2[1] * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates the perpendicular distance from point P to line segment AB in meters
 */
export function distanceToSegmentMeters(
  p: Coordinates,
  a: Coordinates,
  b: Coordinates
): number {
  const l2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (l2 === 0) return calculateDistanceMeters(p, a);

  // Projection scalar t on AB
  let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
  t = Math.max(0, Math.min(1, t));

  const projection: Coordinates = [
    a[0] + t * (b[0] - a[0]),
    a[1] + t * (b[1] - a[1]),
  ];

  return calculateDistanceMeters(p, projection);
}

/**
 * Calculates the shortest distance from user GPS position to the route polyline in meters
 */
export function distanceToRouteMeters(
  point: Coordinates,
  routeCoordinates: Coordinates[]
): number {
  if (routeCoordinates.length < 2) return 0;
  let minDistance = Infinity;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const dist = distanceToSegmentMeters(
      point,
      routeCoordinates[i]!,
      routeCoordinates[i + 1]!
    );
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Request real route calculation from backend Ola Maps Directions service
 */
export async function calculateRoute(
  origin: Coordinates,
  destination: Coordinates
): Promise<RouteCalculationResult> {
  const payload: DirectionsRequest = {
    origin,
    destination,
    mode: "driving",
  };

  const res = await fetch("/api/v1/maps/directions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Directions service failed with HTTP ${res.status}`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || "Failed to calculate directions route");
  }

  return json.data;
}

/**
 * User-friendly distance formatter
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * User-friendly duration formatter
 */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min${mins === 1 ? "" : "s"}`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours} hr ${remainingMins} min`;
}

/**
 * Estimated Time of Arrival (ETA) formatter
 */
export function formatEta(seconds: number): string {
  const arrivalTime = new Date(Date.now() + seconds * 1000);
  return arrivalTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
