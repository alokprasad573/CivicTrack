"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "../lib/api-client";
import { useSocket } from "./use-socket";
import {
  INotification,
  NotificationListResponse,
  SocketEvent,
} from "@civictrack/contracts";

export function useNotifications() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { isConnected, on } = useSocket();

  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastNotification, setToastNotification] = useState<INotification | null>(null);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const data = await apiClient<NotificationListResponse>("notifications?limit=20", {
        token,
      });

      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchNotifications();
    } else if (isLoaded && !isSignedIn) {
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn, fetchNotifications]);

  // Handle incoming real-time socket notifications
  useEffect(() => {
    const unsubscribe = on(SocketEvent.NOTIFICATION_NEW, (newNotif: INotification) => {
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)]);
      setUnreadCount((prev) => prev + 1);

      // Trigger floating toast notification
      setToastNotification(newNotif);

      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => {
        setToastNotification(null);
      }, 6000);
    });

    return () => {
      unsubscribe();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [on]);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastNotification(null);
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const token = await getToken();
        if (token) {
          await apiClient<INotification>(`notifications/${notificationId}/read`, {
            method: "PATCH",
            token,
          });
        }
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
        // Rollback on failure
        fetchNotifications();
      }
    },
    [getToken, fetchNotifications]
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadCount(0);

    try {
      const token = await getToken();
      if (token) {
        await apiClient<{ modifiedCount: number }>("notifications/read-all", {
          method: "POST",
          token,
        });
      }
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
      fetchNotifications();
    }
  }, [getToken, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    toastNotification,
    dismissToast,
    markAsRead,
    markAllAsRead,
    refresh: fetchNotifications,
  };
}
