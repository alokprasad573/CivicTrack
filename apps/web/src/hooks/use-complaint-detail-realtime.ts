"use client";

import { useEffect, useRef } from "react";
import {
  SocketEvent,
  ComplaintStatusUpdatedPayload,
  ComplaintAssignedPayload,
} from "@civictrack/contracts";
import { useSocket, checkAndRecordEventDedupe } from "./use-socket";

export interface UseComplaintDetailRealtimeOptions {
  complaintId?: string;
  onStatusUpdated?: (update: ComplaintStatusUpdatedPayload) => void;
  onAssigned?: (assignment: ComplaintAssignedPayload) => void;
  onRefresh?: () => void;
  enabled?: boolean;
}

/**
 * Hook for complaint detail screens to join complaint room, receive real-time updates, and recover on reconnect
 */
export function useComplaintDetailRealtime(options: UseComplaintDetailRealtimeOptions) {
  const { on, joinRoom, leaveRoom, isConnected, onReconnect } = useSocket();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const complaintId = options.complaintId;
    if (!complaintId || options.enabled === false) return;

    const roomName = `complaint:${complaintId}`;
    joinRoom(roomName);

    // Listen to status updates
    const unsubStatus = on(
      SocketEvent.COMPLAINT_STATUS_UPDATED,
      (data: ComplaintStatusUpdatedPayload) => {
        if (!data || data.complaintId !== complaintId) return;
        const sig = `detail:status:${complaintId}:${data.status}:${data.updatedAt || ""}`;
        if (checkAndRecordEventDedupe(sig)) return;

        if (optionsRef.current.onStatusUpdated) {
          optionsRef.current.onStatusUpdated(data);
        } else if (optionsRef.current.onRefresh) {
          optionsRef.current.onRefresh();
        }
      }
    );

    // Listen to assignments
    const unsubAssigned = on(
      SocketEvent.COMPLAINT_ASSIGNED,
      (data: ComplaintAssignedPayload) => {
        if (!data || data.complaintId !== complaintId) return;
        const sig = `detail:assigned:${complaintId}:${data.departmentId}:${data.assignedOfficerId || ""}:${data.updatedAt || ""}`;
        if (checkAndRecordEventDedupe(sig)) return;

        if (optionsRef.current.onAssigned) {
          optionsRef.current.onAssigned(data);
        } else if (optionsRef.current.onRefresh) {
          optionsRef.current.onRefresh();
        }
      }
    );

    // Recovery on connection reconnect
    const unsubReconnect = onReconnect(() => {
      if (optionsRef.current.onRefresh) {
        optionsRef.current.onRefresh();
      }
    });

    return () => {
      leaveRoom(roomName);
      unsubStatus();
      unsubAssigned();
      unsubReconnect();
    };
  }, [options.complaintId, options.enabled, joinRoom, leaveRoom, on, onReconnect]);

  return { isConnected };
}
