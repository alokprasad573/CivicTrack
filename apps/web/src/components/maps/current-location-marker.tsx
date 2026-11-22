"use client";

import { useEffect, useRef } from "react";
import type { Marker } from "maplibre-gl";
import { Coordinates } from "@civictrack/contracts";
import { getMapLibre } from "../../lib/maplibre-loader";

export interface CurrentLocationMarkerProps {
  map: any | null;
  coords: Coordinates | null;
  accuracy?: number | null;
  label?: string;
  isLocating?: boolean;
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

/**
 * Dedicated Current Location Marker
 *
 * Renders a distinct pulsing GPS beacon for the citizen or admin's active device position.
 * This marker is completely independent of complaint markers and is never removed
 * or overwritten when complaints are selected or filtered.
 */
export function CurrentLocationMarker({
  map,
  coords,
  accuracy,
  label = "Your Current Location",
  isLocating = false,
}: CurrentLocationMarkerProps) {
  const markerRef = useRef<Marker | null>(null);
  const popupRef = useRef<any | null>(null);
  const isCancelledRef = useRef(false);

  // Update popup HTML helper
  const getPopupHtml = (lat: number, lng: number, acc?: number | null) => {
    const accuracyText =
      typeof acc === "number" && !isNaN(acc)
        ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Estimated Accuracy: ±${Math.round(acc)}m</div>`
      : "";

    return `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 6px 8px; color: #f8fafc; background: #0f172a; border-radius: 8px; border: 1px solid rgba(0, 229, 195, 0.3);">
        <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: #00e5c3;">
          <span style="font-size: 14px;">📍</span>
          <span>${label}</span>
        </div>
        ${accuracyText}
        <div style="font-size: 9px; color: #64748b; font-family: monospace; margin-top: 4px;">
          ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E
        </div>
      </div>
    `;
  };

  useEffect(() => {
    isCancelledRef.current = false;

    if (!map || !isValidCoordinates(coords)) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
        popupRef.current = null;
      }
      return;
    }

    const [lng, lat] = coords;

    // If marker already exists on map, update its position smoothly and update popup
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      if (popupRef.current) {
        popupRef.current.setHTML(getPopupHtml(lat, lng, accuracy));
      }
      return;
    }

    // Create marker if it does not exist yet
    getMapLibre()
      .then(({ Marker, Popup }) => {
        if (isCancelledRef.current || !map || markerRef.current) return;

        // Create custom DOM element for GPS Location beacon with pulsing radar ring
        const el = document.createElement("div");
        el.className = "civic-current-location-marker";
        el.style.position = "relative";
        el.style.width = "40px";
        el.style.height = "40px";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.pointerEvents = "auto";
        el.style.cursor = "pointer";
        el.setAttribute("title", label);

        el.innerHTML = `
          <style>
            @keyframes civic-gps-pulse {
              0% {
                transform: scale(0.6);
                opacity: 0.9;
              }
              70% {
                transform: scale(1.6);
                opacity: 0;
              }
              100% {
                transform: scale(1.8);
                opacity: 0;
              }
            }
          </style>
          <!-- Pulsing Radar Ring (Accuracy Halo) -->
          <div style="
            position: absolute;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: rgba(0, 229, 195, 0.35);
            animation: civic-gps-pulse 2.2s cubic-bezier(0.2, 0.8, 0.4, 1) infinite;
            pointer-events: none;
          "></div>

          <!-- Outer Solid Ring with Drop Shadow -->
          <div style="
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #00e5c3;
            border: 3px solid #ffffff;
            box-shadow: 0 0 12px rgba(0, 229, 195, 0.8), 0 3px 8px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <!-- Inner Core Dot -->
            <div style="
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #0f172a;
            "></div>
          </div>
        `;

        const popup = new Popup({
          offset: 15,
          closeButton: false,
          closeOnClick: false,
          className: "civic-gps-popup",
        }).setHTML(getPopupHtml(lat, lng, accuracy));

        popupRef.current = popup;

        el.addEventListener("mouseenter", () => popup.addTo(map));
        el.addEventListener("mouseleave", () => popup.remove());

        const marker = new Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        markerRef.current = marker;
      })
      .catch(() => {
        // Ignored on SSR
      });

    return () => {
      // Only clean up on unmount or when map changes
    };
  }, [map, coords, accuracy, label, isLocating]);

  // Clean up marker when component unmounts
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
        popupRef.current = null;
      }
    };
  }, []);

  return null;
}
