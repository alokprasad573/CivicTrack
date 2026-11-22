"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Coordinates } from "@civictrack/contracts";

export interface GeolocationState {
  coords: Coordinates | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  error: string | null;
  isTracking: boolean;
  permissionGranted: boolean;
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
  });

  const watchIdRef = useRef<number | null>(null);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setState((prev) => ({ ...prev, isTracking: false }));
    }
  }, []);

  const handleSuccess = useCallback((pos: GeolocationPosition) => {
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
    });
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    let message = "Unable to retrieve GPS location";
    switch (err.code) {
      case err.PERMISSION_DENIED:
        message = "Location permission denied. Please enable GPS in browser settings.";
        break;
      case err.POSITION_UNAVAILABLE:
        message = "GPS position unavailable. Check signal or try manual coordinates.";
        break;
      case err.TIMEOUT:
        message = "GPS location request timed out.";
        break;
    }
    setState((prev) => ({
      ...prev,
      error: message,
      isTracking: false,
      permissionGranted: false,
    }));
  }, []);

  const startTracking = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
      }));
      return;
    }

    if (watchIdRef.current !== null) return; // Prevent duplicate watchers

    setState((prev) => ({ ...prev, isTracking: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );
  }, [handleSuccess, handleError]);

  const getCurrentPosition = useCallback((): Promise<Coordinates> => {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Geolocation is not supported by your browser"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: Coordinates = [pos.coords.longitude, pos.coords.latitude];
          setState((prev) => ({
            ...prev,
            coords,
            accuracy: pos.coords.accuracy,
            permissionGranted: true,
            error: null,
          }));
          resolve(coords);
        },
        (err) => {
          handleError(err);
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, [handleError]);

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
