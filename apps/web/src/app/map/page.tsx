"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ComplaintCategory,
  ComplaintStatus,
  Coordinates,
  GeoJsonPoint,
} from "@civictrack/contracts";
import { LocationPicker } from "../../components/maps/location-picker";
import { MapComplaintItem } from "../../hooks/use-complaint-markers";
import { useGeolocation } from "../../hooks/use-geolocation";
import { CATEGORY_COLORS, DEFAULT_MAP_CENTER } from "../../lib/ola-maps-config";
import { StatusBadge } from "../../components/ui/status-badge";
import {
  MapPin,
  Navigation,
  Layers,
  ArrowLeft,
  Info,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Filter,
  Crosshair,
  ChevronRight,
  EyeOff,
} from "lucide-react";

const SpatialMapPreview = dynamic(
  () =>
    import("../../components/maps/spatial-map-preview").then(
      (mod) => mod.SpatialMapPreview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[620px] rounded-2xl border border-slate-200/90 bg-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
        <span className="text-xs text-slate-600 font-medium">
          Loading Municipal Spatial Map Preview...
        </span>
      </div>
    ),
  }
);

const RADIUS_OPTIONS = [
  { label: "2 km", value: 2000 },
  { label: "5 km", value: 5000 },
  { label: "10 km (Nearby)", value: 10000 },
  { label: "25 km", value: 25000 },
  { label: "50 km", value: 50000 },
  { label: "Citywide (100 km)", value: 100000 },
];

const STATUS_FILTERS = [
  { label: "All Active Issues", value: "" },
  { label: "Submitted", value: ComplaintStatus.SUBMITTED },
  { label: "Under Review", value: ComplaintStatus.UNDER_REVIEW },
  { label: "In Progress", value: ComplaintStatus.IN_PROGRESS },
  { label: "Resolved", value: ComplaintStatus.RESOLVED },
  { label: "Closed Issues", value: ComplaintStatus.CLOSED },
];

const CATEGORY_FILTERS = [
  { label: "All Categories", value: "" },
  { label: "Roads & Potholes", value: ComplaintCategory.ROADS_POTHOLES },
  { label: "Water Supply", value: ComplaintCategory.WATER_SUPPLY },
  { label: "Garbage & Sanitation", value: ComplaintCategory.GARBAGE_SANITATION },
  { label: "Drainage & Sewage", value: ComplaintCategory.DRAINAGE_SEWAGE },
  { label: "Streetlights", value: ComplaintCategory.STREETLIGHTS },
  { label: "Electricity Grid", value: ComplaintCategory.ELECTRICITY },
  { label: "Other", value: ComplaintCategory.OTHER },
];

/**
 * Calculates geodesic distance between two [lng, lat] coordinate points using Haversine formula
 */
function calculateDistanceKm(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatDistance(distKm: number): string {
  if (distKm < 1) {
    return `${Math.round(distKm * 1000)} m away`;
  }
  return `${distKm.toFixed(1)} km away`;
}

function MapsExplorerContent() {
  const searchParams = useSearchParams();
  const queryLng = searchParams.get("lng");
  const queryLat = searchParams.get("lat");

  const [activeTab, setActiveTab] = useState<"city" | "picker">("city");

  // Geolocation tracking
  const {
    coords: userCoords,
    accuracy: locationAccuracy,
    error: geoError,
  } = useGeolocation(true);

  // Search parameters
  const [radiusMeters, setRadiusMeters] = useState<number>(10000); // 10 km default
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showClosed, setShowClosed] = useState<boolean>(false);
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  // Data fetching state
  const [complaints, setComplaints] = useState<MapComplaintItem[]>([]);
  const [allComplaintsFallback, setAllComplaintsFallback] = useState<MapComplaintItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Location picker tab state
  const [pickedLocation, setPickedLocation] = useState<GeoJsonPoint>({
    type: "Point",
    coordinates: DEFAULT_MAP_CENTER,
  });
  const [pickedAddress, setPickedAddress] = useState<string>("");
  const hasAutoSyncedPickerRef = useRef(false);

  // Auto-sync picked location with live GPS coordinates on first detection
  useEffect(() => {
    if (userCoords && !hasAutoSyncedPickerRef.current) {
      setPickedLocation({
        type: "Point",
        coordinates: userCoords,
      });
      hasAutoSyncedPickerRef.current = true;
    }
  }, [userCoords]);

  // Determine effective map center: Target Query Coords -> GPS location -> First complaint -> Default center
  const effectiveCenter: Coordinates = useMemo(() => {
    if (queryLng && queryLat) {
      const parsedLng = parseFloat(queryLng);
      const parsedLat = parseFloat(queryLat);
      if (!isNaN(parsedLng) && !isNaN(parsedLat)) {
        return [parsedLng, parsedLat];
      }
    }
    if (userCoords && userCoords.length === 2) {
      return userCoords;
    }
    if (complaints.length > 0 && complaints[0]?.location?.coordinates) {
      return complaints[0].location.coordinates;
    }
    return DEFAULT_MAP_CENTER;
  }, [queryLng, queryLat, userCoords, complaints]);

  // Fetch complaints within radius of current location (or center)
  const fetchNearbyComplaints = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    const queryCenter = userCoords || effectiveCenter;
    const [lng, lat] = queryCenter;

    const shouldIncludeClosed = showClosed || statusFilter === ComplaintStatus.CLOSED;

    const params = new URLSearchParams();
    params.set("lng", String(lng));
    params.set("lat", String(lat));
    params.set("radius", String(radiusMeters));
    params.set("includeClosed", shouldIncludeClosed ? "true" : "false");
    if (categoryFilter) {
      params.set("category", categoryFilter);
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    params.set("limit", "100");

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");

    try {
      const res = await fetch(`${apiBase}/complaints/nearby?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const mapped: MapComplaintItem[] = json.data.map((c: any) => ({
            id: c._id || c.id,
            referenceNumber: c.referenceNumber,
            title: c.title,
            description: c.description,
            category: c.category,
            status: c.status,
            priority: c.priority,
            location: c.location,
            address: c.address,
            createdAt: c.createdAt,
            evidence: c.evidence || c.evidenceImages,
          }));

          setComplaints(mapped);

          // If no complaints in local radius, check if there are complaints citywide or around default civic center
          if (mapped.length === 0) {
            const fallbackParams = new URLSearchParams();
            fallbackParams.set("lng", String(lng));
            fallbackParams.set("lat", String(lat));
            fallbackParams.set("radius", "100000"); // 100 km wide
            fallbackParams.set("includeClosed", shouldIncludeClosed ? "true" : "false");
            if (categoryFilter) fallbackParams.set("category", categoryFilter);
            if (statusFilter) fallbackParams.set("status", statusFilter);
            fallbackParams.set("limit", "100");

            let fallbackRes = await fetch(`${apiBase}/complaints/nearby?${fallbackParams.toString()}`);
            let fbJson = fallbackRes.ok ? await fallbackRes.json() : null;

            // If still no results from current coordinates, try the default municipal center
            if ((!fbJson || !fbJson.data || fbJson.data.length === 0) && (lng !== DEFAULT_MAP_CENTER[0] || lat !== DEFAULT_MAP_CENTER[1])) {
              const centerParams = new URLSearchParams();
              centerParams.set("lng", String(DEFAULT_MAP_CENTER[0]));
              centerParams.set("lat", String(DEFAULT_MAP_CENTER[1]));
              centerParams.set("radius", "100000");
              centerParams.set("includeClosed", shouldIncludeClosed ? "true" : "false");
              if (categoryFilter) centerParams.set("category", categoryFilter);
              if (statusFilter) centerParams.set("status", statusFilter);
              centerParams.set("limit", "100");

              fallbackRes = await fetch(`${apiBase}/complaints/nearby?${centerParams.toString()}`);
              fbJson = fallbackRes.ok ? await fallbackRes.json() : null;
            }

            if (fbJson && fbJson.success && Array.isArray(fbJson.data) && fbJson.data.length > 0) {
              setAllComplaintsFallback(
                fbJson.data.map((c: any) => ({
                  id: c._id || c.id,
                  referenceNumber: c.referenceNumber,
                  title: c.title,
                  description: c.description,
                  category: c.category,
                  status: c.status,
                  priority: c.priority,
                  location: c.location,
                  address: c.address,
                  createdAt: c.createdAt,
                }))
              );
            } else {
              setAllComplaintsFallback([]);
            }
          } else {
            setAllComplaintsFallback([]);
          }
        }
      } else {
        setFetchError("Unable to retrieve nearby municipal complaints.");
      }
    } catch (err: any) {
      setFetchError(err.message || "Failed to load spatial complaints.");
    } finally {
      setIsLoading(false);
    }
  }, [userCoords, effectiveCenter, radiusMeters, categoryFilter, statusFilter, showClosed]);

  useEffect(() => {
    fetchNearbyComplaints();
  }, [fetchNearbyComplaints]);

  // Combined list of complaints (nearby or citywide fallback)
  // Feature: If issue status is CLOSED, do NOT show on map unless explicitly enabled by user
  const displayedComplaints = useMemo(() => {
    const list = complaints.length > 0 ? complaints : allComplaintsFallback;
    const allowClosed = showClosed || statusFilter === ComplaintStatus.CLOSED;
    if (!allowClosed) {
      return list.filter((c) => c.status !== ComplaintStatus.CLOSED && c.status !== ComplaintStatus.REJECTED);
    }
    return list.filter((c) => c.status !== ComplaintStatus.REJECTED);
  }, [complaints, allComplaintsFallback, showClosed, statusFilter]);

  // Compute complaints with distance from user
  const complaintsWithDistance = useMemo(() => {
    return displayedComplaints.map((c) => {
      let distanceKm: number | null = null;
      if (userCoords && c.location?.coordinates) {
        distanceKm = calculateDistanceKm(userCoords, c.location.coordinates);
      }
      return { ...c, distanceKm };
    }).sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      return 0;
    });
  }, [displayedComplaints, userCoords]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200/80 bg-white/85 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 rounded-xl text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-slate-200" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" aria-hidden="true" />
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900">
                City Incident Map
              </h1>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div
            className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80"
            role="tablist"
            aria-label="Map view mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "city"}
              onClick={() => setActiveTab("city")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                activeTab === "city"
                  ? "bg-white text-slate-900 shadow-hairline border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 border border-transparent"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Issues Map</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "picker"}
              onClick={() => setActiveTab("picker")}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                activeTab === "picker"
                  ? "bg-white text-slate-900 shadow-hairline border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900 border border-transparent"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Location Finder</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6">
        {/* Tab A: City Map View */}
        {activeTab === "city" && (
          <div className="flex flex-col gap-5">
            {/* Control Bar: Location status & radius selector */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-slate-200/90 bg-white shadow-hairline">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      userCoords ? "bg-emerald-600" : "bg-amber-600"
                    }`}
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-semibold tracking-tight text-slate-900">
                    Municipal Issues Around Your Location
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 tabular-nums">
                  {userCoords ? (
                    <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                      <Crosshair className="w-3.5 h-3.5" />
                      <span>
                        GPS Detected: [{userCoords[0].toFixed(4)}, {userCoords[1].toFixed(4)}]
                        {locationAccuracy ? ` (±${Math.round(locationAccuracy)}m)` : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-800 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        {geoError
                          ? "GPS Permission Denied. Showing Default Municipal Zone."
                          : "Acquiring GPS location..."}
                      </span>
                    </span>
                  )}

                  <span aria-hidden="true" className="text-slate-300">
                    &middot;
                  </span>
                  <span>
                    Radius:{" "}
                    <strong className="font-semibold text-slate-900">
                      {radiusMeters / 1000} km
                    </strong>
                  </span>
                </div>
              </div>

              {/* Radius Options, Closed Toggle & Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 gap-1"
                  role="group"
                  aria-label="Search radius"
                >
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRadiusMeters(opt.value)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${
                        radiusMeters === opt.value
                          ? "bg-white text-slate-900 shadow-hairline border border-slate-200/80"
                          : "text-slate-600 hover:text-slate-900 border border-transparent"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Hide / Show Closed Issues Toggle */}
                <button
                  type="button"
                  onClick={() => setShowClosed((prev) => !prev)}
                  aria-pressed={showClosed}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    showClosed
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-hairline"
                      : "bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border-slate-200/90 shadow-hairline"
                  }`}
                  title={
                    showClosed
                      ? "Closed complaints are currently shown on the map"
                      : "Closed complaints are hidden from the map"
                  }
                >
                  {showClosed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Closed Issues: Shown</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Closed Issues: Hidden</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={fetchNearbyComplaints}
                  aria-label="Refresh nearby issues"
                  title="Refresh Nearby Issues"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/90 shadow-hairline transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
                </button>
              </div>
            </div>

            {/* Filter Pills Bar: Status and Category */}
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-hairline flex flex-col gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5 shrink-0 pr-1">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Filter status:</span>
                </span>
                {STATUS_FILTERS.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setStatusFilter(st.value)}
                    aria-pressed={statusFilter === st.value}
                    className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-medium shrink-0 transition-colors border ${
                      statusFilter === st.value
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/90"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-slate-200/70 pb-1">
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5 shrink-0 pr-1">
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span>Filter category:</span>
                </span>
                {CATEGORY_FILTERS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategoryFilter(cat.value)}
                    aria-pressed={categoryFilter === cat.value}
                    className={`min-h-[44px] px-3.5 py-2 rounded-full text-xs font-medium shrink-0 transition-colors border ${
                      categoryFilter === cat.value
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/90"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fetch Error Advisory */}
            {fetchError && (
              <div
                role="alert"
                className="p-4 rounded-2xl border border-rose-200 bg-rose-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-800"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{fetchError}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchNearbyComplaints}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-rose-200 text-rose-800 hover:bg-rose-100/60 font-medium text-xs transition-colors inline-flex items-center gap-1.5 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {/* Zero complaints within radius advisory */}
            {displayedComplaints.length === 0 && !isLoading && !fetchError && (
              <div className="p-4 sm:p-5 rounded-2xl border border-amber-200 bg-amber-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-950">
                      No active open issues reported within{" "}
                      <span className="tabular-nums">{radiusMeters / 1000} km</span> of your GPS
                      coordinates.
                    </p>
                    {!showClosed && statusFilter !== ComplaintStatus.CLOSED && (
                      <p className="text-xs text-amber-800 mt-0.5">
                        Closed complaints are hidden from the map by default.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!showClosed && statusFilter !== ComplaintStatus.CLOSED && (
                    <button
                      type="button"
                      onClick={() => setShowClosed(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white hover:bg-amber-100/60 text-amber-950 border border-amber-300 font-medium text-xs transition-colors inline-flex items-center gap-1.5 shadow-hairline"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Show Closed Issues</span>
                    </button>
                  )}
                  {radiusMeters < 100000 && (
                    <button
                      type="button"
                      onClick={() => setRadiusMeters(100000)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shrink-0 shadow-hairline"
                    >
                      Expand to Citywide (100 km)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* The Dynamic Spatial Map */}
            <div className="rounded-2xl overflow-hidden border border-slate-200/90 shadow-elevated relative bg-white">
              <SpatialMapPreview
                complaints={displayedComplaints}
                selectedComplaintId={selectedComplaintId}
                onSelectComplaint={(c) => setSelectedComplaintId(c ? c.id : null)}
                initialCenter={effectiveCenter}
                initialZoom={14}
                height="620px"
                title={`Municipal Issues (${displayedComplaints.length} displayed)`}
              />
            </div>

            {/* Nearby Complaints Incident List */}
            {complaintsWithDistance.length > 0 && (
              <div className="flex flex-col gap-3 mt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm sm:text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 tabular-nums">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <span>Active Issues Sorted by Proximity ({complaintsWithDistance.length})</span>
                  </h3>
                  <span className="text-xs text-slate-600">
                    Select any card to center the map on that incident
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {complaintsWithDistance.map((c) => {
                    const isSelected = selectedComplaintId === c.id;
                    const catColor = CATEGORY_COLORS[c.category as ComplaintCategory] || "#14b8a6";

                    return (
                      <article
                        key={c.id}
                        className={`rounded-2xl border transition-colors flex flex-col justify-between gap-3 p-4 bg-white ${
                          isSelected
                            ? "border-blue-600 ring-2 ring-blue-600/20 shadow-elevated bg-blue-50/30"
                            : "border-slate-200/90 hover:border-slate-300 shadow-hairline"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedComplaintId(isSelected ? null : c.id)}
                          aria-pressed={isSelected}
                          className="text-left flex flex-col gap-2.5 w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="font-mono font-semibold text-blue-700 text-xs tabular-nums">
                              {c.referenceNumber}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {c.distanceKm !== null && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 inline-flex items-center gap-1 tabular-nums">
                                  <Navigation className="w-3 h-3" />
                                  {formatDistance(c.distanceKm)}
                                </span>
                              )}
                              <StatusBadge status={c.status} />
                            </div>
                          </div>

                          <h4 className="font-semibold text-slate-900 text-sm line-clamp-2 leading-snug">
                            {c.title}
                          </h4>

                          <p className="text-slate-600 line-clamp-2 text-xs leading-relaxed">
                            {c.description || "Civic infrastructure issue reported by citizen"}
                          </p>
                        </button>

                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200/80 text-xs text-slate-600">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: catColor }}
                                aria-hidden="true"
                              />
                              <span className="capitalize truncate font-medium text-slate-700">
                                {c.category.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>
                          </div>

                          <Link
                            href={`/citizen/complaints/${c.id}`}
                            className="inline-flex items-center justify-center gap-1 px-3 py-2 min-h-[44px] rounded-xl text-xs font-medium text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 transition-colors shrink-0"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab B: Location Picker for Complaint Submission */}
        {activeTab === "picker" && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Complaint Location Pin Picker
              </h2>
              <p className="text-sm text-slate-600">
                Drop pin on map or enter GPS coordinates manually. Reverse geocoding provides
                address suggestions.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-hairline">
              <LocationPicker
                value={pickedLocation}
                address={pickedAddress}
                onChange={(loc, addr) => {
                  hasAutoSyncedPickerRef.current = true;
                  setPickedLocation(loc);
                  if (addr) setPickedAddress(addr);
                }}
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/90 bg-white shadow-hairline">
              <span className="text-xs text-slate-600 leading-relaxed">
                Location confirmed? Proceed to submit your incident report with this pinpointed
                coordinate.
              </span>
              <Link
                href="/citizen/report"
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl border border-blue-600 shadow-hairline transition-[background-color,transform] duration-150 active:scale-[0.98] shrink-0"
              >
                <span>Proceed to Report</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function MapsExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
          <span className="text-xs font-medium text-slate-600">
            Loading Geospatial Explorer...
          </span>
        </div>
      }
    >
      <MapsExplorerContent />
    </Suspense>
  );
}
