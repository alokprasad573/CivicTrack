import { ComplaintCategory, ComplaintStatus } from "@civictrack/contracts";

export const OLA_MAPS_ENDPOINTS = {
  // Documented Ola Maps Styles & Tilesets
  DEFAULT_LIGHT_STYLE: "https://api.olamaps.io/tiles/vector/v1/styles/default-light-standard/style.json",
  SATELLITE_STYLE: "https://api.olamaps.io/tiles/vector/v1/styles/default-dark-standard-satellite/style.json",
  THREED_TILESET: "https://api.olamaps.io/tiles/vector/v1/3dtiles/tileset.json",
} as const;

/**
 * Default geographic center for CivicTrack initial view (Bangalore Civic Center)
 * Format: [longitude, latitude]
 */
export const DEFAULT_MAP_CENTER: [number, number] = [77.5946, 12.9716];
export const DEFAULT_MAP_ZOOM = 13;

export function getClientOlaMapsApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY ||
    "X4oHN8nq0SpKbJPfuF0dbHOeNlpobHkKzQYtS6Gi"
  );
}

/**
 * Civic category color palette
 */
export const CATEGORY_COLORS: Record<ComplaintCategory, string> = {
  [ComplaintCategory.ROADS_POTHOLES]: "#f59e0b",       // Amber / Potholes & Road Repair
  [ComplaintCategory.WATER_SUPPLY]: "#06b6d4",        // Cyan / Water Pipelines & Leakage
  [ComplaintCategory.GARBAGE_SANITATION]: "#10b981",  // Emerald / Garbage & Cleanliness
  [ComplaintCategory.DRAINAGE_SEWAGE]: "#64748b",     // Slate / Stormwater & Sewage
  [ComplaintCategory.STREETLIGHTS]: "#eab308",        // Yellow / Streetlighting
  [ComplaintCategory.ELECTRICITY]: "#8b5cf6",         // Purple / Power outages
  [ComplaintCategory.OTHER]: "#94a3b8",               // Neutral Gray / General Inquiries
};

/**
 * Status badge styling
 */
export const STATUS_COLORS: Record<ComplaintStatus, { bg: string; text: string; border: string }> = {
  [ComplaintStatus.SUBMITTED]: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
  },
  [ComplaintStatus.UNDER_REVIEW]: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
  },
  [ComplaintStatus.VERIFIED]: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
  },
  [ComplaintStatus.ASSIGNED]: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  [ComplaintStatus.IN_PROGRESS]: {
    bg: "bg-teal-500/10",
    text: "text-teal-300",
    border: "border-teal-500/30",
  },
  [ComplaintStatus.RESOLVED]: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
  },
  [ComplaintStatus.CLOSED]: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-zinc-500/30",
  },
  [ComplaintStatus.REJECTED]: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
  },
};
