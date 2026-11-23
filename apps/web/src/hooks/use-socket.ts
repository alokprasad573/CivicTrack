"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { io, Socket } from "socket.io-client";
import { SocketEvent } from "@civictrack/contracts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

// Module-level shared singleton socket state across React components
let sharedSocket: Socket | null = null;
let subscribersCount = 0;
let disconnectTimer: NodeJS.Timeout | null = null;
const globalListeners = new Map<string, Set<(...args: any[]) => void>>();
const joinedRooms = new Set<string>();
const reconnectCallbacks = new Set<() => void>();
let wasConnectedOnce = false;

// Sliding-window event deduplication set (TTL: 10 seconds)
const seenEventSignatures = new Map<string, number>();

export function checkAndRecordEventDedupe(signature: string, ttlMs = 10000): boolean {
  const now = Date.now();
  // Clean up expired signatures
  for (const [key, timestamp] of seenEventSignatures.entries()) {
    if (now - timestamp > ttlMs) {
      seenEventSignatures.delete(key);
    }
  }

  if (seenEventSignatures.has(signature)) {
    return true; // Already processed (duplicate)
  }

  seenEventSignatures.set(signature, now);
  return false; // New event
}

export function useSocket() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(Boolean(sharedSocket?.connected));
  const localListenersRef = useRef<Array<{ event: string; callback: (...args: any[]) => void }>>([]);
  const localRoomsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    async function setupSocket() {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }

      const isStaffPortal =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/officer")) &&
        !window.location.pathname.includes("/login");

      // For citizen portals, require Clerk sign-in. For staff portals, rely on httpOnly staff JWT cookies.
      if (!isStaffPortal && (!isLoaded || !isSignedIn)) {
        if (sharedSocket) {
          sharedSocket.disconnect();
          sharedSocket = null;
          setIsConnected(false);
          wasConnectedOnce = false;
        }
        return;
      }

      try {
        let token: string | null = null;
        if (!isStaffPortal) {
          token = await getToken();
          if (!token || !active) return;
        }

        if (!sharedSocket) {
          subscribersCount++;
          const socket = io(SOCKET_URL, {
            auth: token ? { token } : undefined,
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 15,
            reconnectionDelay: 1500,
            reconnectionDelayMax: 5000,
            transports: ["websocket", "polling"],
          });

          socket.on("connect", () => {
            setIsConnected(true);

            // Re-join any active rooms
            joinedRooms.forEach((room) => {
              socket.emit("join", room);
            });

            // Re-bind global listeners
            globalListeners.forEach((callbacks, event) => {
              callbacks.forEach((cb) => {
                socket.off(event, cb);
                socket.on(event, cb);
              });
            });

            // Trigger recovery callbacks if reconnecting after an existing session
            if (wasConnectedOnce) {
              reconnectCallbacks.forEach((cb) => {
                try {
                  cb();
                } catch (err) {
                  console.warn("Error in socket reconnect recovery handler:", err);
                }
              });
            }
            wasConnectedOnce = true;
          });

          socket.on("disconnect", () => {
            setIsConnected(false);
          });

          socket.on("connect_error", () => {
            setIsConnected(false);
          });

          sharedSocket = socket;
        } else {
          subscribersCount++;
          if (sharedSocket.connected) {
            setIsConnected(true);
          }
        }
      } catch (err) {
        console.warn("Failed to connect Socket.io client:", err);
      }
    }

    setupSocket();

    return () => {
      active = false;
      subscribersCount = Math.max(0, subscribersCount - 1);

      // Clean up local listeners
      localListenersRef.current.forEach(({ event, callback }) => {
        const callbacks = globalListeners.get(event);
        if (callbacks) {
          callbacks.delete(callback);
          if (callbacks.size === 0) {
            globalListeners.delete(event);
          }
        }
        if (sharedSocket) {
          sharedSocket.off(event, callback);
        }
      });
      localListenersRef.current = [];

      // Clean up local rooms
      localRoomsRef.current.forEach((room) => {
        joinedRooms.delete(room);
        if (sharedSocket?.connected) {
          sharedSocket.emit("leave", room);
        }
      });
      localRoomsRef.current.clear();

      // Defer socket disconnection slightly to avoid tearing down connection across SPA route transitions
      if (subscribersCount === 0 && sharedSocket) {
        disconnectTimer = setTimeout(() => {
          if (subscribersCount === 0 && sharedSocket) {
            sharedSocket.disconnect();
            sharedSocket = null;
            wasConnectedOnce = false;
          }
        }, 15000);
      }
    };
  }, [isLoaded, isSignedIn, getToken]);

  const on = useCallback((event: SocketEvent | string, callback: (...args: any[]) => void) => {
    const eventName = String(event);

    if (!globalListeners.has(eventName)) {
      globalListeners.set(eventName, new Set());
    }
    globalListeners.get(eventName)!.add(callback);
    localListenersRef.current.push({ event: eventName, callback });

    if (sharedSocket) {
      sharedSocket.on(eventName, callback);
    }

    return () => {
      const callbacks = globalListeners.get(eventName);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          globalListeners.delete(eventName);
        }
      }
      if (sharedSocket) {
        sharedSocket.off(eventName, callback);
      }
      localListenersRef.current = localListenersRef.current.filter((item) => item.callback !== callback);
    };
  }, []);

  const joinRoom = useCallback((room: string) => {
    joinedRooms.add(room);
    localRoomsRef.current.add(room);
    if (sharedSocket?.connected) {
      sharedSocket.emit("join", room);
    }
  }, []);

  const leaveRoom = useCallback((room: string) => {
    joinedRooms.delete(room);
    localRoomsRef.current.delete(room);
    if (sharedSocket?.connected) {
      sharedSocket.emit("leave", room);
    }
  }, []);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacks.add(callback);
    return () => {
      reconnectCallbacks.delete(callback);
    };
  }, []);

  return {
    socket: sharedSocket,
    isConnected,
    on,
    joinRoom,
    leaveRoom,
    onReconnect,
  };
}
