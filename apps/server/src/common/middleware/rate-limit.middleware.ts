import rateLimit, { RateLimitRequestHandler } from "express-rate-limit";
import { Request, Response } from "express";
import { ApiErrorResponse } from "@civictrack/contracts";

/**
 * Standard CivicTrack error handler for Rate Limiting violations (HTTP 429)
 */
function rateLimitErrorHandler(req: Request, res: Response): void {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests from this client IP. Please try again after a few minutes.",
    },
    requestId: req.id || "rate-limited",
  };
  res.status(429).json(response);
}

const isTestEnv = process.env.NODE_ENV === "test";

/**
 * General API Rate Limiter
 * 300 requests per 15-minute sliding window per IP
 */
export const generalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 5000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  handler: rateLimitErrorHandler,
  skip: () => isTestEnv && process.env.ENABLE_TEST_RATE_LIMIT !== "true",
});

/**
 * Strict Rate Limiter for Authentication & Webhook Endpoints
 * 60 requests per 15-minute sliding window per IP
 */
export const authWebhookRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 5000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  handler: rateLimitErrorHandler,
  skip: () => isTestEnv && process.env.ENABLE_TEST_RATE_LIMIT !== "true",
});

/**
 * Upload Intent Rate Limiter
 * 50 requests per 15-minute sliding window per IP
 */
export const uploadIntentRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTestEnv ? 5000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  handler: rateLimitErrorHandler,
  skip: () => isTestEnv && process.env.ENABLE_TEST_RATE_LIMIT !== "true",
});

/**
 * Factory for creating custom-bounded limiters (used for unit & security tests)
 */
export function createTestRateLimiter(max: number, windowMs: number = 60000): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, default: true },
    handler: rateLimitErrorHandler,
  });
}
