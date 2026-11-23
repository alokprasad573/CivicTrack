"use client";

import { useEffect, useRef } from "react";
import {
  SocketEvent,
  ComplaintCreatedPayload,
  ComplaintStatusUpdatedPayload,
  ComplaintAssignedPayload,
  DashboardStatsUpdatedPayload,
} from "@civictrack/contracts";
import { useSocket, checkAndRecordEventDedupe } from "./use-socket";

export interface UseRealtimeComplaintsOptions {
  onCreated?: (complaint: ComplaintCreatedPayload) => void;
  onStatusUpdated?: (update: ComplaintStatusUpdatedPayload) => void;
  onAssigned?: (assignment: ComplaintAssignedPayload) => void;
  onStatsUpdated?: (stats: DashboardStatsUpdatedPayload) => void;
  onReconnect?: () => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time complaint workflow updates with automated deduping and reconnection recovery
 */
export function useRealtimeComplaints(options: UseRealtimeComplaintsOptions = {}) {
  const { on, isConnected, onReconnect } = useSocket();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (options.enabled === false) return;

    // Handle COMPLAINT_CREATED
    const unsubCreated = on(
      SocketEvent.COMPLAINT_CREATED,
      (data: ComplaintCreatedPayload) => {
        if (!data || !data.complaintId) return;
        const sig = `created:${data.complaintId}:${data.createdAt || ""}`;
        if (checkAndRecordEventDedupe(sig)) return;

        if (optionsRef.current.onCreated) {
          optionsRef.current.onCreated(data);
        }
      }
    );

    // Handle COMPLAINT_STATUS_UPDATED
    const unsubStatus = on(
      SocketEvent.COMPLAINT_STATUS_UPDATED,
      (data: ComplaintStatusUpdatedPayload) => {
        if (!data || !data.complaintId) return;
        const sig = `status:${data.complaintId}:${data.status}:${data.updatedAt || ""}`;
        if (checkAndRecordEventDedupe(sig)) return;

        if (optionsRef.current.onStatusUpdated) {
          optionsRef.current.onStatusUpdated(data);
        }
      }
    );

    // Handle COMPLAINT_ASSIGNED
    const unsubAssigned = on(
      SocketEvent.COMPLAINT_ASSIGNED,
      (data: ComplaintAssignedPayload) => {
        if (!data || !data.complaintId) return;
        const sig = `assigned:${data.complaintId}:${data.departmentId}:${data.assignedOfficerId || ""}:${data.updatedAt || ""}`;
        if (checkAndRecordEventDedupe(sig)) return;

        if (optionsRef.current.onAssigned) {
          optionsRef.current.onAssigned(data);
        }
      }
    );

    // Handle DASHBOARD_STATS_UPDATED
    const unsubStats = on(
      SocketEvent.DASHBOARD_STATS_UPDATED,
      (data: DashboardStatsUpdatedPayload) => {
        if (!data) return;
        const sig = `stats:${data.scope}:${data.departmentId || ""}:${data.timestamp || ""}`;
        if (checkAndRecordEventDedupe(sig)) return;

        if (optionsRef.current.onStatsUpdated) {
          optionsRef.current.onStatsUpdated(data);
        }
      }
    );

    // Register reconnect handler to fetch fresh state from REST API
    const unsubReconnect = onReconnect(() => {
      if (optionsRef.current.onReconnect) {
        optionsRef.current.onReconnect();
      }
    });

    return () => {
      unsubCreated();
      unsubStatus();
      unsubAssigned();
      unsubStats();
      unsubReconnect();
    };
  }, [on, onReconnect, options.enabled]);

  return { isConnected };
}
