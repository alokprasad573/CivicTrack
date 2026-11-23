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
  Search,
  Building,
  Compass,
  CheckCircle2,
} from "lucide-react";

export interface LocationPickerProps {
  value?: GeoJsonPoint;
  address?: string;
  onChange: (location: GeoJsonPoint, suggestedAddress?: string) => void;
  className?: string;
}

const POPULAR_ZONES = [
  { label: "Indiranagar", coords: [77.6412, 12.9784] as Coordinates, address: "100 Feet Rd, Indiranagar, Bengaluru, Karnataka" },
  { label: "Koramangala", coords: [77.6245, 12.9352] as Coordinates, address: "80 Feet Rd, Koramangala 4th Block, Bengaluru, Karnataka" },
  { label: "MG Road / CBD", coords: [77.5946, 12.9716] as Coordinates, address: "MG Road, Central Business District, Bengaluru, Karnataka" },
  { label: "Whitefield", coords: [77.7499, 12.9698] as Coordinates, address: "ITPB Main Rd, Whitefield, Bengaluru, Karnataka" },
  { label: "Jayanagar", coords: [77.5838, 12.9308] as Coordinates, address: "4th Block, Jayanagar, Bengaluru, Karnataka" },
  { label: "HSR Layout", coords: [77.6389, 12.9121] as Coordinates, address: "27th Main Rd, Sector 1, HSR Layout, Bengaluru, Karnataka" },
  { label: "Malleshwaram", coords: [77.5704, 13.0031] as Coordinates, address: "Sampige Rd, Malleshwaram, Bengaluru, Karnataka" },
  { label: "Electronic City", coords: [77.6775, 12.8452] as Coordinates, address: "Hosur Rd, Phase 1, Electronic City, Bengaluru, Karnataka" },
];

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

  // Auto-center camera on citizen's live coordinates once resolved
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
      .then(({ Marker }) => {
        if (isDisposed || !map) return;

        // Custom teardrop pin element with dark core and blue gradient halo
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
              background: #2563eb;
              border: 3px solid #ffffff;
              box-shadow: 0 4px 16px rgba(37, 99, 235, 0.5), 0 2px 6px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #ffffff;
                transform: rotate(45deg);
              "></div>
            </div>
          </div>
        `;

        const marker = new Marker({
          element: el,
          draggable: true,
          anchor: "bottom",
        })
          .setLngLat(selectedCoords)
          .addTo(map);

        marker.on("dragstart", () => {
          el.style.cursor = "grabbing";
        });

        marker.on("dragend", () => {
          el.style.cursor = "grab";
          const lngLat = marker.getLngLat();
          if (lngLat) {
            onSelectCoordinates([lngLat.lng, lngLat.lat], true);
          }
        });

        pinMarkerRef.current = marker;
      })
      .catch((err) => {
        console.warn("MapLibre Marker loader notice:", err);
      });

    return () => {
      isDisposed = true;
      if (pinMarkerRef.current) {
        pinMarkerRef.current.remove();
        pinMarkerRef.current = null;
      }
    };
  }, [isLoaded, map, onSelectCoordinates, selectedCoords]);

  // Keep marker position synchronized with selectedCoords state
  useEffect(() => {
    if (pinMarkerRef.current && isValidCoordinates(selectedCoords)) {
      pinMarkerRef.current.setLngLat(selectedCoords);
    }
  }, [selectedCoords]);

  return (
    <>
      {/* Dedicated Current Location Marker: Pulsing radar ring with accuracy halo */}
      {isLoaded && map && userCoords && isValidCoordinates(userCoords) && (
        <CurrentLocationMarker
          map={map}
          coords={userCoords}
          accuracy={userAccuracy}
          label="Your Detected Location"
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
  // Resilient multi-tier GPS tracking hook
  const {
    coords: userCoords,
    accuracy: userAccuracy,
    isTracking,
    permissionGranted,
    source,
    error: geoError,
    getCurrentPosition,
  } = useGeolocation(true);

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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const hasAutoLocatedRef = useRef(false);
  const hasUserManuallySetRef = useRef(false);
  const hasInitialAddressPopulatedRef = useRef(false);
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
  }, [value?.coordinates]);

  // Synchronize address prop
  useEffect(() => {
    if (address !== undefined && address !== "") {
      setCurrentAddress(address);
    }
  }, [address]);

  // Reverse geocoding fetcher with guaranteed fallback address
  const fetchAddressSuggestion = useCallback(
    async (coords: Coordinates) => {
      setIsReverseGeocoding(true);
      try {
        const res = await fetch(
          `/api/v1/maps/reverse-geocode?lng=${coords[0]}&lat=${coords[1]}`,
          { credentials: "include" }
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
        // Fallback below
      } finally {
        setIsReverseGeocoding(false);
      }

      // Check if coordinate matches a known zone
      const matchedZone = POPULAR_ZONES.find(
        (z) =>
          Math.abs(z.coords[0] - coords[0]) < 0.02 &&
          Math.abs(z.coords[1] - coords[1]) < 0.02
      );

      const generatedAddress = matchedZone
        ? matchedZone.address
        : `Near [${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E], Municipal Ward, Bengaluru`;

      setCurrentAddress(generatedAddress);
      onChange({ type: "Point", coordinates: coords }, generatedAddress);
    },
    [onChange]
  );

  // Initial address guarantee: make sure address is never empty on load
  useEffect(() => {
    if (!hasInitialAddressPopulatedRef.current) {
      hasInitialAddressPopulatedRef.current = true;
      if (!address || address.trim().length < 3) {
        fetchAddressSuggestion(selectedCoords);
      }
    }
  }, [address, fetchAddressSuggestion, selectedCoords]);

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
          } catch {}
        }
      }
      hasAutoLocatedRef.current = true;
    }
  }, [userCoords, value, selectedCoords, fetchAddressSuggestion]);

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
      console.warn("GPS location retrieval warning:", err);
    } finally {
      setIsLocatingManually(false);
    }
  };

  // Search by Area or Landmark
  const handleSearchArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // 1. Check local zone presets first
      const queryLower = searchQuery.toLowerCase().trim();
      const matched = POPULAR_ZONES.find((z) =>
        z.label.toLowerCase().includes(queryLower) ||
        z.address.toLowerCase().includes(queryLower)
      );

      if (matched) {
        handleSelectCoordinates(matched.coords, true);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: matched.coords,
            zoom: 15,
            essential: true,
            duration: 1200,
          });
        }
        setIsSearching(false);
        return;
      }

      // 2. Query backend geocode endpoint
      const res = await fetch(
        `/api/v1/maps/geocode?query=${encodeURIComponent(searchQuery.trim())}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const first = json.data[0];
          handleSelectCoordinates(first.coordinates, true);
          if (first.formattedAddress) {
            setCurrentAddress(first.formattedAddress);
            onChange({ type: "Point", coordinates: first.coordinates }, first.formattedAddress);
          }
          if (mapInstanceRef.current) {
            mapInstanceRef.current.flyTo({
              center: first.coordinates,
              zoom: 15,
              essential: true,
              duration: 1200,
            });
          }
        }
      }
    } catch {
      // Ignore search error
    } finally {
      setIsSearching(false);
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
    <div className={`flex flex-col gap-3 font-sans ${className}`}>
      {/* Top action bar: Header, Locate Me GPS button, and Manual Coordinates toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">
            Incident Map Pin & Location
          </span>
          {userCoords && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{source === "gps" ? "GPS Active" : source === "network" ? "Wi-Fi Located" : "Auto Located"}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Locate Me button */}
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocatingManually}
            className="text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 active:scale-95 flex items-center gap-1.5 transition-all px-3 py-1.5 rounded-xl shadow-xs disabled:opacity-60 min-h-[36px]"
            title="Detect live location and snap pin to your coordinates"
          >
            {isLocatingManually ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Crosshair className="w-3.5 h-3.5" />
            )}
            <span>
              {isLocatingManually ? "Acquiring Location..." : "Locate My Current GPS"}
            </span>
          </button>

          {/* Toggle Manual Coordinates Mode */}
          <button
            type="button"
            onClick={() => setIsManualMode(!isManualMode)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition px-2.5 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary min-h-[36px]"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{isManualMode ? "Map View" : "Enter Coords"}</span>
          </button>
        </div>
      </div>

      {/* Search Neighborhood / Landmark Bar */}
      {!isManualMode && (
        <div className="space-y-2">
          <form onSubmit={handleSearchArea} className="relative flex items-center">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, colony or landmark (e.g. Indiranagar, MG Road, Whitefield)..."
              className="w-full bg-background border border-border rounded-xl pl-10 pr-24 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-[11px] disabled:opacity-50 transition"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Search"}
            </button>
          </form>

          {/* Quick Ward / Zone Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-muted-foreground">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Compass className="w-3 h-3" /> Quick Zones:
            </span>
            {POPULAR_ZONES.map((zone) => (
              <button
                key={zone.label}
                type="button"
                onClick={() => {
                  handleSelectCoordinates(zone.coords, true);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo({
                      center: zone.coords,
                      zoom: 15,
                      essential: true,
                      duration: 1200,
                    });
                  }
                }}
                className="px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-[11px] font-semibold text-foreground whitespace-nowrap transition shadow-2xs"
              >
                {zone.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual Input Fallback */}
      {isManualMode ? (
        <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card flex flex-col gap-4 shadow-xs">
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground bg-primary/5 p-3 rounded-xl border border-primary/10">
            <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              Enter precise GPS coordinates to position the incident pin manually or when filing a complaint remotely.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">
                Longitude (-180 to 180)
              </label>
              <input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="77.5946"
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">
                Latitude (-90 to 90)
              </label>
              <input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="12.9716"
                className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button
              type="button"
              onClick={handleLocateMe}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Autofill with Detected Location</span>
            </button>

            <button
              type="button"
              onClick={handleManualApply}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 transition shadow-xs active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Coordinates</span>
            </button>
          </div>
        </div>
      ) : (
        /* Interactive Ola Map Picker with Auto-Centering and Pulsing Marker */
        <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-xs">
          <OlaMap
            initialCenter={selectedCoords}
            initialZoom={15}
            onMapClick={(coords) => handleSelectCoordinates(coords, true)}
            onMapLoaded={(m) => {
              mapInstanceRef.current = m;
            }}
            className="w-full h-[360px]"
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
        </div>
      )}

      {/* Location Details Footer */}
      <div className="flex flex-col gap-2 p-3.5 sm:p-4 rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-semibold">Pinned Incident Location:</span>
            <span className="text-primary font-bold bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
              [{selectedCoords[0].toFixed(5)}, {selectedCoords[1].toFixed(5)}]
            </span>
          </div>

          {userCoords && isValidCoordinates(userCoords) && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Detected Location:</span>
                <span className="text-foreground font-medium">
                  [{userCoords[0].toFixed(5)}, {userCoords[1].toFixed(5)}]
                </span>
                {typeof userAccuracy === "number" && !isNaN(userAccuracy) && (
                  <span className="text-[10px] text-muted-foreground">
                    (±{Math.round(userAccuracy)}m)
                  </span>
                )}
              </div>

              {/* Snap Pin to GPS Button */}
              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocatingManually}
                className="text-[11px] font-bold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 flex items-center gap-1 transition-all"
                title="Snap complaint pin directly to your detected position"
              >
                <Locate className="w-3 h-3" />
                <span>Snap Pin to GPS</span>
              </button>
            </div>
          )}
        </div>

        {geoError && !userCoords && (
          <div className="text-[11px] text-amber-600 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{geoError}</span>
          </div>
        )}

        {currentAddress && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Suggested Address:
            </span>
            <span className="text-foreground font-medium">{currentAddress}</span>
            {isReverseGeocoding && (
              <span className="text-xs text-primary animate-pulse ml-1 font-semibold">
                (Resolving address...)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
