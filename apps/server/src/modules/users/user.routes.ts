import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticateUser } from "../identity/clerk.middleware.js";
import { requireRole } from "../identity/rbac.middleware.js";
import { UserService } from "./user.service.js";
import { UserRole, ApiResponse, PaginatedResponse, PaginationQuerySchema } from "@civictrack/contracts";
import { IUserDocument } from "./user.model.js";
import { ForbiddenError, ValidationError } from "../../common/errors/app-error.js";
import { Types } from "mongoose";
import { env } from "../../config/env.js";

const router = Router();

/**
 * GET /api/v1/users/me
 * Returns the currently authenticated user's trusted CivicTrack profile
 */
router.get("/me", authenticateUser, (req: Request, res: Response): void => {
  const response: ApiResponse<typeof req.user> = {
    success: true,
    data: req.user,
  };
  res.status(200).json(response);
});

/**
 * POST /api/v1/users/me/switch-role
 * Development-only switch active persona role. Strictly disabled in production.
 */
router.post(
  "/me/switch-role",
  (_req: Request, _res: Response, next: NextFunction) => {
    if (env.NODE_ENV === "production" || env.ENABLE_DEV_ROLE_SWITCH !== "true") {
      return next(new ForbiddenError("Self-service role switching is disabled in production."));
    }
    next();
  },
  authenticateUser,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (env.NODE_ENV === "production" || env.ENABLE_DEV_ROLE_SWITCH !== "true") {
        throw new ForbiddenError("Self-service role switching is disabled in production.");
      }

      const dto = z.object({
        role: z.nativeEnum(UserRole),
        departmentId: z.string().optional(),
      }).parse(req.body);

      let departmentId: string | undefined = dto.departmentId || req.user!.departmentId;
      if (dto.role === UserRole.OFFICER && !departmentId) {
        const { DepartmentModel } = await import("../departments/department.model.js");
        const defaultDept = await DepartmentModel.findOne({ isActive: true });
        if (defaultDept) {
          departmentId = defaultDept._id.toString();
        }
      }

      const updatedUser = await UserService.updateRoleAndDepartment({
        userId: req.user!.id,
        role: dto.role,
        departmentId,
      });

      const response: ApiResponse<IUserDocument> = {
        success: true,
        data: updatedUser,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/users
 * Administrative and departmental staff directory listing with pagination and search.
 * Scoped to officer's department when invoked by an officer.
 */
router.get(
  "/",
  authenticateUser,
  requireRole(UserRole.ADMIN, UserRole.OFFICER),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = PaginationQuerySchema.parse(req.query);
      const roleFilter = req.query.role as UserRole | undefined;
      const search = req.query.search as string | undefined;

      // Scoping: Officers are strictly constrained to their own department
      let departmentId: string | undefined = req.query.departmentId as string | undefined;
      if (departmentId && !Types.ObjectId.isValid(departmentId)) {
        throw new ValidationError("Invalid department ID format");
      }
      if (req.user!.role === UserRole.OFFICER) {
        if (departmentId && departmentId !== req.user!.departmentId) {
          throw new ForbiddenError("Officers cannot view users outside their assigned department");
        }
        departmentId = req.user!.departmentId;
      }

      const result = await UserService.listUsers({
        page: query.page,
        limit: query.limit,
        role: roleFilter,
        search,
        departmentId,
      });

      const response: PaginatedResponse<IUserDocument> = {
        success: true,
        data: result.users,
        meta: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          hasNextPage: result.page < result.totalPages,
          hasPrevPage: result.page > 1,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

const UpdateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  departmentId: z.string().optional(),
});

/**
 * PATCH /api/v1/users/:id/role
 * Admin endpoint to update user role and assign department
 */
router.patch(
  "/:id/role",
  authenticateUser,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = UpdateRoleSchema.parse(req.body);
      const updatedUser = await UserService.updateRoleAndDepartment({
        userId: req.params.id as string,
        role: dto.role,
        departmentId: dto.departmentId as string | undefined,
      });

      const response: ApiResponse<IUserDocument> = {
        success: true,
        data: updatedUser,
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export const userRoutes = router;
