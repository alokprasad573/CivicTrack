import { Types } from "mongoose";
import { ComplaintModel } from "../complaints/complaint.model.js";
import { DepartmentModel } from "../departments/department.model.js";
import {
  IAnalyticsSummary,
  AnalyticsFilterDto,
  ComplaintStatus,
  ComplaintCategory,
  ComplaintPriority,
} from "@civictrack/contracts";
import { ValidationError, ServiceUnavailableError } from "../../common/errors/app-error.js";

export class AnalyticsService {
  public static async getSummary(filter: AnalyticsFilterDto, adminDepartmentIds?: string[]): Promise<IAnalyticsSummary> {
    if (ComplaintModel.db.readyState !== 1) {
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableError("Database is currently unavailable for analytics reporting");
      }
      return this.getEmptySummary();
    }

    if (adminDepartmentIds !== undefined && adminDepartmentIds.length === 0) {
      return this.getEmptySummary();
    }

    const matchQuery: Record<string, unknown> = {};

    if (filter.startDate || filter.endDate) {
      matchQuery.createdAt = {};
      if (filter.startDate) (matchQuery.createdAt as Record<string, unknown>).$gte = filter.startDate;
      if (filter.endDate) (matchQuery.createdAt as Record<string, unknown>).$lte = filter.endDate;
    }

    if (filter.departmentId) {
      if (!Types.ObjectId.isValid(filter.departmentId)) {
        throw new ValidationError("Invalid departmentId format");
      }
      matchQuery.departmentId = new Types.ObjectId(filter.departmentId);
    } else if (adminDepartmentIds && adminDepartmentIds.length > 0) {
      matchQuery.departmentId = { $in: adminDepartmentIds.map((id) => new Types.ObjectId(id)) };
    }

    const now = new Date();
    const trendStart = filter.startDate ? filter.startDate : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const [facetResult, departments] = await Promise.all([
      ComplaintModel.aggregate([
        { $match: matchQuery },
        {
          $facet: {
            overall: [
              {
                $group: {
                  _id: null,
                  totalComplaints: { $sum: 1 },
                  resolvedComplaints: { $sum: { $cond: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, 1, 0] } },
                  pendingComplaints: { $sum: { $cond: [{ $in: ["$status", [ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW, ComplaintStatus.VERIFIED]] }, 1, 0] } },
                  inProgressComplaints: { $sum: { $cond: [{ $in: ["$status", [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS]] }, 1, 0] } },
                  overdueCount: { $sum: { $cond: [{ $and: [{ $not: { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED]] } }, { $ne: ["$dueAt", null] }, { $lt: ["$dueAt", now] }] }, 1, 0] } },
                  slaMetCount: { $sum: { $cond: [{ $and: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, { $ne: ["$dueAt", null] }, { $ne: ["$resolvedAt", null] }, { $lte: ["$resolvedAt", "$dueAt"] }] }, 1, 0] } },
                  slaTotalCount: { $sum: { $cond: [{ $and: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, { $ne: ["$dueAt", null] }] }, 1, 0] } },
                  totalResolutionMillis: { $sum: { $cond: [{ $and: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, { $ne: ["$resolvedAt", null] }] }, { $subtract: ["$resolvedAt", "$createdAt"] }, 0] } },
                },
              },
            ],
            category: [
              { $group: { _id: "$category", count: { $sum: 1 }, resolvedCount: { $sum: { $cond: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, 1, 0] } } } },
            ],
            department: [
              { $group: { _id: "$departmentId", total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, 1, 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $not: { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED]] } }, { $ne: ["$dueAt", null] }, { $lt: ["$dueAt", now] }] }, 1, 0] } } } },
            ],
            status: [
              { $group: { _id: "$status", count: { $sum: 1 } } },
            ],
            priority: [
              { $group: { _id: "$priority", count: { $sum: 1 } } },
            ],
            trend: [
              { $match: { createdAt: { $gte: trendStart } } },
              { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, submitted: { $sum: 1 }, resolved: { $sum: { $cond: [{ $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] }, 1, 0] } } } },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ]),
      DepartmentModel.find(
        adminDepartmentIds
          ? { _id: { $in: adminDepartmentIds.map((id) => new Types.ObjectId(id)) } }
          : {}
      )
        .select("_id name")
        .lean(),
    ]);

    const facet = facetResult[0] || {};
    const overallArr = facet.overall || [];
    const stats = overallArr[0] || {
      totalComplaints: 0,
      resolvedComplaints: 0,
      pendingComplaints: 0,
      inProgressComplaints: 0,
      overdueCount: 0,
      slaMetCount: 0,
      slaTotalCount: 0,
      totalResolutionMillis: 0,
    };

    const total = stats.totalComplaints || 0;
    const resolved = stats.resolvedComplaints || 0;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 1000) / 10 : 0;

    const avgResolutionHours =
      resolved > 0 && stats.totalResolutionMillis > 0
        ? Math.round((stats.totalResolutionMillis / (resolved * 3600 * 1000)) * 10) / 10
        : 0;

    const slaAdherenceRate =
      stats.slaTotalCount > 0
        ? Math.round((stats.slaMetCount / stats.slaTotalCount) * 1000) / 10
        : 100;

    const deptMap = new Map<string, string>();
    for (const d of departments) {
      deptMap.set(d._id.toString(), d.name);
    }

    const departmentBreakdown = (facet.department || []).map((item: any) => ({
      departmentId: item._id ? item._id.toString() : "unassigned",
      departmentName: item._id ? deptMap.get(item._id.toString()) || "Department" : "Unassigned",
      total: item.total,
      resolved: item.resolved,
      overdue: item.overdue,
    }));

    const categoryBreakdown = (facet.category || []).map((item: any) => ({
      category: item._id as ComplaintCategory,
      count: item.count,
      resolvedCount: item.resolvedCount,
    }));

    const statusBreakdown = (facet.status || []).map((item: any) => ({
      status: item._id as ComplaintStatus,
      count: item.count,
    }));

    const priorityBreakdown = (facet.priority || []).map((item: any) => ({
      priority: item._id as ComplaintPriority,
      count: item.count,
    }));

    const dailyTrendFormatted = (facet.trend || []).map((item: any) => ({
      date: item._id as string,
      submitted: item.submitted,
      resolved: item.resolved,
    }));

    return {
      totalComplaints: total,
      resolvedComplaints: resolved,
      resolutionRate,
      pendingComplaints: stats.pendingComplaints || 0,
      inProgressComplaints: stats.inProgressComplaints || 0,
      overdueCount: stats.overdueCount || 0,
      slaAdherenceRate,
      averageResolutionHours: avgResolutionHours,
      categoryBreakdown,
      departmentBreakdown,
      statusBreakdown,
      priorityBreakdown,
      dailyTrend: dailyTrendFormatted,
    };
  }

  private static getEmptySummary(): IAnalyticsSummary {
    return {
      totalComplaints: 0,
      resolvedComplaints: 0,
      resolutionRate: 0,
      pendingComplaints: 0,
      inProgressComplaints: 0,
      overdueCount: 0,
      slaAdherenceRate: 100,
      averageResolutionHours: 0,
      categoryBreakdown: [],
      departmentBreakdown: [],
      statusBreakdown: [],
      priorityBreakdown: [],
      dailyTrend: [],
    };
  }
}