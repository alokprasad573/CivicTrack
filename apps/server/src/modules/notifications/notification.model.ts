import { Schema, model, Document, Types } from "mongoose";
import { NotificationType, INotification } from "@civictrack/contracts";

export interface INotificationDocument extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: "COMPLAINT" | "ASSIGNMENT" | "SYSTEM";
  resourceId: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    resourceType: {
      type: String,
      enum: ["COMPLAINT", "ASSIGNMENT", "SYSTEM"],
      default: "COMPLAINT",
    },
    resourceId: {
      type: String,
      required: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound index for paginated feeds and unread count queries
NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

export const NotificationModel = model<INotificationDocument>(
  "Notification",
  NotificationSchema
);

export function formatNotification(doc: INotificationDocument): INotification {
  return {
    _id: doc._id.toString(),
    recipientId: doc.recipientId.toString(),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : undefined,
  };
}
