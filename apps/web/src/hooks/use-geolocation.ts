"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Coordinates } from "@civictrack/contracts";
import { DEFAULT_MAP_CENTER } from "../lib/ola-maps-config";

export interface GeolocationState {
  coords: Coordinates | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  error: string | null;
  isTracking: boolean;
  permissionGranted: boolean;
  source: "gps" | "network" | "ip" | "default" | null;
}

export function useGeolocation(autoStart = false) {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    accuracy: null,
    heading: null,
    speed: null,
    error: null,
    isTracking: false,
    permissionGranted: false,
    source: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const isResolvingRef = useRef<boolean>(false);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setState((prev) => ({ ...prev, isTracking: false }));
    }
  }, []);

  const handleSuccess = useCallback(
    (pos: GeolocationPosition, source: "gps" | "network" = "gps") => {
      // MongoDB GeoJSON format: [longitude, latitude]
      const coords: Coordinates = [pos.coords.longitude, pos.coords.latitude];
      setState({
        coords,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
        error: null,
        isTracking: true,
        permissionGranted: true,
        source,
      });
    },
    []
  );

  const handleError = useCallback((err: GeolocationPositionError) => {
    let message = "Unable to retrieve GPS location";
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = "Location access denied. Please click the map or search to set location.";
        break;
      case err.POSITION_UNAVAILABLE:
        message = "GPS satellite signal unavailable indoors. Using network estimation.";
        break;
      case err.TIMEOUT:
        message = "GPS query timed out. Using network estimation.";
        break;
    }
    setState((prev) => ({
      ...prev,
      error: message,
      isTracking: false,
    }));
  }, []);

  /**
   * Resilient, multi-tier geolocation resolver:
   * 1. Try high accuracy (GPS hardware) with 4s timeout.
   * 2. If it times out or is unavailable (common on PCs/laptops indoors), immediately try network/Wi-Fi estimation.
   * 3. If browser blocks geolocation, query approximate IP location or provide municipal default.
   */
  const getCurrentPosition = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        const fallback = DEFAULT_MAP_CENTER;
        setState((prev) => ({
          ...prev,
          coords: fallback,
          accuracy: 5000,
          source: "default",
          error: "Browser geolocation not supported.",
        }));
        resolve(fallback);
        return;
      }

      setState((prev) => ({ ...prev, isTracking: true, error: null }));

      // Tier 1: Try high-accuracy GPS with a short timeout
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: Coordinates = [pos.coords.longitude, pos.coords.latitude];
          handleSuccess(pos, "gps");
          resolve(coords);
        },
        (err) => {
          // If user specifically clicked "Block" in browser permission prompt
          if (err.code === err.PERMISSION_DENIED) {
            handleError(err);
            const fallback = DEFAULT_MAP_CENTER;
            setState((prev) => ({
              ...prev,
              coords: fallback,
              accuracy: 5000,
              source: "default",
              permissionGranted: false,
            }));
            resolve(fallback);
            return;
          }

          // Tier 2: Try standard/network accuracy (Wi-Fi triangulation) with relaxed timeout
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              const coords: Coordinates = [pos2.coords.longitude, pos2.coords.latitude];
              handleSuccess(pos2, "network");
              resolve(coords);
            },
            () => {
              // Tier 3: Fall back to municipal center (no external IP lookup)
              const fallback = DEFAULT_MAP_CENTER;
              setState((prev) => ({
                ...prev,
                coords: fallback,
                accuracy: 5000,
                isTracking: false,
                source: "default",
                error: "Location estimated from municipal zone. Click map to refine.",
              }));
              resolve(fallback);
            },
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 60000,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 10000,
        }
      );
    });
  }, [handleSuccess, handleError]);

  const startTracking = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    if (watchIdRef.current !== null) return;

    // Immediately resolve initial position using multi-tier strategy
    if (!isResolvingRef.current) {
      isResolvingRef.current = true;
      getCurrentPosition().finally(() => {
        isResolvingRef.current = false;
      });
    }

    // Then maintain continuous watch with network fallback
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => handleSuccess(pos, "gps"),
        (err) => {
          if (err.code !== err.PERMISSION_DENIED) {
            navigator.geolocation.getCurrentPosition(
              (pos2) => handleSuccess(pos2, "network"),
              () => {},
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
            );
          }
        },
        {
          enableHighAccuracy: false, // Prevents continuous satellite timeouts on PCs
          timeout: 10000,
          maximumAge: 15000,
        }
      );
    } catch {
      // Ignore watch startup errors
    }
  }, [getCurrentPosition, handleSuccess]);

  useEffect(() => {
    if (autoStart) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [autoStart, startTracking, stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    getCurrentPosition,
  };
}
