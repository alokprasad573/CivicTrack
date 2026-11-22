"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Marker, Popup } from "maplibre-gl";
import { ComplaintCategory, ComplaintStatus, Coordinates } from "@civictrack/contracts";
import { CATEGORY_COLORS } from "../../lib/ola-maps-config";
import { generateComplaintPopupHtml } from "./map-popup-generator";
import { MapComplaintItem, isValidCoordinatePair } from "../../hooks/use-complaint-markers";
import { getMapLibre } from "../../lib/maplibre-loader";

export interface MapMarkerLayerProps {
  map: any | null;
  complaints: MapComplaintItem[];
  selectedComplaintId?: string | null;
  onSelectComplaint?: (complaint: MapComplaintItem) => void;
  enableClustering?: boolean;
  userRole?: "citizen" | "admin" | "officer";
}

interface ClusterGroup {
  id: string;
  center: Coordinates;
  complaints: MapComplaintItem[];
}

const STATUS_INDICATOR_COLORS: Record<ComplaintStatus, string> = {
  [ComplaintStatus.SUBMITTED]: "#fbbf24",     // Amber
  [ComplaintStatus.UNDER_REVIEW]: "#22d3ee",  // Cyan
  [ComplaintStatus.VERIFIED]: "#818cf8",      // Indigo
  [ComplaintStatus.ASSIGNED]: "#60a5fa",      // Blue
  [ComplaintStatus.IN_PROGRESS]: "#2dd4bf",   // Teal
  [ComplaintStatus.RESOLVED]: "#34d399",      // Emerald
  [ComplaintStatus.CLOSED]: "#94a3b8",        // Slate
  [ComplaintStatus.REJECTED]: "#f87171",      // Red
};

export function MapMarkerLayer({
  map,
  complaints,
  selectedComplaintId,
  onSelectComplaint,
  enableClustering = false,
  userRole = "citizen",
}: MapMarkerLayerProps) {
  const activeMarkersRef = useRef<Marker[]>([]);
  const activePopupsRef = useRef<Popup[]>([]);
  const isCancelledRef = useRef(false);

  // Function to render markers (individual + clustered)
  const renderMarkers = useCallback(() => {
    if (!map) return;

    // 1. Clean up existing markers and popups
    activeMarkersRef.current.forEach((marker) => marker.remove());
    activeMarkersRef.current = [];
    activePopupsRef.current.forEach((popup) => popup.remove());
    activePopupsRef.current = [];

    // Filter valid complaints with valid coordinates
    const validComplaints = complaints.filter(
      (c) => c && c.location && isValidCoordinatePair(c.location.coordinates)
    );

    if (validComplaints.length === 0) return;

    getMapLibre()
      .then(({ Marker, Popup }) => {
        if (isCancelledRef.current || !map) return;

        const currentZoom = typeof map.getZoom === "function" ? map.getZoom() : 13;
        const shouldCluster = enableClustering && currentZoom < 14 && validComplaints.length > 5;

        let itemsToRender: MapComplaintItem[] = [];
        let clustersToRender: ClusterGroup[] = [];

        if (!shouldCluster) {
          itemsToRender = validComplaints;
        } else {
          // Screen-space proximity clustering algorithm (radius ~50px)
          const clusterRadiusPx = 50;
          const unassigned: MapComplaintItem[] = [];

          // Always keep the selected complaint unclustered so its popup and highlight are visible
          validComplaints.forEach((c) => {
            if (c.id === selectedComplaintId) {
              itemsToRender.push(c);
            } else {
              unassigned.push(c);
            }
          });

          const clusters: ClusterGroup[] = [];

          unassigned.forEach((complaint) => {
            const [lng, lat] = complaint.location.coordinates;
            let pos: { x: number; y: number } | null = null;
            try {
              pos = map.project([lng, lat]);
            } catch {
              pos = null;
            }

            if (!pos) {
              itemsToRender.push(complaint);
              return;
            }

            let assignedCluster: ClusterGroup | null = null;
            for (const cluster of clusters) {
              const clusterPos = map.project(cluster.center);
              const dist = Math.hypot(pos.x - clusterPos.x, pos.y - clusterPos.y);
              if (dist < clusterRadiusPx) {
                assignedCluster = cluster;
                break;
              }
            }

            if (assignedCluster) {
              assignedCluster.complaints.push(complaint);
              // Update cluster center average
              const count = assignedCluster.complaints.length;
              assignedCluster.center = [
                (assignedCluster.center[0] * (count - 1) + lng) / count,
                (assignedCluster.center[1] * (count - 1) + lat) / count,
              ];
            } else {
              clusters.push({
                id: `cluster_${complaint.id}`,
                center: [lng, lat],
                complaints: [complaint],
              });
            }
          });

          clusters.forEach((cluster) => {
            if (cluster.complaints.length === 1) {
              itemsToRender.push(cluster.complaints[0]!);
            } else {
              clustersToRender.push(cluster);
            }
          });
        }

        // 2. Render Cluster Markers
        clustersToRender.forEach((cluster) => {
          const el = document.createElement("div");
          el.className = "civic-cluster-marker";
          el.style.width = "40px";
          el.style.height = "40px";
          el.style.borderRadius = "50%";
          el.style.background = "linear-gradient(135deg, #0f766e 0%, #0e7490 100%)";
          el.style.border = "2.5px solid #ffffff";
          el.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.6), 0 0 12px rgba(14, 116, 144, 0.5)";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.color = "#ffffff";
          el.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace";
          el.style.fontSize = "13px";
          el.style.fontWeight = "800";
          el.style.cursor = "pointer";
          el.style.transition = "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)";
          el.innerText = String(cluster.complaints.length);
          el.setAttribute("title", `${cluster.complaints.length} complaints in this area. Click to zoom in.`);

          el.addEventListener("mouseenter", () => {
            el.style.transform = "scale(1.15)";
          });
          el.addEventListener("mouseleave", () => {
            el.style.transform = "scale(1)";
          });

          el.addEventListener("click", () => {
            map.flyTo({
              center: cluster.center,
              zoom: Math.min(map.getZoom() + 2.5, 16),
              essential: true,
            });
          });

          const marker = new Marker({
            element: el,
            anchor: "center",
          })
            .setLngLat(cluster.center)
            .addTo(map);

          activeMarkersRef.current.push(marker);
        });

        // 3. Render Individual Complaint Markers
        itemsToRender.forEach((complaint) => {
          const [lng, lat] = complaint.location.coordinates;
          const categoryColor = CATEGORY_COLORS[complaint.category] || "#94a3b8";
          const statusIndicator = STATUS_INDICATOR_COLORS[complaint.status] || "#94a3b8";
          const isSelected = selectedComplaintId === complaint.id;

          const el = document.createElement("div");
          el.className = `civic-marker-container ${isSelected ? "selected-marker" : ""}`;
          el.style.width = isSelected ? "40px" : "30px";
          el.style.height = isSelected ? "40px" : "30px";
          el.style.cursor = "pointer";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.transition = "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)";
          el.style.zIndex = isSelected ? "1000" : "1";

          const haloStyle = isSelected
            ? `box-shadow: 0 0 0 5px rgba(0, 229, 195, 0.55), 0 8px 24px rgba(0,0,0,0.7);`
            : `box-shadow: 0 4px 12px rgba(0,0,0,0.5);`;

          el.innerHTML = `
            <div style="
              position: relative;
              width: 100%;
              height: 100%;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              background: ${categoryColor};
              border: 2px solid #ffffff;
              ${haloStyle}
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: ${isSelected ? "11px" : "8px"};
                height: ${isSelected ? "11px" : "8px"};
                border-radius: 50%;
                background: ${statusIndicator};
                border: 1.5px solid #ffffff;
                transform: rotate(45deg);
              "></div>
            </div>
          `;

          el.addEventListener("mouseenter", () => {
            el.style.transform = isSelected ? "scale(1.15)" : "scale(1.2)";
          });
          el.addEventListener("mouseleave", () => {
            el.style.transform = "scale(1)";
          });

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onSelectComplaint) {
              onSelectComplaint(complaint);
            }
          });

          const popupHtml = generateComplaintPopupHtml({
            id: complaint.id,
            referenceNumber: complaint.referenceNumber,
            title: complaint.title,
            description: complaint.description,
            category: complaint.category,
            status: complaint.status,
            priority: complaint.priority,
            address: complaint.address,
            userRole,
          });

          const popup = new Popup({
            offset: isSelected ? 28 : 22,
            closeButton: true,
            closeOnClick: false,
            className: "civic-complaint-popup",
          }).setHTML(popupHtml);

          const marker = new Marker({
            element: el,
            anchor: "bottom",
          })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);

          activeMarkersRef.current.push(marker);
          activePopupsRef.current.push(popup);

          if (isSelected) {
            popup.addTo(map);
          }
        });
      })
      .catch(() => {
        // Ignored on SSR
      });
  }, [map, complaints, selectedComplaintId, onSelectComplaint, enableClustering, userRole]);

  useEffect(() => {
    isCancelledRef.current = false;
    if (!map) return;

    renderMarkers();

    const handleMapMovement = () => {
      if (enableClustering) {
        renderMarkers();
      }
    };

    map.on("moveend", handleMapMovement);
    map.on("zoomend", handleMapMovement);

    return () => {
      isCancelledRef.current = true;
      map.off("moveend", handleMapMovement);
      map.off("zoomend", handleMapMovement);
      activeMarkersRef.current.forEach((marker) => marker.remove());
      activeMarkersRef.current = [];
      activePopupsRef.current.forEach((popup) => popup.remove());
      activePopupsRef.current = [];
    };
  }, [map, renderMarkers, enableClustering]);

  return null;
}
