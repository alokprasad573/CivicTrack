import { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "@civictrack/contracts";
import { CATEGORY_COLORS } from "../../lib/ola-maps-config";

export interface PopupComplaintData {
  id: string;
  referenceNumber: string;
  title: string;
  description?: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority?: ComplaintPriority | string;
  address: string;
  userRole?: "citizen" | "admin" | "officer";
}

const STATUS_COLOR_HEX: Record<ComplaintStatus, { bg: string; text: string; border: string }> = {
  [ComplaintStatus.SUBMITTED]: {
    bg: "rgba(245, 158, 11, 0.15)",
    text: "#fbbf24",
    border: "rgba(245, 158, 11, 0.35)",
  },
  [ComplaintStatus.UNDER_REVIEW]: {
    bg: "rgba(6, 182, 212, 0.15)",
    text: "#22d3ee",
    border: "rgba(6, 182, 212, 0.35)",
  },
  [ComplaintStatus.VERIFIED]: {
    bg: "rgba(99, 102, 241, 0.15)",
    text: "#818cf8",
    border: "rgba(99, 102, 241, 0.35)",
  },
  [ComplaintStatus.ASSIGNED]: {
    bg: "rgba(59, 130, 246, 0.15)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.35)",
  },
  [ComplaintStatus.IN_PROGRESS]: {
    bg: "rgba(20, 184, 166, 0.15)",
    text: "#2dd4bf",
    border: "rgba(20, 184, 166, 0.35)",
  },
  [ComplaintStatus.RESOLVED]: {
    bg: "rgba(16, 185, 129, 0.15)",
    text: "#34d399",
    border: "rgba(16, 185, 129, 0.35)",
  },
  [ComplaintStatus.CLOSED]: {
    bg: "rgba(113, 113, 122, 0.15)",
    text: "#a1a1aa",
    border: "rgba(113, 113, 122, 0.35)",
  },
  [ComplaintStatus.REJECTED]: {
    bg: "rgba(239, 68, 68, 0.15)",
    text: "#f87171",
    border: "rgba(239, 68, 68, 0.35)",
  },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateComplaintPopupHtml(data: PopupComplaintData): string {
  const categoryColor = CATEGORY_COLORS[data.category] || "#94a3b8";
  const categoryLabel = (data.category || "").replace(/_/g, " ");
  const statusLabel = (data.status || "").replace(/_/g, " ");
  const statusStyle = STATUS_COLOR_HEX[data.status] || {
    bg: "rgba(255, 255, 255, 0.08)",
    text: "#e2e8f0",
    border: "rgba(255, 255, 255, 0.15)",
  };

  const detailsHref =
    data.userRole === "admin"
      ? `/admin/complaints/${data.id}`
      : data.userRole === "officer"
      ? `/officer/complaints/${data.id}`
      : `/citizen/complaints/${data.id}`;
  const descriptionSnippet = data.description
    ? data.description.length > 90
      ? data.description.slice(0, 90) + "..."
      : data.description
    : "";

  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 250px; max-width: 290px; padding: 6px; color: #f1f5f9; background: #0f172a; border-radius: 10px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);">
      <!-- Top Row: Ref number & Status -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px;">
        <span style="font-size: 11px; font-weight: 800; font-family: monospace; color: #00e5c3; letter-spacing: 0.5px;">${escapeHtml(data.referenceNumber)}</span>
        <span style="font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px; background: ${statusStyle.bg}; color: ${statusStyle.text}; border: 1px solid ${statusStyle.border}; text-transform: capitalize; white-space: nowrap;">
          ${escapeHtml(statusLabel)}
        </span>
      </div>

      <!-- Title -->
      <div style="font-size: 13px; font-weight: 700; color: #f8fafc; line-height: 1.35; margin-bottom: 5px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
        ${escapeHtml(data.title)}
      </div>

      <!-- Description Snippet (if available) -->
      ${
        descriptionSnippet
          ? `<div style="font-size: 11px; color: #94a3b8; line-height: 1.35; margin-bottom: 7px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
              ${escapeHtml(descriptionSnippet)}
            </div>`
          : ""
      }

      <!-- Category & Priority Row -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; font-size: 11px;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${categoryColor}; flex-shrink: 0;"></span>
          <span style="color: #cbd5e1; text-transform: capitalize; font-weight: 500;">${escapeHtml(categoryLabel)}</span>
        </div>
        ${
          data.priority
            ? `<span style="font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,0.06); color: #94a3b8; text-transform: uppercase;">${escapeHtml(data.priority)}</span>`
            : ""
        }
      </div>

      <!-- Address -->
      <div style="display: flex; align-items: flex-start; gap: 4px; font-size: 11px; color: #64748b; line-height: 1.3; margin-bottom: 10px; word-break: break-word;">
        <span style="flex-shrink: 0;">📍</span>
        <span style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapeHtml(data.address)}</span>
      </div>

      <!-- Action Button -->
      <a href="${escapeHtml(detailsHref)}" style="display: block; width: 100%; text-align: center; padding: 7px 0; background: #00e5c3; color: #020617; font-size: 11px; font-weight: 700; border-radius: 6px; text-decoration: none; cursor: pointer;">
        View Full Details →
      </a>
    </div>
  `;
}
