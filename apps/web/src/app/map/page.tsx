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
import { CATEGORY_COLORS, STATUS_COLORS, DEFAULT_MAP_CENTER } from "../../lib/ola-maps-config";
import {
  MapPin,
  Navigation,
  Layers,
  ArrowLeft,
  ShieldAlert,
  Info,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Compass,
  Filter,
  Crosshair,
  ChevronRight,
  Camera,
  ExternalLink,
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
      <div className="w-full h-[620px] rounded-2xl border border-border bg-card/60 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">
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
  const queryRef = searchParams.get("ref");

  const [activeTab, setActiveTab] = useState<"city" | "picker">("city");

  // Geolocation tracking
  const {
    coords: userCoords,
    accuracy: locationAccuracy,
    isTracking,
    permissionGranted,
    error: geoError,
    getCurrentPosition,
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

  // Selected complaint object
  const activeComplaint = useMemo(() => {
    if (!selectedComplaintId) return complaintsWithDistance[0] || null;
    return complaintsWithDistance.find((c) => c.id === selectedComplaintId) || null;
  }, [selectedComplaintId, complaintsWithDistance]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors min-h-[44px] py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <h1 className="text-sm font-bold text-foreground tracking-wide">
                City Incident Map
              </h1>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab("city")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                  activeTab === "city"
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Issues Map</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("picker")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                  activeTab === "picker"
                    ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Location Finder</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Tab A: City Map View */}
        {activeTab === "city" && (
          <div className="flex flex-col gap-5">
            {/* Control Bar: Location status & radius selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-base font-bold text-foreground">
                    Municipal Issues Around Your Location
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {userCoords ? (
                    <span className="flex items-center gap-1 text-primary text-[11px]">
                      <Crosshair className="w-3.5 h-3.5" />
                      GPS Detected: [{userCoords[0].toFixed(4)}, {userCoords[1].toFixed(4)}]
                      {locationAccuracy ? ` (±${Math.round(locationAccuracy)}m)` : ""}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {geoError ? "GPS Permission Denied. Showing Default Municipal Zone." : "Acquiring GPS location..."}
                    </span>
                  )}

                  <span>•</span>
                  <span>Radius: <strong className="text-foreground">{radiusMeters / 1000} km</strong></span>
                </div>
              </div>

              {/* Radius Options, Closed Toggle & Refresh */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-secondary/60 p-1 rounded-xl border border-border gap-1">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRadiusMeters(opt.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        radiusMeters === opt.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Feature: Hide / Show Closed Issues Toggle */}
                <button
                  type="button"
                  onClick={() => setShowClosed((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    showClosed
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 shadow-xs"
                      : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                  }`}
                  title={showClosed ? "Closed complaints are currently shown on the map" : "Closed complaints are hidden from the map"}
                >
                  {showClosed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Closed Issues: Shown</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>Closed Issues: Hidden</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={fetchNearbyComplaints}
                  className="p-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 border border-border transition-colors"
                  title="Refresh Nearby Issues"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
                </button>
              </div>
            </div>

            {/* Filter Pills Bar: Status and Category */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-primary" /> Filter Status:
                </span>
                {STATUS_FILTERS.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => setStatusFilter(st.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                      statusFilter === st.value
                        ? "bg-primary/10 text-primary border-primary shadow-sm"
                        : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-primary" /> Filter Category:
                </span>
                {CATEGORY_FILTERS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategoryFilter(cat.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all border ${
                      categoryFilter === cat.value
                        ? "bg-primary/10 text-primary border-primary shadow-sm"
                        : "bg-secondary text-muted-foreground hover:text-foreground border-border"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Zero complaints within radius advisory */}
            {displayedComplaints.length === 0 && !isLoading && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Info className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-300">
                      No active open issues reported within {radiusMeters / 1000} km of your GPS coordinates.
                    </p>
                    {!showClosed && statusFilter !== ComplaintStatus.CLOSED && (
                      <p className="text-[11px] text-amber-400/80 mt-0.5">
                        Closed complaints are hidden from the map by default.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!showClosed && statusFilter !== ComplaintStatus.CLOSED && (
                    <button
                      type="button"
                      onClick={() => setShowClosed(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Show Closed Issues</span>
                    </button>
                  )}
                  {radiusMeters < 100000 && (
                    <button
                      type="button"
                      onClick={() => setRadiusMeters(100000)}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors shrink-0 shadow-md"
                    >
                      Expand to Citywide (100 km)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* The Dynamic Spatial Map */}
            <div className="rounded-2xl overflow-hidden border border-border shadow-2xl relative">
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
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>Active Issues Sorted by Proximity ({complaintsWithDistance.length})</span>
                  </h3>
                  <span className="text-xs text-muted-foreground">Click any card to fly map camera to incident</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {complaintsWithDistance.map((c) => {
                    const isSelected = selectedComplaintId === c.id;
                    const catColor = CATEGORY_COLORS[c.category as ComplaintCategory] || "#14b8a6";
                    const statusConfig = STATUS_COLORS[c.status as ComplaintStatus] || {
                      bg: "bg-secondary",
                      text: "text-muted-foreground",
                      border: "border-border",
                    };

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedComplaintId(isSelected ? null : c.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 text-xs bg-card ${
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 shadow-lg bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-secondary/20 shadow-sm"
                        }`}
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-primary text-xs">
                              {c.referenceNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {c.distanceKm !== null && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                                  <Navigation className="w-2.5 h-2.5" />
                                  {formatDistance(c.distanceKm)}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border capitalize ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                              >
                                {c.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>

                          <h4 className="font-bold text-foreground text-sm line-clamp-2">
                            {c.title}
                          </h4>

                          <p className="text-muted-foreground line-clamp-2 text-[11px] leading-relaxed">
                            {c.description || "Civic infrastructure issue reported by citizen"}
                          </p>
                        </div>

                        <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
                          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: catColor }}
                            />
                            <span className="capitalize">{c.category.replace(/_/g, " ")}</span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1 truncate max-w-[200px]">
                              <MapPin className="w-3 h-3 text-primary shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>

                            <Link
                              href={`/citizen/complaints/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0"
                            >
                              <span>Details</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
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
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Complaint Location Pin Picker
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drop pin on map or enter GPS coordinates manually. Reverse geocoding provides address suggestions.
              </p>
            </div>

            <LocationPicker
              value={pickedLocation}
              address={pickedAddress}
              onChange={(loc, addr) => {
                hasAutoSyncedPickerRef.current = true;
                setPickedLocation(loc);
                if (addr) setPickedAddress(addr);
              }}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/60 mt-1">
              <span className="text-xs text-muted-foreground">
                Location confirmed? Proceed to submit your incident report with this pinpointed coordinate.
              </span>
              <Link
                href="/citizen/report"
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary/90 transition-all shadow-md shrink-0"
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
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading Geospatial Explorer...</span>
        </div>
      }
    >
      <MapsExplorerContent />
    </Suspense>
  );
}
