"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Coordinates, OlaMapMode } from "@civictrack/contracts";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OLA_MAPS_ENDPOINTS,
  getClientOlaMapsApiKey,
} from "../lib/ola-maps-config";

const OLA_STYLE_ICON_FALLBACKS = new Set([
  "ola-mobility-fastcharger",
  "ola-mbo",
  "pedestrian_polygon",
]);

function createGenericFallbackImage(imageId: string): ImageData {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return { width: 1, height: 1, data: new Uint8ClampedArray(4) } as unknown as ImageData;
  }

  if (imageId.includes("polygon") || imageId.includes("pattern") || imageId.includes("pedestrian")) {
    context.fillStyle = "rgba(203, 213, 225, 0.25)";
    context.fillRect(0, 0, size, size);
  } else {
    context.clearRect(0, 0, size, size);
  }

  return context.getImageData(0, 0, size, size);
}

function createOlaStyleIconFallback(imageId: string): ImageData {
  if (imageId === "pedestrian_polygon") {
    return createGenericFallbackImage(imageId);
  }

  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create fallback map icon");

  // Keep OLA's missing POI markers visible as clear, neutral map pins.
  context.fillStyle = "#1769aa";
  context.beginPath();
  context.arc(size / 2, 13, 10, Math.PI, 0);
  context.lineTo(16, 30);
  context.lineTo(6, 13);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffffff";
  if (imageId === "ola-mobility-fastcharger") {
    context.beginPath();
    context.moveTo(18, 5);
    context.lineTo(11, 15);
    context.lineTo(15, 15);
    context.lineTo(13, 22);
    context.lineTo(21, 12);
    context.lineTo(17, 12);
    context.closePath();
    context.fill();
  } else {
    context.beginPath();
    context.arc(16, 13, 4, 0, Math.PI * 2);
    context.fill();
  }

  return context.getImageData(0, 0, size, size);
}

// Benign Ola Maps SDK warnings are no longer suppressed via console monkey-patching.

export interface UseOlaMapOptions {
  containerId: string;
  initialCenter?: Coordinates;
  initialZoom?: number;
  initialMode?: OlaMapMode;
  onMapClick?: (coords: Coordinates) => void;
}

export function useOlaMap(options: UseOlaMapOptions) {
  const {
    containerId,
    initialCenter = DEFAULT_MAP_CENTER,
    initialZoom = DEFAULT_MAP_ZOOM,
    initialMode = "default-light",
    onMapClick,
  } = options;

  const [map, setMap] = useState<any | null>(null);
  const [mode, setModeState] = useState<OlaMapMode>(initialMode);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapInstanceRef = useRef<any | null>(null);
  const olaMapsSdkRef = useRef<any | null>(null);
  const currentCenterRef = useRef<Coordinates>(initialCenter);
  const currentZoomRef = useRef<number>(initialZoom);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Initialize Ola Map
  const initializeMap = useCallback(
    async (targetMode: OlaMapMode) => {
      if (typeof window === "undefined" || !containerId) return;

      const container = document.getElementById(containerId);
      if (!container) {
        setError(`Map container element #${containerId} not found in DOM`);
        setIsLoading(false);
        return;
      }

      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      setIsLoading(true);
      setError(null);

      try {
        const apiKey = getClientOlaMapsApiKey();
        if (!apiKey) {
          throw new Error("Ola Maps API key is not configured.");
        }

        // Dynamically import OlaMaps SDK on client only
        const { OlaMaps } = await import("olamaps-web-sdk");

        // Clean up any existing map instance safely
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
          } catch {
            // ignore cleanup errors on old instance
          }
          mapInstanceRef.current = null;
        }

        // Configure mode & style parameters
        const is3D = targetMode === "3d";
        const styleUrl =
          targetMode === "satellite"
            ? OLA_MAPS_ENDPOINTS.SATELLITE_STYLE
            : OLA_MAPS_ENDPOINTS.DEFAULT_LIGHT_STYLE;

        const olaMaps = new OlaMaps({
          apiKey,
          mode: is3D ? "3d" : "2d",
          threedTileset: is3D ? OLA_MAPS_ENDPOINTS.THREED_TILESET : undefined,
        });
        olaMapsSdkRef.current = olaMaps;

        const mapInstance = await olaMaps.init({
          style: styleUrl,
          container: containerId,
          center: currentCenterRef.current,
          zoom: currentZoomRef.current,
          pitch: is3D ? 60 : 0,
          bearing: 0,
        });

        // The OLA base style references these sprite IDs, but some style responses
        // omit them. Supply local fallbacks so the map can still render those POIs.
        const addMissingOlaStyleImage = (event: { id?: string }) => {
          const imageId = event?.id;
          if (!imageId) return;

          try {
            if (!mapInstance.hasImage(imageId)) {
              if (OLA_STYLE_ICON_FALLBACKS.has(imageId)) {
                mapInstance.addImage(imageId, createOlaStyleIconFallback(imageId));
              } else {
                mapInstance.addImage(imageId, createGenericFallbackImage(imageId));
              }
            }
          } catch {
            // Silently ignore if image was already registered or handled
          }
        };

        mapInstance.on("styleimagemissing", addMissingOlaStyleImage);
        // Register eagerly for MapLibre versions where the first missing-image
        // event can fire before the handler is attached.
        for (const imageId of OLA_STYLE_ICON_FALLBACKS) {
          addMissingOlaStyleImage({ id: imageId });
        }

        // If component unmounted while initializing, dispose instance immediately
        if (!isMountedRef.current) {
          try {
            mapInstance.remove();
          } catch {
            // ignore cleanup errors
          }
          return;
        }

        // 1. Suppress unhandled MapLibre error logging for non-existent 3D model vector layers or aborted requests
        mapInstance.on("error", (e: any) => {
          const err = e?.error || e;
          const msg = err?.message || String(err || "");
          if (
            err?.name === "AbortError" ||
            msg.includes("signal is aborted") ||
            msg.includes("aborted without reason") ||
            msg.includes("The operation was aborted") ||
            msg.includes('Source layer "3d_model"') ||
            msg.includes("3d_model_data")
          ) {
            return;
          }
          console.warn("Ola Maps map event:", msg);
        });

        // 2. Remove problematic 3d_model_data layer from style to prevent MapLibre from querying non-existent source layer
        const removeProblematic3DLayers = () => {
          try {
            if (mapInstance.getLayer("3d_model_data")) {
              mapInstance.removeLayer("3d_model_data");
            }
          } catch {
            // Layer may not exist in current style
          }
        };

        mapInstance.on("styledata", removeProblematic3DLayers);
        mapInstance.on("style.load", removeProblematic3DLayers);

        mapInstance.on("load", () => {
          removeProblematic3DLayers();
          setIsLoaded(true);
          setIsLoading(false);
        });

        // Track current center and zoom
        mapInstance.on("moveend", () => {
          try {
            const center = mapInstance.getCenter();
            currentCenterRef.current = [center.lng, center.lat];
            currentZoomRef.current = mapInstance.getZoom();
          } catch {
            // ignore if map disposed
          }
        });

        // Click handler for location picking
        if (onMapClick) {
          mapInstance.on("click", (e: any) => {
            if (e.lngLat) {
              onMapClick([e.lngLat.lng, e.lngLat.lat]);
            }
          });
        }

        mapInstanceRef.current = mapInstance;
        setMap(mapInstance);
        setIsLoaded(true);
        setIsLoading(false);
      } catch (err: any) {
        console.error("Ola Maps SDK initialization error:", err);
        setError(err.message || "Failed to load Ola Maps SDK");
        setIsLoading(false);
      } finally {
        isInitializingRef.current = false;
      }
    },
    [containerId, onMapClick]
  );

  // Switch map modes smoothly
  const setMode = useCallback(
    async (newMode: OlaMapMode) => {
      if (newMode === mode) return;
      setModeState(newMode);

      const mapInstance = mapInstanceRef.current;
      if (!mapInstance) {
        await initializeMap(newMode);
        return;
      }

      // If switching between 2D light and 2D satellite, update style directly
      if (mode !== "3d" && newMode !== "3d") {
        try {
          const styleUrl =
            newMode === "satellite"
              ? OLA_MAPS_ENDPOINTS.SATELLITE_STYLE
              : OLA_MAPS_ENDPOINTS.DEFAULT_LIGHT_STYLE;
          mapInstance.setStyle(styleUrl);
          mapInstance.setPitch(0);
        } catch {
          // If setStyle throws, re-initialize
          await initializeMap(newMode);
        }
      } else {
        // Switching to or from 3D requires initializing with 3D mode flag
        await initializeMap(newMode);
      }
    },
    [mode, initializeMap]
  );

  // Navigation and camera controls
  const flyTo = useCallback((coords: Coordinates, zoom = 15) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: coords,
        zoom,
        essential: true,
      });
    }
  }, []);

  const zoomIn = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  }, []);

  const resetNorth = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.resetNorth();
    }
  }, []);

  // Mount effect
  useEffect(() => {
    isMountedRef.current = true;
    initializeMap(initialMode);

    return () => {
      isMountedRef.current = false;
      if (mapInstanceRef.current) {
        const instance = mapInstanceRef.current;
        mapInstanceRef.current = null;
        try {
          instance.remove();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [initializeMap, initialMode]);

  return {
    map,
    olaMaps: olaMapsSdkRef.current,
    mode,
    setMode,
    isLoading,
    isLoaded,
    error,
    retry: () => initializeMap(mode),
    flyTo,
    zoomIn,
    zoomOut,
    resetNorth,
  };
}
