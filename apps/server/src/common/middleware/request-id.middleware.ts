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
  const requestId = incomingId && incomingId.trim().length > 0 ? incomingId : randomUUID();
  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}
