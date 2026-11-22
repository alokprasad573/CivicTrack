import { z } from "zod";
import { ComplaintCategory, ComplaintStatus } from "./enums";

export type DuplicateSignalReason =
  | "SAME_CATEGORY"
  | "WITHIN_DISTANCE"
  | "DESCRIPTION_SIMILARITY"
  | "ADDRESS_MATCH";

export interface IDuplicateCandidate {
  complaintId: string;
  referenceNumber: string;
  title: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  similarityScore: number; // 0 to 100
  distanceMeters: number;
  reasons: DuplicateSignalReason[];
  address: string;
  createdAt: string;
}

export interface DuplicateCheckResponse {
  targetComplaintId: string;
  candidates: IDuplicateCandidate[];
  totalCandidates: number;
}

export const LinkDuplicateSchema = z.object({
  duplicateOfId: z.string().min(1, "Primary complaint ID is required"),
  remarks: z.string().trim().max(500).optional(),
});

export type LinkDuplicateDto = z.infer<typeof LinkDuplicateSchema>;
