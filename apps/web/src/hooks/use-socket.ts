"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { io, Socket } from "socket.io-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";
const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export function useSocket() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const listenersRef = useRef<Map<string, Set<(...args: any[]) => void>>>(new Map());

  useEffect(() => {
    let active = true;

    async function initSocket() {
      const isStaffPortal =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/officer")) &&
        !window.location.pathname.includes("/login");

      // For citizen portals, require Clerk sign-in. For staff portals, rely on httpOnly staff JWT cookies.
      if (!isStaffPortal && (!isLoaded || !isSignedIn)) {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
          setIsConnected(false);
        }
        return;
      }

      try {
        let token: string | null = null;
        if (!isStaffPortal) {
          token = await getToken();
          if (!token || !active) return;
        }

        if (socketRef.current?.connected) {
          return;
        }

        const socket = io(SOCKET_URL, {
          auth: token ? { token } : undefined,
          withCredentials: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1500,
          transports: ["websocket", "polling"],
        });

        socket.on("connect", () => {
          if (active) {
            setIsConnected(true);
            // Re-bind all registered event listeners on connection / reconnection
            listenersRef.current.forEach((callbacks, event) => {
              callbacks.forEach((cb) => {
                socket.on(event, cb);
              });
            });
          }
        });

        socket.on("disconnect", () => {
          if (active) setIsConnected(false);
        });

        socket.on("connect_error", () => {
          if (active) setIsConnected(false);
        });

        socketRef.current = socket;
      } catch (err) {
        console.warn("Failed to connect Socket.io client:", err);
      }
    }

    initSocket();

    return () => {
      active = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isLoaded, isSignedIn, getToken]);

  const on = useCallback((event: string, callback: (...args: any[]) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }

    return () => {
      const callbacks = listenersRef.current.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          listenersRef.current.delete(event);
        }
      }
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    on,
  };
}
