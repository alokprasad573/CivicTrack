import express, { Express, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import { env } from "./config/env.js";
import { getDatabaseHealth } from "./config/database.js";
import { requestIdMiddleware } from "./common/middleware/request-id.middleware.js";
import { notFoundMiddleware } from "./common/middleware/not-found.middleware.js";
import { errorMiddleware } from "./common/middleware/error.middleware.js";
import { ApiResponse } from "@civictrack/contracts";
import { identityRoutes } from "./modules/identity/identity.routes.js";
import { userRoutes } from "./modules/users/user.routes.js";
import { departmentRoutes } from "./modules/departments/department.routes.js";
import { complaintRoutes } from "./modules/complaints/complaint.routes.js";
import { storageRoutes } from "./modules/storage/storage.routes.js";
import { mapRoutes } from "./modules/maps/maps.routes.js";
import { notificationRoutes } from "./modules/notifications/notification.routes.js";
import { analyticsRoutes } from "./modules/analytics/analytics.routes.js";
import { duplicateRoutes } from "./modules/duplicate-detection/duplicate-detection.routes.js";
import { slaRoutes } from "./modules/sla/sla.routes.js";
import {
  adminAuthRoutes,
  officerAuthRoutes,
  staffInvitationRoutes,
  adminInvitationRoutes,
} from "./modules/staff-auth/staff-auth.routes.js";
import { sanitizeInputMiddleware } from "./common/middleware/sanitize.middleware.js";
import {
  generalRateLimiter,
  authWebhookRateLimiter,
  uploadIntentRateLimiter,
} from "./common/middleware/rate-limit.middleware.js";
import { docsRoutes } from "./docs/swagger.routes.js";

export function createApp(): Express {
  const app = express();

  // Enable trust proxy so that reverse proxies (e.g. Next.js rewrite proxy, Cloudflare, load balancers)
  // properly forward client IP via X-Forwarded-For header to express-rate-limit and logger
  app.set("trust proxy", 1);

  // Security & HTTP Headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      xFrameOptions: { action: "deny" },
      xContentTypeOptions: true,
    })
  );

  // CORS configuration
  app.use(
    cors({
      origin: ["http://localhost:3000", "http://127.0.0.1:3000", env.CLIENT_URL],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "svix-id", "svix-timestamp", "svix-signature"],
    })
  );

  // Cookie parser for Staff JWT tokens
  app.use(cookieParser());

  // CSRF / Origin protection for cookie-authenticated staff mutations
  app.use((req: Request, res: Response, next) => {
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const hasStaffCookie = !!(
      req.cookies?.civictrack_admin_token ||
       req.cookies?.civictrack_admin_refresh ||
       req.cookies?.civictrack_officer_token ||
       req.cookies?.civictrack_officer_refresh
    );
    const isWebhook = req.path.startsWith("/api/v1/identity/clerk-webhook") || req.path.startsWith("/api/v1/webhooks");

    if (isMutation && hasStaffCookie && !isWebhook) {
      const origin = req.headers.origin;
      const referer = req.headers.referer;

      let requestOrigin = origin;
      if (!requestOrigin && referer) {
        try {
          const parsed = new URL(referer);
          requestOrigin = parsed.origin;
        } catch {
          // invalid referer
        }
      }

      const allowed = new Set([
        env.CLIENT_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4000",
        "http://127.0.0.1:4000",
      ]);

      // If host matches origin
      if (req.headers.host && requestOrigin) {
        try {
          const originHost = new URL(requestOrigin).host;
          if (originHost === req.headers.host) {
            allowed.add(requestOrigin);
          }
        } catch {
          // ignore
        }
      }

      if (!requestOrigin || !allowed.has(requestOrigin)) {
        res.status(403).json({
          success: false,
          error: {
            code: "CSRF_DETECTED",
            message: "Cross-origin state-changing requests are forbidden for cookie-authenticated sessions.",
          },
          requestId: req.id || "csrf-blocked",
        });
        return;
      }
    }

    next();
  });

  // Request parsing with rawBody capture for webhook signature verification
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: Request, _res: Response, buf: Buffer) => {
        req.rawBody = buf.toString("utf8");
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // NoSQL query operator injection sanitization
  app.use(sanitizeInputMiddleware);

  // Global Rate Limiting
  app.use(generalRateLimiter);

  // Correlation ID tracking
  app.use(requestIdMiddleware);

  // Health / Liveness Check
  const healthHandler = (_req: Request, res: Response): void => {
    const response: ApiResponse<{
      status: string;
      uptime: number;
      timestamp: string;
      version: string;
    }> = {
      success: true,
      data: {
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    };
    res.status(200).json(response);
  };

  app.get("/health", healthHandler);
  app.get("/api/v1/health", healthHandler);

  // Readiness Check (validates MongoDB connection)
  const readyHandler = (_req: Request, res: Response): void => {
    const dbHealth = getDatabaseHealth();
    const isReady = dbHealth.isConnected;
    const statusCode = isReady ? 200 : 503;

    const response: ApiResponse<{
      status: string;
      ready: boolean;
      checks: {
        server: string;
        database: string;
      };
    }> = {
      success: true,
      data: {
        status: isReady ? "ready" : "degraded",
        ready: isReady,
        checks: {
          server: "ok",
          database: dbHealth.state,
        },
      },
      meta: {
        databaseHost: dbHealth.host ?? "none",
        databaseName: dbHealth.name ?? "none",
      },
    };
    res.status(statusCode).json(response);
  };

  app.get("/ready", readyHandler);
  app.get("/api/v1/ready", readyHandler);

  // Clerk is optional for staff-only deployments; health probes do not depend on it.
  if (env.CLERK_PUBLISHABLE_KEY) {
    app.use(clerkMiddleware());
  }

  // API Documentation (Swagger UI & Raw OpenAPI Specification)
  app.use("/docs", docsRoutes);
  app.use("/api/v1/docs", docsRoutes);

  // Mount Domain Modules with Layered Rate Limiting
  app.use("/api/v1/admin/auth", authWebhookRateLimiter, adminAuthRoutes);
  app.use("/api/v1/officer/auth", authWebhookRateLimiter, officerAuthRoutes);
  app.use("/api/v1/staff/invitations", authWebhookRateLimiter, staffInvitationRoutes);
  app.use("/api/v1/admin/invitations", authWebhookRateLimiter, adminInvitationRoutes);
  app.use("/api/v1/webhooks", authWebhookRateLimiter, identityRoutes);
  app.use("/webhooks", authWebhookRateLimiter, identityRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/users", userRoutes);
  app.use("/api/v1/departments", departmentRoutes);
  app.use("/api/v1/complaints", complaintRoutes);
  app.use("/api/v1/storage", uploadIntentRateLimiter, storageRoutes);
  app.use("/api/v1/maps", mapRoutes);
  app.use("/api/v1/notifications", notificationRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/duplicates", duplicateRoutes);
  app.use("/api/v1/sla", slaRoutes);

  // 404 Handler
  app.use(notFoundMiddleware);

  // Centralized Error Handler
  app.use(errorMiddleware);

  return app;
}

export const app = createApp();
