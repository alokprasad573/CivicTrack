import { z } from "zod";
import { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "./enums";

/**
 * GeoJSON Point Schema
 * Coordinates MUST be [longitude, latitude]
 * Longitude: -180 to 180
 * Latitude: -90 to 90
 */
export const GeoJsonPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // longitude
    z.number().min(-90).max(90),   // latitude
  ]),
});

export type GeoJsonPoint = z.infer<typeof GeoJsonPointSchema>;

export const EvidenceItemSchema = z.object({
  objectKey: z.string().min(1),
  key: z.string().optional(),
  contentType: z.string().min(1),
  mimeType: z.string().optional(),
  size: z.number().int().positive(),
  url: z.string().optional(),
  originalName: z.string().optional(),
  uploadedAt: z.coerce.date().optional(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const CreateComplaintSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(150, "Title must not exceed 150 characters"),
  description: z.string().trim().min(20, "Description must be at least 20 characters").max(2000, "Description must not exceed 2000 characters"),
  category: z.nativeEnum(ComplaintCategory),
  location: GeoJsonPointSchema,
  address: z.string().trim().min(3, "Address is required").max(300),
  landmark: z.string().trim().max(150).optional(),
  evidence: z.array(EvidenceItemSchema).max(5).default([]),
});

export type CreateComplaintDto = z.infer<typeof CreateComplaintSchema>;

export const SubmitFeedbackSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1 star").max(5, "Rating cannot exceed 5 stars"),
  comment: z.string().trim().max(1000).optional(),
});

export type SubmitFeedbackDto = z.infer<typeof SubmitFeedbackSchema>;

export const ReviewComplaintSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
});

export type ReviewComplaintDto = z.infer<typeof ReviewComplaintSchema>;

export const VerifyComplaintSchema = z.object({
  priority: z.nativeEnum(ComplaintPriority).optional(),
  remarks: z.string().trim().max(1000).optional(),
});

export type VerifyComplaintDto = z.infer<typeof VerifyComplaintSchema>;

export const RejectComplaintSchema = z.object({
  reason: z.string().trim().min(5, "Rejection reason must be at least 5 characters").max(1000),
});

export type RejectComplaintDto = z.infer<typeof RejectComplaintSchema>;

export const AssignComplaintSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  assignedOfficerId: z.string().optional(),
  priority: z.nativeEnum(ComplaintPriority).optional(),
  dueAt: z.coerce.date().optional(),
  remarks: z.string().trim().max(1000).optional(),
});

export type AssignComplaintDto = z.infer<typeof AssignComplaintSchema>;

export const StartWorkSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
});

export type StartWorkDto = z.infer<typeof StartWorkSchema>;

export const ResolveComplaintSchema = z.object({
  remarks: z.string().trim().min(10, "Resolution remarks must be at least 10 characters").max(2000),
  evidence: z.array(EvidenceItemSchema).max(5).default([]),
});

export type ResolveComplaintDto = z.infer<typeof ResolveComplaintSchema>;

export const CloseComplaintSchema = z.object({
  remarks: z.string().trim().max(1000).optional(),
});

export type CloseComplaintDto = z.infer<typeof CloseComplaintSchema>;

export interface IComplaint {
  _id: string;
  referenceNumber: string;
  citizenId: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  location: GeoJsonPoint;
  address: string;
  landmark?: string;
  evidence: EvidenceItem[];
  departmentId?: string;
  assignedOfficerId?: string;
  dueAt?: string | Date;
  resolvedAt?: string | Date;
  closedAt?: string | Date;
  rejectionReason?: string;
  resolutionRemarks?: string;
  resolutionEvidence?: EvidenceItem[];
  feedbackRating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type ComplaintResponse = IComplaint;

/**
 * Explicit allowlist DTO for public nearby complaint map discovery.
 * Strictly excludes citizen PII, internal assignments, evidence keys, and signed URLs.
 */
export const PublicNearbyComplaintSchema = z.object({
  id: z.string(),
  referenceNumber: z.string(),
  title: z.string(),
  category: z.nativeEnum(ComplaintCategory),
  status: z.nativeEnum(ComplaintStatus),
  priority: z.nativeEnum(ComplaintPriority),
  location: GeoJsonPointSchema,
  address: z.string(),
  createdAt: z.union([z.string(), z.date()]),
});

export type PublicNearbyComplaint = z.infer<typeof PublicNearbyComplaintSchema>;
