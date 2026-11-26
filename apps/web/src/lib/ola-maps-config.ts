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
 * Status badge styling (high-contrast light-mode palette)
 */
export const STATUS_COLORS: Record<ComplaintStatus, { bg: string; text: string; border: string }> = {
  [ComplaintStatus.SUBMITTED]: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  [ComplaintStatus.UNDER_REVIEW]: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
  },
  [ComplaintStatus.VERIFIED]: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    border: "border-sky-200",
  },
  [ComplaintStatus.ASSIGNED]: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  [ComplaintStatus.IN_PROGRESS]: {
    bg: "bg-teal-50",
    text: "text-teal-800",
    border: "border-teal-200",
  },
  [ComplaintStatus.RESOLVED]: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
  },
  [ComplaintStatus.CLOSED]: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  [ComplaintStatus.REJECTED]: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
};
