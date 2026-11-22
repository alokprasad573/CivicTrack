import { Request, Response, NextFunction } from "express";
import { UserRole } from "@civictrack/contracts";
import { UnauthorizedError, ForbiddenError } from "../../common/errors/app-error.js";

/**
 * RBAC Middleware: Enforces that the authenticated user possesses one of the required application roles.
 * Roles are resolved strictly from the trusted local MongoDB record, never from frontend headers or editable metadata.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Requires one of roles: [${allowedRoles.join(", ")}], your role: ${req.user.role}`
        )
      );
    }

    next();
  };
}

/**
 * Enforces that an OFFICER can only access resources belonging to their assigned department.
 * ADMINS bypass this restriction to supervise all departments.
 */
export function requireDepartmentAccess(departmentIdGetter: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }

    // Admin has access to all departments
    if (req.user.role === UserRole.ADMIN) {
      return next();
    }

    if (req.user.role === UserRole.OFFICER) {
      const targetDepartmentId = departmentIdGetter(req);
      if (!req.user.departmentId || req.user.departmentId !== targetDepartmentId) {
        return next(
          new ForbiddenError("Officers can only manage resources within their assigned department.")
        );
      }
      return next();
    }

    return next(new ForbiddenError("Access denied"));
  };
}
