import { Types } from "mongoose";
import { ComplaintModel, IComplaintDocument } from "../complaints/complaint.model.js";
import { SlaEscalationModel } from "./sla-escalation.model.js";
import { calculateDueAt } from "./sla.config.js";
import { NotificationService } from "../notifications/notification.service.js";
import { UserModel } from "../users/user.model.js";
import {
  ComplaintPriority,
  ComplaintCategory,
  ComplaintStatus,
  UserRole,
  NotificationType,
  SlaScanResult,
} from "@civictrack/contracts";
import { logger } from "../../common/utils/logger.js";
import { IAuthUser } from "../identity/identity.types.js";

export class SlaService {
  /**
   * Calculate due date based on SLA policies
   */
  public static calculateDueDate(
    priority: ComplaintPriority,
    category?: ComplaintCategory,
    fromDate: Date = new Date()
  ): Date {
    return calculateDueAt(priority, category, fromDate);
  }

  /**
   * Idempotently scan and escalate overdue complaints
   */
  public static async scanAndEscalateOverdue(): Promise<SlaScanResult> {
    const now = new Date();

    if (ComplaintModel.db.readyState !== 1) {
      return {
        scannedCount: 0,
        escalatedCount: 0,
        overdueCount: 0,
        timestamp: now.toISOString(),
      };
    }

    // Active complaints past their due date
    const overdueComplaints = await ComplaintModel.find({
      status: {
        $nin: [
          ComplaintStatus.RESOLVED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ],
      },
      dueAt: { $lt: now, $ne: null },
    })
      .populate("departmentId", "name")
      .populate("assignedOfficerId", "name email")
      .limit(500)
      .lean();

    let escalatedCount = 0;

    // Get admin accounts for escalation broadcast
    const admins = await UserModel.find({ role: UserRole.ADMIN, isActive: true }).select("_id");

    for (const complaint of overdueComplaints) {
      if (!complaint.dueAt) continue;

      const delayHours = Math.max(
        1,
        Math.round((now.getTime() - complaint.dueAt.getTime()) / (1000 * 60 * 60))
      );

      // Check if already escalated for this specific dueAt (Idempotency check)
      const existingEscalation = await SlaEscalationModel.findOne({
        complaintId: complaint._id,
        dueAt: complaint.dueAt,
      });

      if (!existingEscalation) {
        // Create new escalation log (handling unique index race condition across instances)
        try {
          await SlaEscalationModel.create({
            complaintId: complaint._id,
            dueAt: complaint.dueAt,
            escalatedAt: now,
            delayHours,
            isResolved: false,
            notifiedAdminsCount: admins.length,
          });
        } catch (err: any) {
          if (err?.code === 11000) {
            // Concurrently escalated by another worker instance; proceed safely
            continue;
          }
          throw err;
        }

        escalatedCount++;

        // Notify admins regarding SLA breach (parallelized)
        await Promise.all(
          admins.map((admin) =>
            NotificationService.createAndEmit({
              recipientId: admin._id.toString(),
              type: NotificationType.SLA_BREACH,
              title: `SLA Breach: ${complaint.referenceNumber}`,
              message: `Complaint "${complaint.title}" is ${delayHours}h overdue. Priority: ${complaint.priority}. Immediate supervisor review required.`,
              resourceType: "COMPLAINT",
              resourceId: complaint._id.toString(),
            })
          )
        );

        // Also notify assigned officer if assigned
        if (complaint.assignedOfficerId) {
          const officerId =
            complaint.assignedOfficerId instanceof Types.ObjectId
              ? complaint.assignedOfficerId.toString()
              : (complaint.assignedOfficerId as unknown as { _id: Types.ObjectId })._id.toString();

          await NotificationService.createAndEmit({
            recipientId: officerId,
            type: NotificationType.SLA_BREACH,
            title: `SLA Overdue: ${complaint.referenceNumber}`,
            message: `Your assigned incident is ${delayHours}h overdue. Please resolve or update status.`,
            resourceType: "COMPLAINT",
            resourceId: complaint._id.toString(),
          });
        }

        logger.warn("SLA breach escalated", {
          complaintId: complaint._id.toString(),
          referenceNumber: complaint.referenceNumber,
          dueAt: complaint.dueAt.toISOString(),
          delayHours,
        });
      }
    }

    logger.info("SLA overdue scan completed", {
      totalOverdue: overdueComplaints.length,
      newlyEscalated: escalatedCount,
    });

    return {
      scannedCount: overdueComplaints.length,
      escalatedCount,
      overdueCount: overdueComplaints.length,
      timestamp: now.toISOString(),
    };
  }

  /**
   * Get list of overdue complaints scoped by role
   */
  public static async getOverdueComplaints(user: IAuthUser): Promise<IComplaintDocument[]> {
    if (ComplaintModel.db.readyState !== 1) {
      return [];
    }

    const query: Record<string, unknown> = {
      status: {
        $nin: [
          ComplaintStatus.RESOLVED,
          ComplaintStatus.CLOSED,
          ComplaintStatus.REJECTED,
        ],
      },
      dueAt: { $lt: new Date(), $ne: null },
    };

    if (user.role === UserRole.OFFICER) {
      if (user.departmentId) {
        query.departmentId = new Types.ObjectId(user.departmentId);
      } else {
        query.assignedOfficerId = new Types.ObjectId(user.id);
      }
    }

    return ComplaintModel.find(query)
      .sort({ dueAt: 1 })
      .populate("departmentId", "name code")
      .populate("assignedOfficerId", "name email");
  }
}
