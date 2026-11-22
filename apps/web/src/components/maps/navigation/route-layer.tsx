"use client";

import { useEffect, useRef } from "react";
import type { Marker, LngLatBounds, GeoJSONSource } from "maplibre-gl";
import { Coordinates, RouteCalculationResult } from "@civictrack/contracts";
import { getMapLibre } from "../../../lib/maplibre-loader";

export interface RouteLayerProps {
  map: any | null;
  route: RouteCalculationResult | null;
  currentGps: Coordinates | null;
  isNavigating: boolean;
  heading?: number | null;
}

export function RouteLayer({
  map,
  route,
  currentGps,
  isNavigating,
  heading,
}: RouteLayerProps) {
  const userMarkerRef = useRef<Marker | null>(null);
  const routeSourceAddedRef = useRef(false);

  // 1. Draw Route Polyline Layer
  useEffect(() => {
    if (!map) return;

    const sourceId = "civic-route-source";
    const layerId = "civic-route-line";
    const casingLayerId = "civic-route-casing";

    const removeRouteLayers = () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getLayer(casingLayerId)) map.removeLayer(casingLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        routeSourceAddedRef.current = false;
      } catch {
        // ignore removal errors
      }
    };

    if (!route) {
      removeRouteLayers();
      return;
    }

    const geojsonData: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: route.geometry,
    };

    if (map.getSource(sourceId)) {
      // Update existing source
      (map.getSource(sourceId) as GeoJSONSource).setData(geojsonData);
    } else {
      // Add new route source and layers
      try {
        map.addSource(sourceId, {
          type: "geojson",
          data: geojsonData,
        });

        // Dark casing outline for visibility
        map.addLayer({
          id: casingLayerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#020617",
            "line-width": 8,
            "line-opacity": 0.8,
          },
        });

        // Vibrant cyan/teal primary polyline
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#00e5c3",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });

        routeSourceAddedRef.current = true;

        // Fit map bounds to show full route initially
        if (!isNavigating) {
          getMapLibre().then(({ LngLatBounds }) => {
            if (!map) return;
            const bounds = new LngLatBounds();
            route.geometry.coordinates.forEach((coord) => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Failed to render route layers on map:", err);
      }
    }

    return () => {
      removeRouteLayers();
    };
  }, [map, route, isNavigating]);

  // 2. User Location Live GPS Marker & Camera Tracking
  useEffect(() => {
    if (!map || !currentGps) return;

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "civic-user-gps-marker";
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.position = "relative";
      el.innerHTML = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(0, 229, 195, 0.25);
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          position: absolute;
          inset: 0;
        "></div>
        <div style="
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #00e5c3;
          border: 3px solid #ffffff;
          box-shadow: 0 0 10px rgba(0, 229, 195, 0.8);
          position: absolute;
          top: 5px;
          left: 5px;
        "></div>
      `;

      getMapLibre().then(({ Marker }) => {
        if (!map || !currentGps) return;
        userMarkerRef.current = new Marker({
          element: el,
          anchor: "center",
        })
          .setLngLat(currentGps)
          .addTo(map);
      }).catch(() => {});
    } else {
      userMarkerRef.current.setLngLat(currentGps);
    }

    // Dynamic Camera Tracking in active Navigation Mode
    if (isNavigating) {
      map.easeTo({
        center: currentGps,
        zoom: 17,
        pitch: 50,
        bearing: heading ?? 0,
        duration: 1000,
      });
    }

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [map, currentGps, isNavigating, heading]);

  return null;
}
