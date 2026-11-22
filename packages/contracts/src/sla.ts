import { ComplaintCategory, ComplaintPriority } from "./enums";

export interface ISlaPolicy {
  priority: ComplaintPriority;
  category?: ComplaintCategory;
  targetResolutionHours: number;
}

export interface ISlaEscalationLog {
  complaintId: string;
  referenceNumber: string;
  dueAt: string;
  escalatedAt: string;
  delayHours: number;
  isResolved: boolean;
}

export interface SlaScanResult {
  scannedCount: number;
  escalatedCount: number;
  overdueCount: number;
  timestamp: string;
}
