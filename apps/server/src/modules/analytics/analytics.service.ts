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

export class AnalyticsService {
  /**
   * Get server-side aggregated municipal operational analytics
   */
  public static async getSummary(filter: AnalyticsFilterDto): Promise<IAnalyticsSummary> {
    if (ComplaintModel.db.readyState !== 1) {
      return this.getEmptySummary();
    }

    const matchQuery: Record<string, unknown> = {};

    if (filter.startDate || filter.endDate) {
      matchQuery.createdAt = {};
      if (filter.startDate) (matchQuery.createdAt as Record<string, unknown>).$gte = filter.startDate;
      if (filter.endDate) (matchQuery.createdAt as Record<string, unknown>).$lte = filter.endDate;
    }

    if (filter.departmentId && Types.ObjectId.isValid(filter.departmentId)) {
      matchQuery.departmentId = new Types.ObjectId(filter.departmentId);
    }

    const now = new Date();

    const [
      overallStats,
      categoryStats,
      departmentStats,
      statusStats,
      priorityStats,
      dailyTrend,
      departments,
    ] = await Promise.all([
      // 1. Overall Stats
      ComplaintModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalComplaints: { $sum: 1 },
            resolvedComplaints: {
              $sum: {
                $cond: [
                  { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
            pendingComplaints: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      "$status",
                      [ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW, ComplaintStatus.VERIFIED],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            inProgressComplaints: {
              $sum: {
                $cond: [
                  { $in: ["$status", [ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS]] },
                  1,
                  0,
                ],
              },
            },
            overdueCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $not: {
                          $in: [
                            "$status",
                            [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED],
                          ],
                        },
                      },
                      { $ne: ["$dueAt", null] },
                      { $lt: ["$dueAt", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            slaMetCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                      { $ne: ["$dueAt", null] },
                      { $ne: ["$resolvedAt", null] },
                      { $lte: ["$resolvedAt", "$dueAt"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            slaTotalCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                      { $ne: ["$dueAt", null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalResolutionMillis: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                      { $ne: ["$resolvedAt", null] },
                    ],
                  },
                  { $subtract: ["$resolvedAt", "$createdAt"] },
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 2. Category Breakdown
      ComplaintModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            resolvedCount: {
              $sum: {
                $cond: [
                  { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 3. Department Breakdown
      ComplaintModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$departmentId",
            total: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [
                  { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      {
                        $not: {
                          $in: [
                            "$status",
                            [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED, ComplaintStatus.REJECTED],
                          ],
                        },
                      },
                      { $ne: ["$dueAt", null] },
                      { $lt: ["$dueAt", now] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      // 4. Status Breakdown
      ComplaintModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // 5. Priority Breakdown
      ComplaintModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: "$priority",
            count: { $sum: 1 },
          },
        },
      ]),

      // 6. Daily Trend (last 14 days)
      ComplaintModel.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            submitted: { $sum: 1 },
            resolved: {
              $sum: {
                $cond: [
                  { $in: ["$status", [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 7. Departments list for names
      DepartmentModel.find().select("_id name").lean(),
    ]);

    const stats = overallStats[0] || {
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

    const departmentBreakdown = departmentStats.map((item) => ({
      departmentId: item._id ? item._id.toString() : "unassigned",
      departmentName: item._id ? deptMap.get(item._id.toString()) || "Department" : "Unassigned",
      total: item.total,
      resolved: item.resolved,
      overdue: item.overdue,
    }));

    const categoryBreakdown = categoryStats.map((item) => ({
      category: item._id as ComplaintCategory,
      count: item.count,
      resolvedCount: item.resolvedCount,
    }));

    const statusBreakdown = statusStats.map((item) => ({
      status: item._id as ComplaintStatus,
      count: item.count,
    }));

    const priorityBreakdown = priorityStats.map((item) => ({
      priority: item._id as ComplaintPriority,
      count: item.count,
    }));

    const dailyTrendFormatted = dailyTrend.map((item) => ({
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
