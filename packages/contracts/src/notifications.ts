import { z } from "zod";
import { NotificationType } from "./enums";

export interface INotification {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  resourceType: "COMPLAINT" | "ASSIGNMENT" | "SYSTEM";
  resourceId: string;
  readAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const NotificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((val) => val === "true" || val === "1")
    .or(z.boolean().optional()),
});

export type NotificationQueryDto = z.infer<typeof NotificationQuerySchema>;

export interface NotificationListResponse {
  notifications: INotification[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}
