import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../common/utils/logger.js";

// Ensure Node uses reliable public DNS resolvers (Google & Cloudflare)
// to resolve MongoDB Atlas SRV records when local Wi-Fi or ISP DNS refuses SRV queries
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (dnsErr) {
  logger.warn("Could not set custom DNS servers for MongoDB SRV resolution", {
    error: dnsErr instanceof Error ? dnsErr.message : String(dnsErr),
  });
}

const STATE_NAMES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

let autoReconnectTimer: NodeJS.Timeout | null = null;
let isIntentionallyDisconnected = false;

// Set fast fail timeout for buffered commands when database is disconnected
mongoose.set("bufferTimeoutMS", 3000);

// Wire up mongoose connection event listeners
mongoose.connection.on("connected", () => {
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer);
    autoReconnectTimer = null;
  }
  logger.info("MongoDB connection established successfully", {
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  });
});

mongoose.connection.on("error", (err: Error) => {
  logger.error("MongoDB connection encountered an error", {
    error: err.message,
  });
  scheduleAutoReconnect();
});

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB connection disconnected");
  scheduleAutoReconnect();
});

mongoose.connection.on("reconnected", () => {
  logger.info("MongoDB connection re-established");
});

function scheduleAutoReconnect(): void {
  if (isIntentionallyDisconnected) return;
  if (autoReconnectTimer) return;
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;

  logger.info("Scheduling MongoDB automatic reconnection attempt in 5 seconds...");
  autoReconnectTimer = setTimeout(async () => {
    autoReconnectTimer = null;
    if (mongoose.connection.readyState === 0) {
      logger.info("Attempting automatic reconnection to MongoDB Atlas...");
      await connectDatabase();
    }
  }, 5000);
  autoReconnectTimer.unref();
}

export async function connectDatabase(): Promise<boolean> {
  isIntentionallyDisconnected = false;

  if (!env.ATLAS_URI) {
    logger.warn("ATLAS_URI is not configured. Starting API without database connection.");
    return false;
  }

  if (env.ATLAS_URI.includes("<cluster-host>") || env.ATLAS_URI.includes("<db_user>")) {
    logger.warn(
      "ATLAS_URI contains placeholder values (<cluster-host> / <db_user>). Replace with your actual MongoDB Atlas cluster credentials in apps/server/.env."
    );
    return false;
  }

  // Already connected
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    logger.info("Connecting to MongoDB Atlas...");
    await mongoose.connect(env.ATLAS_URI, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 20,
      minPoolSize: 1,
      retryWrites: true,
      retryReads: true,
      family: 4, // Force IPv4 to prevent Windows / Atlas IPv6 TLS negotiation timeouts
      autoIndex: env.NODE_ENV !== "production",
    });

    // Ensure critical geospatial and model indexes are built even in production environments
    try {
      const { ComplaintModel } = await import("../modules/complaints/complaint.model.js");
      const { UserModel } = await import("../modules/users/user.model.js");
      const { DepartmentModel } = await import("../modules/departments/department.model.js");
      await Promise.allSettled([
        ComplaintModel.createIndexes(),
        UserModel.createIndexes(),
        DepartmentModel.createIndexes(),
      ]);
      logger.info("Database indexes verified (geospatial 2dsphere and unique constraints synced)");
    } catch (idxErr) {
      logger.warn("Non-blocking index synchronization notice", { error: idxErr });
    }

    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to connect to MongoDB Atlas", { error: message });
    scheduleAutoReconnect();
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  isIntentionallyDisconnected = true;
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer);
    autoReconnectTimer = null;
  }

  if (mongoose.connection.readyState !== 0) {
    try {
      logger.info("Closing MongoDB connection...");
      await mongoose.disconnect();
      logger.info("MongoDB connection closed cleanly");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Error while disconnecting from MongoDB", { error: message });
    }
  }
}

export function getDatabaseHealth(): {
  isConnected: boolean;
  state: string;
  host?: string;
  name?: string;
} {
  const readyState = mongoose.connection.readyState;
  const state = STATE_NAMES[readyState] ?? "unknown";
  const isConnected = readyState === 1;

  return {
    isConnected,
    state,
    host: isConnected ? mongoose.connection.host : undefined,
    name: isConnected ? mongoose.connection.name : undefined,
  };
}
