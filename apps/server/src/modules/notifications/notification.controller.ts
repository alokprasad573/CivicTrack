import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service.js";
import {
  NotificationQuerySchema,
  ApiResponse,
  NotificationListResponse,
  INotification,
} from "@civictrack/contracts";
import { UnauthorizedError, ValidationError } from "../../common/errors/app-error.js";

export class NotificationController {
  /**
   * GET /api/v1/notifications
   */
  public static async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const query = NotificationQuerySchema.parse(req.query);
      const result = await NotificationService.listUserNotifications(req.user.id, query);

      const response: ApiResponse<NotificationListResponse> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  public static async markRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const notificationId = req.params.id as string;
      if (!notificationId) {
        throw new ValidationError("Notification ID parameter is required");
      }

      const notification = await NotificationService.markAsRead(
        req.user.id,
        notificationId
      );

      const response: ApiResponse<INotification> = {
        success: true,
        data: notification,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/read-all
   */
  public static async markAllRead(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError("Authentication required");
      }

      const result = await NotificationService.markAllAsRead(req.user.id);

      const response: ApiResponse<{ modifiedCount: number }> = {
        success: true,
        data: result,
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}
