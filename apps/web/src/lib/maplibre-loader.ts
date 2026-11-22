"use client";

import type * as MapLibreGL from "maplibre-gl";

let mapLibrePromise: Promise<typeof MapLibreGL> | null = null;

/**
 * Client-only dynamic loader for maplibre-gl / Ola Maps compatible constructors.
 * Prevents Node.js SSR from attempting to evaluate WebGL/DOM modules in Webpack/Turbopack.
 * Ensures Marker, Popup, and controls are 100% version-aligned with the underlying Ola Maps map instance.
 */
export async function getMapLibre(): Promise<typeof MapLibreGL> {
  if (typeof window === "undefined") {
    throw new Error("maplibre-gl cannot be evaluated on the server");
  }
  if (!mapLibrePromise) {
    mapLibrePromise = (async () => {
      // 1. If OlaMaps SDK is available and has initialized static properties, use them directly
      try {
        const { OlaMaps } = await import("olamaps-web-sdk");
        if ((OlaMaps as any)?._marker && (OlaMaps as any)?._popup) {
          return {
            Marker: (OlaMaps as any)._marker,
            Popup: (OlaMaps as any)._popup,
            NavigationControl: (OlaMaps as any)._navigationControl,
            GeolocateControl: (OlaMaps as any)._geolocateControl,
            LngLat: (OlaMaps as any)._lngLat,
            LngLatBounds: (OlaMaps as any)._lngLatBounds,
          } as unknown as typeof MapLibreGL;
        }
      } catch {
        // Fall back to maplibre-gl package
      }

      // 2. Load aligned maplibre-gl package (v5.12.0)
      const mod = await import("maplibre-gl");
      return (mod.default || mod) as unknown as typeof MapLibreGL;
    })();
  }
  return mapLibrePromise;
}
