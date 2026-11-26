import {
  Coordinates,
  GeocodeResult,
  ManeuverType,
  NavigationStep,
  RouteCalculationResult,
} from "@civictrack/contracts";
import { getOlaMapsApiKey, isOlaMapsConfigured } from "../../config/maps.js";
import { env } from "../../config/env.js";
import { ServiceUnavailableError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

/**
 * Calculates Haversine distance in meters between two [longitude, latitude] coordinates
 */
export function calculateDistanceMeters(p1: Coordinates, p2: Coordinates): number {
  const R = 6371000; // Earth's mean radius in meters
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

export class OlaMapsAdapter {
  private static readonly BASE_URL = "https://api.olamaps.io";

  /**
   * Reverse geocode coordinates [longitude, latitude] to human-readable address
   */
  public static async reverseGeocode(coords: Coordinates): Promise<GeocodeResult> {
    const [lng, lat] = coords;
    const apiKey = getOlaMapsApiKey();

    if (isOlaMapsConfigured() && apiKey) {
      try {
        const url = `${this.BASE_URL}/places/v1/reverse-geocode?latlng=${lat},${lng}&api_key=${apiKey}`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const json = (await res.json()) as any;
          if (json.results && json.results.length > 0) {
            const first = json.results[0];
            return {
              formattedAddress: first.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
              street: first.name,
              landmark: first.vicinity,
              city: first.compound_code,
              coordinates: coords,
            };
          }
        }
      } catch (err) {
        logger.warn("Ola Maps reverse geocoding API error, falling back to local resolver", {
          error: err instanceof Error ? err.message : String(err),
          coords,
        });
      }
    }

    if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
      throw new ServiceUnavailableError(
        "Live geocoding service is currently unavailable",
        "GEOCODING_UNAVAILABLE"
      );
    }

    // High-fidelity fallback resolver for development and offline testing
    return {
      formattedAddress: `Civic Sector ${Math.floor(Math.abs(lat * 10) % 20) + 1}, ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
      street: `Road ${Math.floor(Math.abs(lng * 10) % 15) + 1}`,
      city: "Municipal Jurisdiction",
      state: "Karnataka",
      country: "India",
      coordinates: coords,
    };
  }

  /**
   * Forward geocode search query string to coordinates and address
   */
  public static async forwardGeocode(query: string): Promise<GeocodeResult[]> {
    const apiKey = getOlaMapsApiKey();

    if (isOlaMapsConfigured() && apiKey) {
      try {
        const url = `${this.BASE_URL}/places/v1/geocode?address=${encodeURIComponent(query)}&api_key=${apiKey}`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const json = (await res.json()) as any;
          if (json.geocodingResults && Array.isArray(json.geocodingResults)) {
            return json.geocodingResults.map((r: any) => ({
              formattedAddress: r.formatted_address,
              coordinates: [r.geometry.location.lng, r.geometry.location.lat] as Coordinates,
            }));
          }
        }
      } catch (err) {
        logger.warn("Ola Maps forward geocoding API error", {
          error: err instanceof Error ? err.message : String(err),
          query,
        });
      }
    }

    if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
      throw new ServiceUnavailableError(
        "Live address search is currently unavailable",
        "GEOCODING_UNAVAILABLE"
      );
    }

    // Fallback search suggestions for development and offline testing
    return [
      {
        formattedAddress: `${query}, Main Civic Road, Bangalore, Karnataka`,
        coordinates: [77.5946, 12.9716],
      },
    ];
  }

  /**
   * Calculate real driving directions and turn-by-turn maneuvers between origin and destination
   */
  public static async calculateDirections(params: {
    origin: Coordinates;
    destination: Coordinates;
  }): Promise<RouteCalculationResult> {
    const { origin, destination } = params;
    const apiKey = getOlaMapsApiKey();

    if (isOlaMapsConfigured() && apiKey) {
      try {
        // Supported Ola Maps directions endpoint: origin=lat,lng&destination=lat,lng
        const url = `${this.BASE_URL}/routing/v1/directions?origin=${origin[1]},${origin[0]}&destination=${destination[1]},${destination[0]}&mode=driving&api_key=${apiKey}`;
        const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.routes && data.routes.length > 0) {
            const primaryRoute = data.routes[0];
            const leg = primaryRoute.legs?.[0];

            if (leg) {
              const steps: NavigationStep[] = (leg.steps || []).map((step: any) => ({
                instruction: step.instructions || step.maneuver?.instruction || "Continue along route",
                maneuver: (step.maneuver?.type as ManeuverType) || "continue",
                distanceMeters: Math.round(step.distance || 0),
                durationSeconds: Math.round(step.duration || 0),
                roadName: step.name || "Main Road",
                location: [step.start_location?.lng ?? origin[0], step.start_location?.lat ?? origin[1]],
              }));

              // Extract route polyline geometry if provided as GeoJSON or decoded coordinates
              const coordinates: Coordinates[] = primaryRoute.geometry?.coordinates || [
                origin,
                destination,
              ];

              return {
                distanceMeters: Math.round(leg.distance || calculateDistanceMeters(origin, destination)),
                durationSeconds: Math.round(leg.duration || 600),
                geometry: {
                  type: "LineString",
                  coordinates,
                },
                steps,
                origin,
                destination,
              };
            }
          }
        }
      } catch (err) {
        logger.warn("Ola Maps Directions API error", {
          error: err instanceof Error ? err.message : String(err),
          origin,
          destination,
        });
      }
    }

    if (process.env.NODE_ENV === "production" || env.NODE_ENV === "production") {
      throw new ServiceUnavailableError(
        "Live turn-by-turn routing is currently unavailable",
        "ROUTING_UNAVAILABLE"
      );
    }

    // Deterministic geometric route estimation (development fallback only)
    return this.generateGeometricRoute(origin, destination);
  }

  /**
   * Deterministic geometric routing engine used for local development, testing,
   * and automatic failover when Ola Maps cloud routing service is unreachable.
   */
  private static generateGeometricRoute(
    origin: Coordinates,
    destination: Coordinates
  ): RouteCalculationResult {
    const totalDistanceMeters = calculateDistanceMeters(origin, destination);
    // Average urban driving speed: 30 km/h = 8.33 m/s
    const totalDurationSeconds = Math.max(60, Math.round(totalDistanceMeters / 8.33));

    // Construct 4-segment polyline path simulating urban road network
    const mid1: Coordinates = [
      origin[0] + (destination[0] - origin[0]) * 0.35,
      origin[1] + (destination[1] - origin[1]) * 0.1,
    ];
    const mid2: Coordinates = [
      origin[0] + (destination[0] - origin[0]) * 0.65,
      origin[1] + (destination[1] - origin[1]) * 0.5,
    ];
    const mid3: Coordinates = [
      origin[0] + (destination[0] - origin[0]) * 0.85,
      origin[1] + (destination[1] - origin[1]) * 0.85,
    ];

    const polylineCoordinates: Coordinates[] = [
      origin,
      mid1,
      mid2,
      mid3,
      destination,
    ];

    const steps: NavigationStep[] = [
      {
        instruction: "Straight-line route estimate (Live routing unavailable in development)",
        maneuver: "depart",
        distanceMeters: Math.round(totalDistanceMeters * 0.5),
        durationSeconds: Math.round(totalDurationSeconds * 0.5),
        roadName: "Direct Trajectory",
        location: origin,
      },
      {
        instruction: "Arrive at destination coordinates",
        maneuver: "arrive",
        distanceMeters: Math.round(totalDistanceMeters * 0.5),
        durationSeconds: Math.round(totalDurationSeconds * 0.5),
        roadName: "Destination Site",
        location: destination,
      },
    ];

    return {
      distanceMeters: totalDistanceMeters,
      durationSeconds: totalDurationSeconds,
      geometry: {
        type: "LineString",
        coordinates: polylineCoordinates,
      },
      steps,
      origin,
      destination,
      isEstimated: true,
    };
  }
}
