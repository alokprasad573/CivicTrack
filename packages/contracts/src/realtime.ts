import { z } from "zod";
import { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "./enums";
import { GeoJsonPointSchema } from "./complaints";

/**
 * Payload emitted when a new complaint is submitted
 */
export const ComplaintCreatedPayloadSchema = z.object({
  complaintId: z.string().min(1),
  referenceNumber: z.string().min(1),
  title: z.string(),
  category: z.nativeEnum(ComplaintCategory),
  status: z.nativeEnum(ComplaintStatus),
  priority: z.nativeEnum(ComplaintPriority),
  citizenId: z.string().min(1),
  address: z.string(),
  location: GeoJsonPointSchema,
  departmentId: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

export type ComplaintCreatedPayload = z.infer<typeof ComplaintCreatedPayloadSchema>;

/**
 * Payload emitted when a complaint status transitions
 */
export const ComplaintStatusUpdatedPayloadSchema = z.object({
  complaintId: z.string().min(1),
  referenceNumber: z.string().min(1),
  status: z.nativeEnum(ComplaintStatus),
  citizenId: z.string().min(1),
  departmentId: z.string().optional(),
  assignedOfficerId: z.string().optional(),
  title: z.string().optional(),
  category: z.nativeEnum(ComplaintCategory).optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  dueAt: z.union([z.string(), z.date()]).optional(),
  resolvedAt: z.union([z.string(), z.date()]).optional(),
  closedAt: z.union([z.string(), z.date()]).optional(),
  remarks: z.string().optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export type ComplaintStatusUpdatedPayload = z.infer<typeof ComplaintStatusUpdatedPayloadSchema>;

/**
 * Payload emitted when a complaint is assigned to department or officer
 */
export const ComplaintAssignedPayloadSchema = z.object({
  complaintId: z.string().min(1),
  referenceNumber: z.string().min(1),
  departmentId: z.string().min(1),
  assignedOfficerId: z.string().optional(),
  citizenId: z.string().optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  dueAt: z.union([z.string(), z.date()]).optional(),
  remarks: z.string().optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export type ComplaintAssignedPayload = z.infer<typeof ComplaintAssignedPayloadSchema>;

/**
 * Payload emitted when live dashboard counts change
 */
export const DashboardStatsUpdatedPayloadSchema = z.object({
  scope: z.enum(["ADMIN", "OFFICER", "CITIZEN"]),
  departmentId: z.string().optional(),
  userId: z.string().optional(),
  total: z.number().int().optional(),
  submitted: z.number().int().optional(),
  underReview: z.number().int().optional(),
  assigned: z.number().int().optional(),
  inProgress: z.number().int().optional(),
  resolved: z.number().int().optional(),
  closed: z.number().int().optional(),
  timestamp: z.union([z.string(), z.date()]),
});

export type DashboardStatsUpdatedPayload = z.infer<typeof DashboardStatsUpdatedPayloadSchema>;
