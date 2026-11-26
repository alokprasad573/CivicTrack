import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header("X-Request-ID");
  const sanitized =
    incomingId && /^[A-Za-z0-9._-]{1,128}$/.test(incomingId.trim())
      ? incomingId.trim()
      : undefined;
  const requestId = sanitized || randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
