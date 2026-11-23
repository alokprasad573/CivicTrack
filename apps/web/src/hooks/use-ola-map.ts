"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Coordinates, OlaMapMode } from "@civictrack/contracts";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  OLA_MAPS_ENDPOINTS,
  getClientOlaMapsApiKey,
} from "../lib/ola-maps-config";

function isBenignOlaMapError(arg: any): boolean {
  if (!arg) return false;
  if (arg instanceof Error || (typeof arg === "object" && arg !== null)) {
    if (arg.name === "AbortError") return true;
    const msg = arg.message || "";
    if (
      msg.includes("signal is aborted") ||
      msg.includes("aborted without reason") ||
      msg.includes("The operation was aborted") ||
      msg.includes("The user aborted a request") ||
      msg.includes('Source layer "3d_model"') ||
      msg.includes("3d_model_data")
    ) {
      return true;
    }
  }
  if (typeof arg === "string") {
    if (
      arg.includes("signal is aborted") ||
      arg.includes("aborted without reason") ||
      arg.includes("The operation was aborted") ||
      arg.includes("The user aborted a request") ||
      arg.includes('Source layer "3d_model"') ||
      arg.includes("3d_model_data") ||
      arg.includes("AbortError")
    ) {
      return true;
    }
  }
  return false;
}

// Intercept and suppress known benign Ola Maps SDK style warnings and fetch AbortErrors during teardown
if (typeof window !== "undefined" && !(window as any).__olamaps_console_patched) {
  (window as any).__olamaps_console_patched = true;
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (args.some(isBenignOlaMapError)) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isBenignOlaMapError(event.reason)) {
      event.preventDefault();
    }
  });
}

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
