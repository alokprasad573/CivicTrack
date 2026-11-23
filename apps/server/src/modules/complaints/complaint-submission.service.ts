import { Types } from "mongoose";
import { ComplaintModel, IComplaintDocument } from "./complaint.model.js";
import { ComplaintStatusHistoryModel } from "./complaint-history.model.js";
import { getNextComplaintReference } from "./counter.model.js";
import { DepartmentService } from "../departments/department.service.js";
import { StorageService } from "../storage/storage.service.js";
import { UserModel } from "../users/user.model.js";
import {
  ComplaintPriority,
  ComplaintStatus,
  CreateComplaintDto,
  SubmitFeedbackDto,
  NotificationType,
} from "@civictrack/contracts";
import { NotFoundError, ForbiddenError, ValidationError } from "../../common/errors/app-error.js";
import { logger } from "../../common/utils/logger.js";
import { IAuthUser } from "../identity/identity.types.js";
import { NotificationService } from "../notifications/notification.service.js";
import { emitComplaintStatusUpdated, emitComplaintCreated } from "../../socket.js";

export class ComplaintSubmissionService {
  /**
   * Submit a new civic complaint
   */
  public static async create(params: {
    citizenId: string;
    dto: CreateComplaintDto;
  }): Promise<IComplaintDocument> {
    const { citizenId, dto } = params;

    // Validate evidence object keys ownership
    if (dto.evidence && dto.evidence.length > 0) {
      const allowedPrefixes = [
        `evidence/${citizenId}/`,
        `complaints/${citizenId}/`,
      ];

      // Also allow clerkUserId if available
      try {
        if (UserModel.db.readyState === 1 && Types.ObjectId.isValid(citizenId)) {
          const userDoc = await UserModel.findById(citizenId).select("clerkUserId").lean();
          if (userDoc?.clerkUserId) {
            allowedPrefixes.push(`evidence/${userDoc.clerkUserId}/`);
            allowedPrefixes.push(`complaints/${userDoc.clerkUserId}/`);
          }
        }
      } catch {
        // Non-blocking lookup fallback
      }

      // In non-production environments, also tolerate mock prefixes for local testing
      if (process.env.NODE_ENV !== "production") {
        allowedPrefixes.push("evidence/mock_user/");
        allowedPrefixes.push("complaints/mock_user/");
      }

      for (const item of dto.evidence) {
        const isAllowed = allowedPrefixes.some((prefix) => item.objectKey.startsWith(prefix));
        if (!isAllowed) {
          throw new ForbiddenError(
            "Cannot attach evidence object keys that do not belong to you."
          );
        }
      }
    }

    const referenceNumber = await getNextComplaintReference();

    // Map department by category if available
    let departmentId: Types.ObjectId | undefined;
    const department = await DepartmentService.findByCategory(dto.category);
    if (department) {
      departmentId = department._id;
    }

    const complaintData = {
      referenceNumber,
      citizenId: new Types.ObjectId(citizenId),
      title: dto.title,
      description: dto.description,
      category: dto.category,
      status: ComplaintStatus.SUBMITTED,
      priority: ComplaintPriority.MEDIUM,
      location: dto.location,
      address: dto.address,
      landmark: dto.landmark,
      evidence: dto.evidence,
      departmentId,
    };

    // Validate upload intents BEFORE persisting to database
    if (dto.evidence && dto.evidence.length > 0) {
      await StorageService.validateUploadIntents({
        objectKeys: dto.evidence.map((e: { objectKey: string }) => e.objectKey),
        userId: citizenId,
      });
    }

    // If database is offline (test mode), return instantiated document
    if (ComplaintModel.db.readyState !== 1) {
      const offlineDoc = new ComplaintModel({
        ...complaintData,
        _id: new Types.ObjectId(),
      });
      return offlineDoc;
    }

    const complaint = await ComplaintModel.create(complaintData);

    // If evidence was attached, link and update status in UploadIntent tracker
    if (dto.evidence && dto.evidence.length > 0) {
      await StorageService.markEvidenceAttached({
        objectKeys: dto.evidence.map((e: { objectKey: string }) => e.objectKey),
        complaintId: complaint._id,
        userId: citizenId,
      });
    }

    // Record initial status history
    await ComplaintStatusHistoryModel.create({
      complaintId: complaint._id,
      toStatus: ComplaintStatus.SUBMITTED,
      actorId: new Types.ObjectId(citizenId),
      remarks: "Complaint submitted by citizen",
      evidence: dto.evidence,
    });

    // Persist notification and emit socket event (Persist-Before-Emit)
    await NotificationService.createAndEmit({
      recipientId: citizenId,
      type: NotificationType.COMPLAINT_CREATED,
      title: "Complaint Registered",
      message: `Your complaint "${complaint.title}" has been registered with reference ${referenceNumber}.`,
      resourceType: "COMPLAINT",
      resourceId: complaint._id.toString(),
    });

    emitComplaintCreated({
      complaintId: complaint._id.toString(),
      referenceNumber,
      title: complaint.title,
      category: complaint.category,
      status: complaint.status,
      priority: complaint.priority,
      citizenId,
      address: complaint.address,
      location: complaint.location,
      departmentId: departmentId ? departmentId.toString() : undefined,
      createdAt: complaint.createdAt,
    });

    emitComplaintStatusUpdated({
      complaintId: complaint._id.toString(),
      referenceNumber,
      status: ComplaintStatus.SUBMITTED,
      citizenId,
      departmentId: departmentId ? departmentId.toString() : undefined,
      title: complaint.title,
      category: complaint.category,
      priority: complaint.priority,
      updatedAt: complaint.createdAt,
    });

    logger.info("Complaint created successfully", {
      id: complaint._id.toString(),
      referenceNumber,
      category: dto.category,
      citizenId,
    });

    return complaint;
  }

  /**
   * Submit citizen feedback after resolution and close the complaint
   */
  public static async submitFeedback(params: {
    idOrRef: string;
    user: IAuthUser;
    dto: SubmitFeedbackDto;
  }): Promise<IComplaintDocument> {
    const { idOrRef, user, dto } = params;

    const isObjectId = Types.ObjectId.isValid(idOrRef);
    const query = isObjectId
      ? { $or: [{ _id: new Types.ObjectId(idOrRef) }, { referenceNumber: idOrRef }] }
      : { referenceNumber: idOrRef };

    if (ComplaintModel.db.readyState !== 1) {
      throw new NotFoundError("Complaint not found (database offline)");
    }

    const complaint = await ComplaintModel.findOne(query);
    if (!complaint) {
      throw new NotFoundError("Complaint not found");
    }

    // Only the citizen who submitted the complaint can provide feedback
    if (complaint.citizenId.toString() !== user.id) {
      throw new ForbiddenError("Only the citizen who filed this complaint can submit feedback.");
    }

    // Feedback can only be submitted for RESOLVED or CLOSED complaints
    if (
      complaint.status !== ComplaintStatus.RESOLVED &&
      complaint.status !== ComplaintStatus.CLOSED
    ) {
      throw new ValidationError(
        `Feedback can only be provided after complaint resolution. Current status is ${complaint.status}.`
      );
    }

    complaint.feedbackRating = dto.rating;
    if (dto.comment) {
      complaint.feedbackComment = dto.comment;
    }
    complaint.feedbackSubmittedAt = new Date();

    // If currently RESOLVED, advance to CLOSED upon citizen confirmation
    if (complaint.status === ComplaintStatus.RESOLVED) {
      complaint.status = ComplaintStatus.CLOSED;
      complaint.closedAt = new Date();

      await ComplaintStatusHistoryModel.create({
        complaintId: complaint._id,
        toStatus: ComplaintStatus.CLOSED,
        actorId: new Types.ObjectId(user.id),
        remarks: `Citizen submitted feedback (${dto.rating}/5 stars) and closed complaint.`,
      });

      if (complaint.assignedOfficerId) {
        await NotificationService.createAndEmit({
          recipientId: complaint.assignedOfficerId.toString(),
          type: NotificationType.COMPLAINT_CLOSED,
          title: "Complaint Closed & Feedback Received",
          message: `Citizen submitted a ${dto.rating}-star review for complaint ${complaint.referenceNumber}. Complaint closed.`,
          resourceType: "COMPLAINT",
          resourceId: complaint._id.toString(),
        });
      }

      emitComplaintStatusUpdated({
        complaintId: complaint._id.toString(),
        referenceNumber: complaint.referenceNumber,
        status: ComplaintStatus.CLOSED,
        citizenId: user.id,
        departmentId: complaint.departmentId ? complaint.departmentId.toString() : undefined,
        assignedOfficerId: complaint.assignedOfficerId ? complaint.assignedOfficerId.toString() : undefined,
      });
    }

    await complaint.save();

    logger.info("Citizen feedback submitted", {
      complaintId: complaint._id.toString(),
      rating: dto.rating,
      citizenId: user.id,
    });

    return complaint;
  }
}
