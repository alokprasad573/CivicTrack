import { z } from "zod";
import { ComplaintCategory, ComplaintPriority, ComplaintStatus } from "./enums";

export interface IAnalyticsSummary {
  totalComplaints: number;
  resolvedComplaints: number;
  resolutionRate: number; // e.g. 84.5%
  pendingComplaints: number;
  inProgressComplaints: number;
  overdueCount: number;
  slaAdherenceRate: number; // e.g. 91.2%
  averageResolutionHours: number;
  categoryBreakdown: {
    category: ComplaintCategory;
    count: number;
    resolvedCount: number;
  }[];
  departmentBreakdown: {
    departmentId: string;
    departmentName: string;
    total: number;
    resolved: number;
    overdue: number;
  }[];
  statusBreakdown: {
    status: ComplaintStatus;
    count: number;
  }[];
  priorityBreakdown: {
    priority: ComplaintPriority;
    count: number;
  }[];
  dailyTrend: {
    date: string; // "YYYY-MM-DD"
    submitted: number;
    resolved: number;
  }[];
}

export const AnalyticsFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  departmentId: z.string().optional(),
});

export type AnalyticsFilterDto = z.infer<typeof AnalyticsFilterSchema>;
