"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Coordinates } from "@civictrack/contracts";
import {
  Navigation,
  Compass,
  ArrowRight,
  ArrowUpRight,
  ArrowUpLeft,
  ArrowUp,
  RotateCcw,
  MapPin,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
} from "lucide-react";

export interface NavigationStep {
  instruction: string;
  maneuver: string;
  distanceMeters: number;
  durationSeconds: number;
  roadName: string;
  location?: [number, number];
}

export interface RouteData {
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: "LineString";
    coordinates: Coordinates[];
  };
  steps: NavigationStep[];
  origin: Coordinates;
  destination: Coordinates;
  isEstimated?: boolean;
}

export interface OfficerNavigationProps {
  mapInstance: any | null;
  destinationCoordinates: [number, number]; // [lng, lat]
  destinationAddress?: string;
  referenceNumber?: string;
  complaintTitle?: string;
  onClose?: () => void;
}

/**
 * Maps maneuver string to an appropriate Lucide icon
 */
function getManeuverIcon(maneuver: string) {
  const m = maneuver.toLowerCase();
  if (m.includes("left")) return ArrowUpLeft;
  if (m.includes("right")) return ArrowUpRight;
  if (m.includes("u-turn") || m.includes("uturn")) return RotateCcw;
  if (m.includes("arrive") || m.includes("destination")) return CheckCircle2;
  return ArrowUp;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} hr ${remMins} min`;
}

export function OfficerNavigation({
  mapInstance,
  destinationCoordinates,
  destinationAddress,
  referenceNumber,
  complaintTitle,
  onClose,
}: OfficerNavigationProps) {
  const [currentPosition, setCurrentPosition] = useState<Coordinates | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStepsDrawer, setShowStepsDrawer] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasArrived, setHasArrived] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const officerMarkerRef = useRef<any | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);

  // 1. Fetch directions route from backend API
  const fetchRoute = useCallback(
    async (origin: Coordinates) => {
      setIsLoadingRoute(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/maps/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            origin,
            destination: destinationCoordinates,
          }),
        });

        if (!res.ok) {
          throw new Error("Unable to calculate driving route to incident.");
        }

        const json = await res.json();
        if (json.success && json.data) {
          setRoute(json.data);
          setActiveStepIndex(0);
          drawRouteOnMap(json.data.geometry.coordinates, origin, destinationCoordinates);
        } else {
          throw new Error(json.error?.message || "Route calculation failed");
        }
      } catch (err: any) {
        setError(err.message || "Failed to establish navigation route.");
      } finally {
        setIsLoadingRoute(false);
      }
    },
    [destinationCoordinates]
  );

  // 2. Render route polyline on MapLibre / Ola Maps instance
  const drawRouteOnMap = useCallback(
    (coords: Coordinates[], origin: Coordinates, dest: Coordinates) => {
      if (!mapInstance) return;

      try {
        // Clean up previous route layers/sources if present
        if (mapInstance.getLayer("officer-route-line")) {
          mapInstance.removeLayer("officer-route-line");
        }
        if (mapInstance.getLayer("officer-route-casing")) {
          mapInstance.removeLayer("officer-route-casing");
        }
        if (mapInstance.getSource("officer-route-source")) {
          mapInstance.removeSource("officer-route-source");
        }

        // Add GeoJSON LineString source
        mapInstance.addSource("officer-route-source", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: coords,
            },
            properties: {},
          },
        });

        // Add Outer Casing Layer (dark contrast)
        mapInstance.addLayer({
          id: "officer-route-casing",
          type: "line",
          source: "officer-route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#1e3a8a",
            "line-width": 8,
            "line-opacity": 0.8,
          },
        });

        // Add Vibrant Driving Route Layer (Blue-Indigo gradient appearance)
        mapInstance.addLayer({
          id: "officer-route-line",
          type: "line",
          source: "officer-route-source",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });

        // Fit map bounds to encompass both origin and destination with padding
        const minLng = Math.min(origin[0], dest[0]);
        const maxLng = Math.max(origin[0], dest[0]);
        const minLat = Math.min(origin[1], dest[1]);
        const maxLat = Math.max(origin[1], dest[1]);

        if (typeof mapInstance.fitBounds === "function") {
          mapInstance.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: { top: 90, bottom: 120, left: 60, right: 60 }, duration: 1500 }
          );
        }
      } catch (e) {
        console.warn("Could not draw navigation polyline on map instance:", e);
      }
    },
    [mapInstance]
  );

  // 3. Update / render Officer Live Position Marker on Map
  const updateOfficerMarker = useCallback(
    (coords: Coordinates, officerHeading: number | null) => {
      if (!mapInstance) return;

      try {
        if (!officerMarkerRef.current) {
          // Create custom animated DOM element for current location
          const el = document.createElement("div");
          el.className = "officer-nav-marker flex items-center justify-center relative";
          el.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
              </svg>
            </div>
            <div class="absolute inset-0 rounded-full bg-blue-500/40 animate-ping -z-10"></div>
          `;

          // If MapLibre / OlaMaps marker constructor is available
          if (typeof (window as any).maplibregl?.Marker === "function") {
            const marker = new (window as any).maplibregl.Marker({ element: el })
              .setLngLat(coords)
              .addTo(mapInstance);
            officerMarkerRef.current = marker;
          } else if (mapInstance.addMarker) {
            officerMarkerRef.current = mapInstance.addMarker({
              element: el,
              coordinates: coords,
            });
          }
        } else {
          if (typeof officerMarkerRef.current.setLngLat === "function") {
            officerMarkerRef.current.setLngLat(coords);
          }
        }

        // Rotate marker if heading available
        if (officerHeading !== null && officerMarkerRef.current?.getElement) {
          const el = officerMarkerRef.current.getElement();
          if (el) {
            el.style.transform = `rotate(${officerHeading}deg)`;
          }
        }
      } catch (e) {
        console.warn("Officer marker placement:", e);
      }
    },
    [mapInstance]
  );

  // 4. Voice assistance TTS synthesizer
  const speakInstruction = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  // 5. Setup live geolocation tracking watcher
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setError("Geolocation is not supported by your browser or device.");
      setIsLoadingRoute(false);
      return;
    }

    // Default immediate query position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const origin: Coordinates = [pos.coords.longitude, pos.coords.latitude];
        setCurrentPosition(origin);
        updateOfficerMarker(origin, pos.coords.heading);
        fetchRoute(origin);
      },
      (err) => {
        // Fallback: Use city center if permission denied or unavailable for mock/dev navigation
        console.warn("Geolocation watch warning:", err.message);
        const fallbackOrigin: Coordinates = [77.5946, 12.9716];
        setCurrentPosition(fallbackOrigin);
        updateOfficerMarker(fallbackOrigin, null);
        fetchRoute(fallbackOrigin);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    // Watch position as officer travels
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords: Coordinates = [pos.coords.longitude, pos.coords.latitude];
        setCurrentPosition(newCoords);
        if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
          setHeading(pos.coords.heading);
        }
        updateOfficerMarker(newCoords, pos.coords.heading);

        // Check if officer arrived within 25 meters of destination
        const [oLng, oLat] = newCoords;
        const [dLng, dLat] = destinationCoordinates;
        const distToDest =
          Math.sqrt(Math.pow((oLng - dLng) * 111000, 2) + Math.pow((oLat - dLat) * 111000, 2));

        if (distToDest < 35 && !hasArrived) {
          setHasArrived(true);
          speakInstruction("You have arrived at the incident site. Commencing resolution.");
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (officerMarkerRef.current) {
        try {
          officerMarkerRef.current.remove();
        } catch {}
      }
      // Remove route layers from map on unmount
      if (mapInstance) {
        try {
          if (mapInstance.getLayer("officer-route-line")) {
            mapInstance.removeLayer("officer-route-line");
          }
          if (mapInstance.getLayer("officer-route-casing")) {
            mapInstance.removeLayer("officer-route-casing");
          }
          if (mapInstance.getSource("officer-route-source")) {
            mapInstance.removeSource("officer-route-source");
          }
        } catch {}
      }
    };
  }, [destinationCoordinates, fetchRoute, mapInstance, updateOfficerMarker]);

  // Voice announce active step change
  useEffect(() => {
    if (route && route.steps && route.steps[activeStepIndex]) {
      if (lastAnnouncedStepRef.current !== activeStepIndex) {
        lastAnnouncedStepRef.current = activeStepIndex;
        speakInstruction(route.steps[activeStepIndex].instruction);
      }
    }
  }, [activeStepIndex, route, voiceEnabled]);

  // Google Maps external navigation URL
  const googleMapsUrl = currentPosition
    ? `https://www.google.com/maps/dir/?api=1&origin=${currentPosition[1]},${currentPosition[0]}&destination=${destinationCoordinates[1]},${destinationCoordinates[0]}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${destinationCoordinates[1]},${destinationCoordinates[0]}&travelmode=driving`;

  const currentStep = route?.steps?.[activeStepIndex];
  const ManeuverIcon = currentStep ? getManeuverIcon(currentStep.maneuver) : ArrowUp;

  return (
    <div className="relative w-full flex flex-col gap-3 font-sans antialiased">
      {/* Estimated Route / Live Routing Notice Banner */}
      {(route?.isEstimated || error) && (
        <div className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="truncate">
              {error
                ? "Live routing unavailable. Please navigate via Google Maps."
                : "Live navigation provider unavailable. Displaying estimated straight-line trajectory."}
            </span>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] shrink-0 transition"
          >
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* TOP NAVIGATION HUD (Turn-by-turn banner) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-blue-500/10 overflow-hidden transition-all">
        {/* Active Maneuver Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              {isLoadingRoute ? (
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              ) : (
                <ManeuverIcon className="w-7 h-7 text-white" />
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-blue-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>Next Maneuver ({formatDistance(currentStep?.distanceMeters || 0)})</span>
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate leading-tight mt-0.5">
                {isLoadingRoute
                  ? "Calculating optimal driving trajectory..."
                  : hasArrived
                  ? "Arrived at Destination Site"
                  : currentStep?.instruction || "Proceed along mapped route"}
              </h3>
              {currentStep?.roadName && (
                <p className="text-xs text-blue-100 truncate mt-0.5">
                  Onto <span className="font-semibold text-white">{currentStep.roadName}</span>
                </p>
              )}
            </div>
          </div>

          {/* Quick HUD controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
              title={voiceEnabled ? "Mute Voice Guidance" : "Enable Voice Guidance"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
                title="Exit Navigation HUD"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Trip Summary & Google Maps Deep Link Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-700">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{route ? formatDuration(route.durationSeconds) : "--"}</span>
            </div>
            <div className="h-3 w-px bg-slate-300" />
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Navigation className="w-4 h-4 text-blue-600" />
              <span>{route ? formatDistance(route.distanceMeters) : "--"}</span>
            </div>
            <div className="h-3 w-px bg-slate-300 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1 text-slate-500 text-[11px]">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>{referenceNumber || "Incident Site"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Detailed Steps */}
            <button
              type="button"
              onClick={() => setShowStepsDrawer(!showStepsDrawer)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition shadow-sm text-xs"
            >
              <span>{showStepsDrawer ? "Hide Steps" : "View Turn Steps"}</span>
              {showStepsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Launch Native Google Maps Navigation */}
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-500/20 text-xs active:scale-95"
            >
              <span>Open in Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Expandable Step-by-Step Directions Drawer */}
        {showStepsDrawer && route && (
          <div className="p-4 border-t border-slate-200 bg-white max-h-64 overflow-y-auto divide-y divide-slate-100 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Full Route Instructions ({route.steps.length} steps)</span>
              <span className="text-[11px] text-blue-600 font-semibold">
                ETA: {formatDuration(route.durationSeconds)}
              </span>
            </h4>

            {route.steps.map((st, i) => {
              const StepIcon = getManeuverIcon(st.maneuver);
              const isActive = i === activeStepIndex;
              return (
                <div
                  key={i}
                  onClick={() => setActiveStepIndex(i)}
                  className={`pt-2.5 pb-2 flex items-start gap-3 cursor-pointer rounded-xl px-2 transition-colors ${
                    isActive ? "bg-blue-50/80 text-blue-900" : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-snug">{st.instruction}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                      <span>{formatDistance(st.distanceMeters)}</span>
                      <span>&bull;</span>
                      <span>{st.roadName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Arrival Alert Banner */}
      {hasArrived && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-md flex items-center justify-between gap-3 text-emerald-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold">You have arrived at the incident location.</p>
              <p className="text-[11px] text-emerald-700">
                Proceed to inspect civic infrastructure and commence resolution work.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
          >
            Start Work
          </button>
        </div>
      )}
    </div>
  );
}
