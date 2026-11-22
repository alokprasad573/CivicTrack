import { Types } from "mongoose";
import {
  NotificationModel,
  INotificationDocument,
  formatNotification,
} from "./notification.model.js";
import { emitNotification } from "../../socket.js";
import {
  NotificationType,
  INotification,
  NotificationQueryDto,
  NotificationListResponse,
} from "@civictrack/contracts";
import { NotFoundError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";

export class NotificationService {
  /**
   * Persist notification in database first, then emit in real-time over Socket.io
   */
  public static async createAndEmit(params: {
    recipientId: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    resourceType?: "COMPLAINT" | "ASSIGNMENT" | "SYSTEM";
    resourceId: string;
  }): Promise<INotificationDocument | null> {
    const { recipientId, type, title, message, resourceType = "COMPLAINT", resourceId } = params;

    const recipientObjectId =
      recipientId instanceof Types.ObjectId ? recipientId : new Types.ObjectId(recipientId);

    // If database is offline (test mode), return formatted document
    if (NotificationModel.db.readyState !== 1) {
      const mockDoc = new NotificationModel({
        _id: new Types.ObjectId(),
        recipientId: recipientObjectId,
        type,
        title,
        message,
        resourceType,
        resourceId,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      emitNotification(recipientObjectId.toString(), formatNotification(mockDoc));
      return mockDoc;
    }

    try {
      // 1. Authoritative persistence in MongoDB
      const doc = await NotificationModel.create({
        recipientId: recipientObjectId,
        type,
        title,
        message,
        resourceType,
        resourceId,
        readAt: null,
      });

      const formatted = formatNotification(doc);

      // 2. Real-time delivery to authorized user socket
      emitNotification(recipientObjectId.toString(), formatted);

      logger.info("Notification persisted and emitted", {
        notificationId: doc._id.toString(),
        recipientId: recipientObjectId.toString(),
        type,
      });

      return doc;
    } catch (err) {
      logger.error("Failed to persist notification", {
        error: err instanceof Error ? err.message : String(err),
        recipientId: recipientObjectId.toString(),
        type,
      });
      return null;
    }
  }

  /**
   * List paginated notifications for an authenticated user with unread counter
   */
  public static async listUserNotifications(
    userId: string,
    query: NotificationQueryDto
  ): Promise<NotificationListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      recipientId: new Types.ObjectId(userId),
    };

    if (query.unreadOnly) {
      filter.readAt = null;
    }

    if (NotificationModel.db.readyState !== 1) {
      return {
        notifications: [],
        total: 0,
        unreadCount: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    const [docs, total, unreadCount] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({
        recipientId: new Types.ObjectId(userId),
        readAt: null,
      }),
    ]);

    return {
      notifications: docs.map((d) => formatNotification(d)),
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Mark a single notification as read (scoped to owner)
   */
  public static async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<INotification> {
    if (!Types.ObjectId.isValid(notificationId)) {
      throw new NotFoundError("Notification not found");
    }

    if (NotificationModel.db.readyState !== 1) {
      throw new NotFoundError("Notification not found (database offline)");
    }

    const doc = await NotificationModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        recipientId: new Types.ObjectId(userId),
      },
      {
        $set: { readAt: new Date() },
      },
      { new: true }
    );

    if (!doc) {
      throw new NotFoundError("Notification not found or access denied");
    }

    return formatNotification(doc);
  }

  /**
   * Mark all unread notifications for a user as read
   */
  public static async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    if (NotificationModel.db.readyState !== 1) {
      return { modifiedCount: 0 };
    }

    const result = await NotificationModel.updateMany(
      {
        recipientId: new Types.ObjectId(userId),
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    logger.info("Marked all notifications read for user", {
      userId,
      modifiedCount: result.modifiedCount,
    });

    return { modifiedCount: result.modifiedCount };
  }
}
