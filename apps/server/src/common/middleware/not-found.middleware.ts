import { Request, Response, NextFunction } from "express";
import { NotFoundError } from "../errors/app-error.js";

export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
}
