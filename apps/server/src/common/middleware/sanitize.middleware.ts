import { Request, Response, NextFunction } from "express";

/**
 * Recursively inspect and sanitize an object to strip keys containing '$' or '.'
 * which could be used for NoSQL operator injection in MongoDB queries.
 */
function sanitizeObject(target: unknown): unknown {
  if (target === null || typeof target !== "object") {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map((item) => sanitizeObject(item));
  }

  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(target as Record<string, unknown>)) {
    // Strip keys starting with '$' or containing '.'
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }
    cleanObj[key] = sanitizeObject(value);
  }

  return cleanObj;
}

export function sanitizeInputMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query) as Record<string, any>;
  }

  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params) as Record<string, any>;
  }

  next();
}
