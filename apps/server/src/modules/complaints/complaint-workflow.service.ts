import { Types } from "mongoose";
import { ComplaintModel, IComplaintDocument } from "./complaint.model.js";
import { ComplaintStatusHistoryModel } from "./complaint-history.model.js";
import { DepartmentService } from "../departments/department.service.js";
import { StorageService } from "../storage/storage.service.js";
import { S3Service } from "../storage/s3.service.js";
import { UserModel } from "../users/user.model.js";
import { ComplaintQueryService } from "./complaint-query.service.js";
import {
  ComplaintStatus,
  ReviewComplaintDto,
  VerifyComplaintDto,
  RejectComplaintDto,
  AssignComplaintDto,
  StartWorkDto,
  ResolveComplaintDto,
  CloseComplaintDto,
  UserRole,
  NotificationType,
  isValidStatusTransition,
} from "@civictrack/contracts";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { IAuthUser } from "../identity/identity.types.js";
import { NotificationService } from "../notifications/notification.service.js";
import { emitComplaintStatusUpdated, emitComplaintAssigned } from "../../socket.js";
import { calculateDueAt } from "../sla/sla.config.js";

export class ComplaintWorkflowService {
  /**
   * Admin moves complaint from SUBMITTED to UNDER_REVIEW
   */
  public static async review(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: ReviewComplaintDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only municipal administrators can initiate formal complaint review.");
    }

    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    if (!isValidStatusTransition(complaint.status, ComplaintStatus.UNDER_REVIEW)) {
      throw new ValidationError(
        `Cannot start review for complaint in '${complaint.status}' status. Must be '${ComplaintStatus.SUBMITTED}'.`
      );
    }

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      { $set: { status: ComplaintStatus.UNDER_REVIEW } },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.UNDER_REVIEW,
      actorId: new Types.ObjectId(user.id),
      remarks: dto.remarks || "Administrator began complaint review and triage.",
    });

    await NotificationService.createAndEmit({
      recipientId: complaint.citizenId.toString(),
      type: NotificationType.COMPLAINT_UNDER_REVIEW,
      title: "Complaint Under Review",
      message: `Your complaint (${complaint.referenceNumber}) is currently being reviewed by municipal administrators.`,
      resourceType: "COMPLAINT",
      resourceId: complaint._id.toString(),
    });

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      status: ComplaintStatus.UNDER_REVIEW,
      citizenId: complaint.citizenId.toString(),
      departmentId: complaint.departmentId?.toString(),
      assignedOfficerId: complaint.assignedOfficerId?.toString(),
    });

    logger.info("Complaint transitioned to UNDER_REVIEW", {
      id: complaint._id.toString(),
      adminId: user.id,
    });

    return updated;
  }

  /**
   * Admin approves complaint: UNDER_REVIEW -> VERIFIED
   */
  public static async verify(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: VerifyComplaintDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only municipal administrators can verify complaints.");
    }

    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    if (!isValidStatusTransition(complaint.status, ComplaintStatus.VERIFIED)) {
      throw new ValidationError(
        `Cannot verify complaint in '${complaint.status}' status. Must be '${ComplaintStatus.UNDER_REVIEW}'.`
      );
    }

    const updateSet: Record<string, unknown> = { status: ComplaintStatus.VERIFIED };
    const priority = dto.priority || complaint.priority;
    if (dto.priority) {
      updateSet.priority = dto.priority;
    }
    if (!complaint.dueAt) {
      updateSet.dueAt = calculateDueAt(priority, complaint.category);
    }

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      { $set: updateSet },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.VERIFIED,
      actorId: new Types.ObjectId(user.id),
      remarks: dto.remarks || `Administrator verified complaint legitimacy${dto.priority ? ` and set priority to ${dto.priority}` : ""}.`,
    });

    await NotificationService.createAndEmit({
      recipientId: complaint.citizenId.toString(),
      type: NotificationType.COMPLAINT_VERIFIED,
      title: "Complaint Verified",
      message: `Your complaint (${complaint.referenceNumber}) has been verified and approved for department assignment.`,
      resourceType: "COMPLAINT",
      resourceId: complaint._id.toString(),
    });

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      status: ComplaintStatus.VERIFIED,
      citizenId: complaint.citizenId.toString(),
      departmentId: complaint.departmentId?.toString(),
      assignedOfficerId: complaint.assignedOfficerId?.toString(),
    });

    logger.info("Complaint verified by admin", {
      id: complaint._id.toString(),
      adminId: user.id,
      priority: dto.priority || complaint.priority,
    });

    return updated;
  }

  /**
   * Admin rejects complaint: UNDER_REVIEW -> REJECTED
   */
  public static async reject(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: RejectComplaintDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only municipal administrators can reject complaints.");
    }

    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    if (!isValidStatusTransition(complaint.status, ComplaintStatus.REJECTED)) {
      throw new ValidationError(
        `Cannot reject complaint in '${complaint.status}' status. Must be '${ComplaintStatus.UNDER_REVIEW}'.`
      );
    }

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      {
        $set: {
          status: ComplaintStatus.REJECTED,
          rejectionReason: dto.reason,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.REJECTED,
      actorId: new Types.ObjectId(user.id),
      remarks: `Complaint rejected: ${dto.reason}`,
    });

    await NotificationService.createAndEmit({
      recipientId: complaint.citizenId.toString(),
      type: NotificationType.COMPLAINT_REJECTED,
      title: "Complaint Rejected",
      message: `Your complaint (${complaint.referenceNumber}) was not approved. Reason: ${dto.reason}`,
      resourceType: "COMPLAINT",
      resourceId: complaint._id.toString(),
    });

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      status: ComplaintStatus.REJECTED,
      citizenId: complaint.citizenId.toString(),
      departmentId: complaint.departmentId?.toString(),
    });

    logger.info("Complaint rejected by admin", {
      id: complaint._id.toString(),
      adminId: user.id,
      reason: dto.reason,
    });

    return updated;
  }

  /**
   * Admin assigns complaint: VERIFIED/ASSIGNED -> ASSIGNED
   */
  public static async assign(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: AssignComplaintDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only municipal administrators can assign or reassign complaints.");
    }

    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    if (
      complaint.status !== ComplaintStatus.VERIFIED &&
      complaint.status !== ComplaintStatus.ASSIGNED
    ) {
      throw new ValidationError(
        `Cannot assign complaint in '${complaint.status}' status. Must be '${ComplaintStatus.VERIFIED}' or '${ComplaintStatus.ASSIGNED}'.`
      );
    }

    const department = await DepartmentService.findById(dto.departmentId);
    if (!department) {
      throw new NotFoundError(`Target department '${dto.departmentId}' does not exist.`);
    }

    let officerName: string | undefined;
    if (dto.assignedOfficerId) {
      const officer = await UserModel.findById(dto.assignedOfficerId);
      if (!officer || officer.role !== UserRole.OFFICER || !officer.isActive) {
        throw new ValidationError("Selected assigned officer does not exist or is not an active officer.");
      }
      if (officer.departmentId?.toString() !== dto.departmentId) {
        throw new ValidationError(
          `Officer '${officer.name}' does not belong to the selected department '${department.name}'.`
        );
      }
      officerName = officer.name;
    }

    const updateSet: Record<string, unknown> = {
      status: ComplaintStatus.ASSIGNED,
      departmentId: new Types.ObjectId(dto.departmentId),
      assignedOfficerId: dto.assignedOfficerId ? new Types.ObjectId(dto.assignedOfficerId) : undefined,
    };

    if (dto.priority) {
      updateSet.priority = dto.priority;
    }
    if (dto.dueAt) {
      updateSet.dueAt = dto.dueAt;
    } else if (!complaint.dueAt) {
      const priority = dto.priority || complaint.priority;
      updateSet.dueAt = calculateDueAt(priority, complaint.category);
    }

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      { $set: updateSet },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    const assignmentRemark =
      dto.remarks ||
      `Assigned to department '${department.name}'${officerName ? ` and officer '${officerName}'` : ""}.`;

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.ASSIGNED,
      actorId: new Types.ObjectId(user.id),
      remarks: assignmentRemark,
    });

    await NotificationService.createAndEmit({
      recipientId: complaint.citizenId.toString(),
      type: NotificationType.COMPLAINT_ASSIGNED,
      title: "Complaint Assigned",
      message: `Your complaint (${complaint.referenceNumber}) has been assigned to department '${department.name}'${officerName ? ` and officer '${officerName}'` : ""}.`,
      resourceType: "COMPLAINT",
      resourceId: complaint._id.toString(),
    });

    if (dto.assignedOfficerId) {
      await NotificationService.createAndEmit({
        recipientId: dto.assignedOfficerId,
        type: NotificationType.COMPLAINT_ASSIGNED,
        title: "New Incident Assigned",
        message: `You have been assigned complaint ${complaint.referenceNumber}: "${complaint.title}".`,
        resourceType: "COMPLAINT",
        resourceId: complaint._id.toString(),
      });
    }

    emitComplaintAssigned({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      departmentId: dto.departmentId,
      assignedOfficerId: dto.assignedOfficerId,
      citizenId: complaint.citizenId.toString(),
    });

    logger.info("Complaint assigned by admin", {
      id: complaint._id.toString(),
      adminId: user.id,
      departmentId: dto.departmentId,
      assignedOfficerId: dto.assignedOfficerId,
    });

    return updated;
  }

  /**
   * Officer starts work: ASSIGNED -> IN_PROGRESS
   */
  public static async startWork(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: StartWorkDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;
    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    // Authorization: Must be Admin OR Officer belonging to the assigned department / assigned to complaint
    if (user.role === UserRole.CITIZEN) {
      throw new ForbiddenError("Citizens cannot update officer complaint status.");
    }

    if (user.role === UserRole.OFFICER) {
      const isAssigned = complaint.assignedOfficerId?.toString() === user.id;
      const isSameDept = complaint.departmentId?.toString() === user.departmentId;
      if (!isAssigned && !isSameDept) {
        throw new ForbiddenError("You can only start work on complaints assigned to your department.");
      }
    }

    if (!isValidStatusTransition(complaint.status, ComplaintStatus.IN_PROGRESS)) {
      throw new ValidationError(
        `Cannot start work on complaint in '${complaint.status}' status. Must be '${ComplaintStatus.ASSIGNED}'.`
      );
    }

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      { $set: { status: ComplaintStatus.IN_PROGRESS } },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.IN_PROGRESS,
      actorId: new Types.ObjectId(user.id),
      remarks: dto.remarks || "Officer commenced field investigation and resolution.",
    });

    await NotificationService.createAndEmit({
      recipientId: complaint.citizenId.toString(),
      type: NotificationType.COMPLAINT_IN_PROGRESS,
      title: "Work Commenced",
      message: `An officer has commenced on-site investigation and repair work for complaint ${complaint.referenceNumber}.`,
      resourceType: "COMPLAINT",
      resourceId: complaint._id.toString(),
    });

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      status: ComplaintStatus.IN_PROGRESS,
      citizenId: complaint.citizenId.toString(),
      departmentId: complaint.departmentId ? complaint.departmentId.toString() : undefined,
      assignedOfficerId: complaint.assignedOfficerId ? complaint.assignedOfficerId.toString() : undefined,
    });

    logger.info("Complaint transitioned to IN_PROGRESS", {
      id: complaint._id.toString(),
      officerId: user.id,
    });

    return updated;
  }

  /**
   * Officer resolves issue: IN_PROGRESS -> RESOLVED
   */
  public static async resolve(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: ResolveComplaintDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;
    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    // Authorization: Must be Admin OR Officer belonging to the assigned department / assigned to complaint
    if (user.role === UserRole.CITIZEN) {
      throw new ForbiddenError("Citizens cannot resolve complaints.");
    }

    if (user.role === UserRole.OFFICER) {
      const isAssigned = complaint.assignedOfficerId?.toString() === user.id;
      const isSameDept = complaint.departmentId?.toString() === user.departmentId;
      if (!isAssigned && !isSameDept) {
        throw new ForbiddenError("You can only resolve complaints assigned to your department.");
      }
    }

    if (!isValidStatusTransition(complaint.status, ComplaintStatus.RESOLVED)) {
      throw new ValidationError(
        `Cannot resolve complaint in '${complaint.status}' status. Must be '${ComplaintStatus.IN_PROGRESS}'.`
      );
    }

    // If evidence was provided, link in storage
    if (dto.evidence && dto.evidence.length > 0) {
      const keys = dto.evidence.map((e) => e.objectKey);
      await StorageService.validateUploadIntents({
        objectKeys: keys,
        userId: user.id,
      });
      await StorageService.markEvidenceAttached({
        objectKeys: keys,
        complaintId: complaint._id,
        userId: user.id,
      });
    }

    // Populate pre-signed S3 URL so that the URL is stored directly in DB
    const resolvedEvidenceWithUrls = await Promise.all(
      (dto.evidence || []).map(async (item) => {
        const key = item.objectKey || item.key;
        let url = item.url;
        if (!url && key) {
          try {
            url = await S3Service.generatePresignedViewUrl(key);
          } catch {
            url = item.url || "";
          }
        }
        return {
          objectKey: key,
          key,
          contentType: item.contentType,
          size: item.size,
          url,
          originalName: item.originalName || "Officer Resolution Proof",
          uploadedAt: item.uploadedAt || new Date(),
        };
      })
    );

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      {
        $set: {
          status: ComplaintStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionRemarks: dto.remarks,
          resolutionEvidence: resolvedEvidenceWithUrls,
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.RESOLVED,
      actorId: new Types.ObjectId(user.id),
      remarks: dto.remarks,
      evidence: resolvedEvidenceWithUrls,
    });

    try {
      await NotificationService.createAndEmit({
        recipientId: complaint.citizenId.toString(),
        type: NotificationType.COMPLAINT_RESOLVED,
        title: "Complaint Resolved",
        message: `Your complaint (${complaint.referenceNumber}) has been resolved by municipal field officers. Please review the resolution and submit your feedback.`,
        resourceType: "COMPLAINT",
        resourceId: complaint._id.toString(),
      });
    } catch (notifErr) {
      logger.warn("Notification delivery failed, workflow completed safely", {
        complaintId: complaint._id.toString(),
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      status: ComplaintStatus.RESOLVED,
      citizenId: complaint.citizenId.toString(),
      departmentId: complaint.departmentId ? complaint.departmentId.toString() : undefined,
      assignedOfficerId: complaint.assignedOfficerId ? complaint.assignedOfficerId.toString() : undefined,
    });

    logger.info("Complaint marked RESOLVED", {
      id: complaint._id.toString(),
      officerId: user.id,
      hasEvidence: Boolean(dto.evidence?.length),
    });

    return updated;
  }

  /**
   * Admin formally closes complaint: VERIFIED/ASSIGNED/IN_PROGRESS/RESOLVED -> CLOSED
   */
  public static async close(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: CloseComplaintDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only municipal administrators can formally close complaints.");
    }

    const complaint = await ComplaintQueryService.findComplaint(idOrRef);

    if (!isValidStatusTransition(complaint.status, ComplaintStatus.CLOSED)) {
      throw new ValidationError(
        `Cannot close complaint in '${complaint.status}' status. Current status does not permit closing.`
      );
    }

    const updated = await ComplaintModel.findOneAndUpdate(
      { _id: complaint._id, status: complaint.status },
      {
        $set: {
          status: ComplaintStatus.CLOSED,
          closedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updated) {
      throw new ConflictError("Complaint was modified concurrently. Please refresh.");
    }

    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      fromStatus: complaint.status,
      toStatus: ComplaintStatus.CLOSED,
      actorId: new Types.ObjectId(user.id),
      remarks: dto.remarks || "Municipal administrator formally closed the complaint.",
    });

    try {
      await NotificationService.createAndEmit({
        recipientId: complaint.citizenId.toString(),
        type: NotificationType.COMPLAINT_CLOSED,
        title: "Complaint Closed",
        message: `Your complaint (${complaint.referenceNumber}) has been formally closed by municipal administration.`,
        resourceType: "COMPLAINT",
        resourceId: complaint._id.toString(),
      });

      if (complaint.assignedOfficerId) {
        await NotificationService.createAndEmit({
          recipientId: complaint.assignedOfficerId.toString(),
          type: NotificationType.COMPLAINT_CLOSED,
          title: "Complaint Closed",
          message: `Complaint ${complaint.referenceNumber} has been formally closed by municipal administration.`,
          resourceType: "COMPLAINT",
          resourceId: complaint._id.toString(),
        });
      }
    } catch (notifErr) {
      logger.warn("Notification delivery failed on close, continuing", {
        complaintId: complaint._id.toString(),
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber: complaint.referenceNumber,
      status: ComplaintStatus.CLOSED,
      citizenId: complaint.citizenId.toString(),
      departmentId: complaint.departmentId ? complaint.departmentId.toString() : undefined,
      assignedOfficerId: complaint.assignedOfficerId ? complaint.assignedOfficerId.toString() : undefined,
    });

    logger.info("Complaint formally CLOSED by admin", {
      id: complaint._id.toString(),
      adminId: user.id,
    });

    return updated;
  }
}
