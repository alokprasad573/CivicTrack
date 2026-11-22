import {
  Coordinates,
  GeocodeResult,
  RouteCalculationResult,
} from "@civictrack/contracts";
import { OlaMapsAdapter } from "./ola-maps.adapter.js";
import { isOlaMapsConfigured } from "../../config/maps.js";

export class MapsService {
  public static async reverseGeocode(coords: Coordinates): Promise<GeocodeResult> {
    return OlaMapsAdapter.reverseGeocode(coords);
  }

  public static async forwardGeocode(query: string): Promise<GeocodeResult[]> {
    return OlaMapsAdapter.forwardGeocode(query);
  }

  public static async calculateDirections(params: {
    origin: Coordinates;
    destination: Coordinates;
  }): Promise<RouteCalculationResult> {
    return OlaMapsAdapter.calculateDirections(params);
  }

  public static getStatus(): { isConfigured: boolean; provider: string } {
    return {
      isConfigured: isOlaMapsConfigured(),
      provider: "Ola Maps Web SDK v2 / Directions API",
    };
  }
}

/**
 * Calculate Great-Circle distance between two coordinates in kilometers using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
