import http from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { logger } from "./common/utils/logger.js";
import { initSocketServer, getIO } from "./socket.js";

async function startServer(): Promise<void> {
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  const server = httpServer.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`CivicTrack API server & Socket.io started successfully`, {
      port: env.PORT,
      host: "0.0.0.0",
      environment: env.NODE_ENV,
      clientUrl: env.CLIENT_URL,
    });
  });

  // Connect to MongoDB Atlas asynchronously so server is immediately live and responsive
  connectDatabase().catch((err: unknown) => {
    logger.error("Initial MongoDB connection attempt failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Process-level uncaught exception & rejection handlers to ensure continuous server uptime
  process.on("unhandledRejection", (reason: unknown) => {
    logger.error("Unhandled Rejection detected", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("uncaughtException", (err: Error) => {
    logger.error("Uncaught Exception detected", {
      message: err.message,
      stack: err.stack,
    });
  });

  // Graceful Shutdown
  function handleShutdown(signal: string): void {
    logger.info(`${signal} signal received. Initiating graceful shutdown...`);
    const ioInstance = getIO();
    if (ioInstance) {
      ioInstance.close();
      logger.info("Socket.io connections closed.");
    }

    server.close(async () => {
      logger.info("HTTP server closed.");
      await disconnectDatabase();
      logger.info("Application shut down cleanly. Exiting process.");
      process.exit(0);
    });

    // Force close after 10s timeout
    setTimeout(() => {
      logger.error("Forcefully terminating process after shutdown timeout.");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

startServer().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Fatal startup error", { error: message });
  process.exit(1);
});
