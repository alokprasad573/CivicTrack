"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { Marker } from "maplibre-gl";
import { Coordinates, GeoJsonPoint } from "@civictrack/contracts";
import { OlaMap } from "./ola-map";
import { CurrentLocationMarker } from "./current-location-marker";
import { useGeolocation } from "../../hooks/use-geolocation";
import { getMapLibre } from "../../lib/maplibre-loader";
import { DEFAULT_MAP_CENTER } from "../../lib/ola-maps-config";
import {
  MapPin,
  Locate,
  AlertCircle,
  Edit3,
  Check,
  Crosshair,
  Loader2,
  Navigation,
} from "lucide-react";

export interface LocationPickerProps {
  value?: GeoJsonPoint;
  address?: string;
  onChange: (location: GeoJsonPoint, suggestedAddress?: string) => void;
  className?: string;
}

function isValidCoordinates(coords: unknown): coords is Coordinates {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    !isNaN(coords[0]) &&
    coords[0] >= -180 &&
    coords[0] <= 180 &&
    typeof coords[1] === "number" &&
    !isNaN(coords[1]) &&
    coords[1] >= -90 &&
    coords[1] <= 90
  );
}

function isDefaultCoordinates(coords: Coordinates): boolean {
  return (
    Math.abs(coords[0] - DEFAULT_MAP_CENTER[0]) < 0.001 &&
    Math.abs(coords[1] - DEFAULT_MAP_CENTER[1]) < 0.001
  );
}

/**
 * Child overlay within OlaMap that manages the draggable complaint pin marker,
 * the dedicated CurrentLocationMarker (pulsing radar beacon at live GPS position),
 * and automatic camera centering.
 */
interface LocationPickerMapOverlayProps {
  map: any | null;
  isLoaded: boolean;
  selectedCoords: Coordinates;
  userCoords: Coordinates | null;
  userAccuracy: number | null;
  isTracking: boolean;
  hasUserManuallySetRef: React.MutableRefObject<boolean>;
  onSelectCoordinates: (coords: Coordinates, isUserAction?: boolean) => void;
  onMapReady: (mapInstance: any) => void;
}

function LocationPickerMapOverlay({
  map,
  isLoaded,
  selectedCoords,
  userCoords,
  userAccuracy,
  isTracking,
  hasUserManuallySetRef,
  onSelectCoordinates,
  onMapReady,
}: LocationPickerMapOverlayProps) {
  const pinMarkerRef = useRef<Marker | null>(null);
  const hasAutoCenteredCameraRef = useRef(false);

  // Notify parent of active map instance for manual locate flyTo commands
  useEffect(() => {
    if (map && isLoaded) {
      onMapReady(map);
    }
  }, [map, isLoaded, onMapReady]);

  // Auto-center camera on citizen's live GPS coordinates once resolved
  useEffect(() => {
    if (!isLoaded || !map) return;
    if (hasAutoCenteredCameraRef.current) return;

    if (userCoords && isValidCoordinates(userCoords) && !hasUserManuallySetRef.current) {
      try {
        map.flyTo({
          center: userCoords,
          zoom: 15,
          essential: true,
          duration: 1200,
        });
        hasAutoCenteredCameraRef.current = true;
      } catch {
        // Safe catch if map style is still transitioning
      }
    }
  }, [isLoaded, map, userCoords, hasUserManuallySetRef]);

  // Create and maintain the draggable complaint pin marker on the map
  useEffect(() => {
    if (!isLoaded || !map || !isValidCoordinates(selectedCoords)) return;

    if (pinMarkerRef.current) {
      pinMarkerRef.current.setLngLat(selectedCoords);
      return;
    }

    let isDisposed = false;

    getMapLibre()
      .then(({ Marker, Popup }) => {
        if (isDisposed || !map) return;

        // Custom teardrop pin element with dark core and teal halo
        const el = document.createElement("div");
        el.className = "civic-complaint-pin-marker";
        el.style.width = "36px";
        el.style.height = "36px";
        el.style.cursor = "grab";
        el.setAttribute("title", "Drag to adjust incident location");

        el.innerHTML = `
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              background: #00e5c3;
              border: 3px solid #ffffff;
              box-shadow: 0 4px 16px rgba(0, 229, 195, 0.6), 0 2px 6px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #0f172a;
                transform: rotate(45deg);
              "></div>
            </div>
          </div>
        `;

        const popup = new Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false,
          className: "civic-pin-popup",
        }).setHTML(`
          <div style="font-family: system-ui, sans-serif; padding: 4px 8px; color: #f8fafc; background: #0f172a; border-radius: 6px; border: 1px solid rgba(0, 229, 195, 0.4); font-size: 11px; font-weight: 600;">
            📍 Incident Pin (Drag to Move)
          </div>
        `);

        const marker = new Marker({
          element: el,
          draggable: true,
          anchor: "bottom",
        })
          .setLngLat(selectedCoords)
          .setPopup(popup)
          .addTo(map);

        marker.on("dragstart", () => {
          el.style.cursor = "grabbing";
        });

        marker.on("dragend", () => {
          el.style.cursor = "grab";
          const lngLat = marker.getLngLat();
          onSelectCoordinates([lngLat.lng, lngLat.lat], true);
        });

        pinMarkerRef.current = marker;
      })
      .catch(() => {});

    return () => {
      isDisposed = true;
      if (pinMarkerRef.current) {
        pinMarkerRef.current.remove();
        pinMarkerRef.current = null;
      }
    };
  }, [isLoaded, map]);

  // Keep marker position synchronized with selectedCoords state
  useEffect(() => {
    if (pinMarkerRef.current && isValidCoordinates(selectedCoords)) {
      pinMarkerRef.current.setLngLat(selectedCoords);
    }
  }, [selectedCoords]);

  return (
    <>
      {/* Dedicated Current Location Marker: Cyan/teal pulsing radar ring with accuracy halo */}
      {isLoaded && map && userCoords && isValidCoordinates(userCoords) && (
        <CurrentLocationMarker
          map={map}
          coords={userCoords}
          accuracy={userAccuracy}
          label="Your Current Location"
          isLocating={isTracking}
        />
      )}
    </>
  );
}

export function LocationPicker({
  value,
  address,
  onChange,
  className = "w-full",
}: LocationPickerProps) {
  // Real GPS Geolocation API tracking
  const {
    coords: userCoords,
    accuracy: userAccuracy,
    isTracking,
    permissionGranted,
    error: geoError,
    getCurrentPosition,
  } = useGeolocation(true);

  // Determine initial coordinates: prefer explicit value if not default, else fallback to default Bangalore center
  const initialCoords: Coordinates =
    value && isValidCoordinates(value.coordinates)
      ? value.coordinates
      : DEFAULT_MAP_CENTER;

  const [selectedCoords, setSelectedCoords] = useState<Coordinates>(initialCoords);
  const [currentAddress, setCurrentAddress] = useState<string>(address || "");
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualLng, setManualLng] = useState<string>(String(selectedCoords[0]));
  const [manualLat, setManualLat] = useState<string>(String(selectedCoords[1]));
  const [isLocatingManually, setIsLocatingManually] = useState(false);

  const hasAutoLocatedRef = useRef(false);
  const hasUserManuallySetRef = useRef(false);
  const mapInstanceRef = useRef<any | null>(null);

  // Synchronize when value prop updates from parent
  useEffect(() => {
    if (value && isValidCoordinates(value.coordinates)) {
      if (
        value.coordinates[0] !== selectedCoords[0] ||
        value.coordinates[1] !== selectedCoords[1]
      ) {
        setSelectedCoords(value.coordinates);
        setManualLng(String(value.coordinates[0]));
        setManualLat(String(value.coordinates[1]));
      }
    }
  }, [value?.coordinates?.[0], value?.coordinates?.[1]]);

  // Synchronize address prop
  useEffect(() => {
    if (address !== undefined) {
      setCurrentAddress(address);
    }
  }, [address]);

  // Reverse geocoding fetcher
  const fetchAddressSuggestion = useCallback(
    async (coords: Coordinates) => {
      setIsReverseGeocoding(true);
      try {
        const res = await fetch(
          `/api/v1/maps/reverse-geocode?lng=${coords[0]}&lat=${coords[1]}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.formattedAddress) {
            setCurrentAddress(json.data.formattedAddress);
            onChange(
              { type: "Point", coordinates: coords },
              json.data.formattedAddress
            );
            return;
          }
        }
      } catch {
        // Network errors silently handled; coordinate data is preserved
      } finally {
        setIsReverseGeocoding(false);
      }

      onChange({ type: "Point", coordinates: coords });
    },
    [onChange]
  );

  // Auto-location & Auto-centering on first GPS detection
  useEffect(() => {
    if (!userCoords || !isValidCoordinates(userCoords)) return;

    if (!hasAutoLocatedRef.current && !hasUserManuallySetRef.current) {
      const isCurrentDefault = isDefaultCoordinates(selectedCoords);
      const isValueDefault = !value || isDefaultCoordinates(value.coordinates);

      if (isCurrentDefault || isValueDefault) {
        setSelectedCoords(userCoords);
        setManualLng(String(userCoords[0]));
        setManualLat(String(userCoords[1]));
        fetchAddressSuggestion(userCoords);

        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.flyTo({
              center: userCoords,
              zoom: 15,
              essential: true,
              duration: 1200,
            });
          } catch {
            // Map may still be loading
          }
        }
      }
      hasAutoLocatedRef.current = true;
    }
  }, [userCoords, value, selectedCoords, fetchAddressSuggestion]);

  // Handler for coordinate selection (via map click, pin drag, or manual apply)
  const handleSelectCoordinates = useCallback(
    (coords: Coordinates, isUserAction = true) => {
      if (isUserAction) {
        hasUserManuallySetRef.current = true;
      }
      setSelectedCoords(coords);
      setManualLng(String(coords[0]));
      setManualLat(String(coords[1]));
      fetchAddressSuggestion(coords);
    },
    [fetchAddressSuggestion]
  );

  // Manual Locate Me / Snap Pin to GPS action
  const handleLocateMe = async () => {
    setIsLocatingManually(true);
    try {
      const coords = await getCurrentPosition();
      if (isValidCoordinates(coords)) {
        hasUserManuallySetRef.current = false;
        handleSelectCoordinates(coords, false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: coords,
            zoom: 15,
            essential: true,
            duration: 1200,
          });
        }
      }
    } catch (err) {
      console.warn("GPS location retrieval failed:", err);
    } finally {
      setIsLocatingManually(false);
    }
  };

  const handleManualApply = () => {
    const lng = parseFloat(manualLng);
    const lat = parseFloat(manualLat);

    if (
      !isNaN(lng) &&
      !isNaN(lat) &&
      lng >= -180 &&
      lng <= 180 &&
      lat >= -90 &&
      lat <= 90
    ) {
      handleSelectCoordinates([lng, lat], true);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo({
          center: [lng, lat],
          zoom: 15,
          essential: true,
          duration: 1200,
        });
      }
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Top action bar: Header, Locate Me GPS button, and Manual Coordinates toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Complaint Location Pin
          </span>
          {permissionGranted && userCoords && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              GPS Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Locate Me button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingManually || isTracking}
            className="text-xs font-medium text-primary hover:text-primary/90 flex items-center gap-1.5 transition-all bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/25 disabled:opacity-60 shadow-sm"
            title="Detect live GPS coordinates and snap pin to your location"
          >
            {isLocatingManually || isTracking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Crosshair className="w-3.5 h-3.5 text-primary" />
            )}
            <span>
              {isLocatingManually
                ? "Acquiring GPS..."
                : isTracking && !userCoords
                ? "Detecting GPS..."
                : "Locate My GPS"}
            </span>
          </button>

          {/* Toggle Manual Coordinates Mode */}
          <button
            type="button"
            onClick={() => setIsManualMode(!isManualMode)}
            className="text-xs font-medium text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors px-2 py-1 rounded-lg border border-border/60 hover:border-border"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isManualMode ? "Use Interactive Map" : "Manual Coordinates"}</span>
          </button>
        </div>
      </div>

      {/* Manual Input Fallback */}
      {isManualMode ? (
        <div className="p-4 rounded-xl border border-border bg-card/60 flex flex-col gap-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Enter precise GPS coordinates if you prefer manual specification or are filing a complaint remotely.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="77.5946"
                className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="12.9716"
                className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleLocateMe}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <Navigation className="w-3 h-3" />
              <span>Fill with My GPS Coordinates</span>
            </button>

            <button
              type="button"
              onClick={handleManualApply}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Update Pin Coordinates</span>
            </button>
          </div>
        </div>
      ) : (
        /* Interactive Ola Map Picker with Auto-Centering and Pulsing Radar Marker */
        <OlaMap
          initialCenter={selectedCoords}
          initialZoom={15}
          onMapClick={(coords) => handleSelectCoordinates(coords, true)}
          className="w-full h-[340px] rounded-xl"
        >
          {({ map, isLoaded }) => (
            <LocationPickerMapOverlay
              map={map}
              isLoaded={isLoaded}
              selectedCoords={selectedCoords}
              userCoords={userCoords}
              userAccuracy={userAccuracy}
              isTracking={isTracking}
              hasUserManuallySetRef={hasUserManuallySetRef}
              onSelectCoordinates={handleSelectCoordinates}
              onMapReady={(m) => {
                mapInstanceRef.current = m;
              }}
            />
          )}
        </OlaMap>
      )}

      {/* Location Details Footer: Pin Coordinates, Live GPS Radar Readout, and Address */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-border/70 bg-card/40 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Incident Pin:</span>
            <span className="font-mono text-primary font-bold">
              [{selectedCoords[0].toFixed(5)}, {selectedCoords[1].toFixed(5)}]
            </span>
          </div>

          {userCoords && isValidCoordinates(userCoords) && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-[#00e5c3] animate-pulse" />
                <span>My GPS:</span>
                <span className="font-mono text-foreground font-medium">
                  [{userCoords[0].toFixed(5)}, {userCoords[1].toFixed(5)}]
                </span>
                {typeof userAccuracy === "number" && !isNaN(userAccuracy) && (
                  <span className="text-[10px] text-muted-foreground/80">
                    (±{Math.round(userAccuracy)}m)
                  </span>
                )}
              </div>

              {/* Snap Pin to GPS Button */}
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocatingManually}
                className="text-[11px] font-semibold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded border border-primary/20 flex items-center gap-1 transition-all"
                title="Snap complaint pin directly to your current GPS position"
              >
                <Locate className="w-3 h-3" />
                <span>Snap Pin to GPS</span>
              </button>
            </div>
          )}
        </div>

        {geoError && !userCoords && (
          <div className="text-[11px] text-amber-400 flex items-center gap-1.5 pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{geoError}</span>
          </div>
        )}

        {currentAddress && (
          <div className="text-xs text-muted-foreground/90 pt-2 border-t border-border/50 flex flex-wrap items-center gap-1">
            <span className="font-semibold text-foreground">Suggested Address:</span>
            <span>{currentAddress}</span>
            {isReverseGeocoding && (
              <span className="text-xs text-primary animate-pulse ml-1">
                (Resolving address...)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}