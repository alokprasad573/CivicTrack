import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";
import { ApiErrorResponse } from "@civictrack/contracts";

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.id || "unknown";

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request payload",
        details,
      },
      requestId,
    };

    logger.warn("Validation error", { requestId, path: req.path, details });
    res.status(400).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    };

    logger.warn(`Operational error: ${err.message}`, {
      requestId,
      statusCode: err.statusCode,
      code: err.code,
      path: req.path,
    });

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle MongoDB Connection / Server Selection / Buffer Errors gracefully
  if (
    err.name === "MongoServerSelectionError" ||
    err.name === "MongooseServerSelectionError" ||
    err.name === "MongoNetworkError" ||
    err.name === "MongoTimeoutError" ||
    err.name === "MongooseError" ||
    err.message?.includes("buffering timed out") ||
    err.message?.includes("tlsv1 alert") ||
    err.message?.includes("IP that isn't whitelisted")
  ) {
    const isIpIssue =
      err.message?.includes("IP that isn't whitelisted") ||
      err.message?.includes("tlsv1 alert") ||
      err.message?.includes("buffering timed out");

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: isIpIssue
          ? "Database service is temporarily unreachable. Please ensure your current IP address is whitelisted in MongoDB Atlas Network Access."
          : "Database service is temporarily unavailable. Please retry in a few moments.",
        details:
          process.env.NODE_ENV === "development"
            ? [{ field: "database", message: err.message }]
            : undefined,
      },
      requestId,
    };

    logger.warn("Database connection/query error caught by error middleware", {
      requestId,
      name: err.name,
      message: err.message,
    });

    res.status(503).json(response);
    return;
  }

  // Unhandled / system errors
  logger.error("Unhandled error encountered", {
    requestId,
    path: req.path,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    },
    requestId,
  };

  res.status(500).json(response);
}
