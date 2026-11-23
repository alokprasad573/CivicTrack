import { Types } from "mongoose";
import { ComplaintModel, IComplaintDocument } from "../complaints/complaint.model.js";
import { ComplaintStatusHistoryModel } from "../complaints/complaint-history.model.js";
import {
  IDuplicateCandidate,
  DuplicateCheckResponse,
  DuplicateSignalReason,
  ComplaintStatus,
  UserRole,
} from "@civictrack/contracts";
import { NotFoundError, ForbiddenError, ValidationError } from "../../common/errors/app-error.js";
import { calculateHaversineDistance } from "../maps/maps.service.js";
import { IAuthUser } from "../identity/identity.types.js";
import { logger } from "../../common/utils/logger.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "in", "on", "at", "by", "for", "with", "about", "against",
  "between", "into", "through", "during", "before", "after", "above", "below",
  "to", "from", "up", "down", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "and", "but", "if", "or", "because",
  "as", "until", "while", "of", "road", "street", "near", "opposite", "area", "main"
]);

function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(words);
}

function calculateJaccardSimilarity(textA: string, textB: string): number {
  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionCount++;
  }

  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export class DuplicateDetectionService {
  /**
   * Find and score explainable duplicate complaint candidates
   */
  public static async findCandidates(
    complaintId: string,
    user?: IAuthUser
  ): Promise<DuplicateCheckResponse> {
    if (!Types.ObjectId.isValid(complaintId)) {
      throw new ValidationError("Invalid complaint ID format");
    }

    if (ComplaintModel.db.readyState !== 1) {
      return {
        targetComplaintId: complaintId,
        candidates: [],
        totalCandidates: 0,
      };
    }

    const target = await ComplaintModel.findById(complaintId);
    if (!target) {
      throw new NotFoundError("Target complaint not found");
    }

    if (user && user.role === UserRole.OFFICER) {
      const deptId = target.departmentId?.toString();
      if (!deptId || deptId !== user.departmentId) {
        throw new ForbiddenError("You can only inspect duplicate candidates for complaints in your department");
      }
    }

    const [targetLng, targetLat] = target.location.coordinates;

    const nearbyFilter: Record<string, unknown> = {
      _id: { $ne: target._id },
      status: {
        $nin: [ComplaintStatus.REJECTED, ComplaintStatus.CLOSED],
      },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [targetLng, targetLat],
          },
          $maxDistance: 250, // 250 meters max radius
        },
      },
    };

    // Strict departmental isolation: Officers only see candidates within their own department
    if (user && user.role === UserRole.OFFICER && user.departmentId) {
      nearbyFilter.departmentId = new Types.ObjectId(user.departmentId);
    }

    // Spatial filter: Find complaints within 250 meters
    const nearby = await ComplaintModel.find(nearbyFilter).limit(20);

    const candidates: IDuplicateCandidate[] = [];

    for (const item of nearby) {
      const [itemLng, itemLat] = item.location.coordinates;
      const distanceMeters = Math.round(
        calculateHaversineDistance(targetLat, targetLng, itemLat, itemLng) * 1000
      );

      const reasons: DuplicateSignalReason[] = [];
      let score = 0;

      // Signal 1: Category Match (+30 pts)
      if (item.category === target.category) {
        score += 30;
        reasons.push("SAME_CATEGORY");
      }

      // Signal 2: Spatial Proximity (<50m: +35, <100m: +25, <250m: +15)
      if (distanceMeters <= 50) {
        score += 35;
        reasons.push("WITHIN_DISTANCE");
      } else if (distanceMeters <= 100) {
        score += 25;
        reasons.push("WITHIN_DISTANCE");
      } else if (distanceMeters <= 250) {
        score += 15;
        reasons.push("WITHIN_DISTANCE");
      }

      // Signal 3: Text & Description Similarity (up to +35 pts)
      const combinedTargetText = `${target.title} ${target.description}`;
      const combinedCandidateText = `${item.title} ${item.description}`;
      const textSimilarity = calculateJaccardSimilarity(combinedTargetText, combinedCandidateText);

      if (textSimilarity >= 0.2) {
        const textScore = Math.min(35, Math.round(textSimilarity * 50));
        score += textScore;
        reasons.push("DESCRIPTION_SIMILARITY");
      }

      // Signal 4: Address token overlap
      const addressSimilarity = calculateJaccardSimilarity(target.address, item.address);
      if (addressSimilarity >= 0.3) {
        score = Math.min(100, score + 10);
        reasons.push("ADDRESS_MATCH");
      }

      const finalScore = Math.min(100, Math.max(0, score));

      // Advisory Threshold: Score >= 40 indicates non-trivial similarity
      if (finalScore >= 40) {
        candidates.push({
          complaintId: item._id.toString(),
          referenceNumber: item.referenceNumber,
          title: item.title,
          category: item.category,
          status: item.status,
          similarityScore: finalScore,
          distanceMeters,
          reasons,
          address: item.address,
          createdAt: item.createdAt.toISOString(),
        });
      }
    }

    // Sort by highest similarity score
    candidates.sort((a, b) => b.similarityScore - a.similarityScore);

    return {
      targetComplaintId: complaintId,
      candidates,
      totalCandidates: candidates.length,
    };
  }

  /**
   * Admin explicitly links a complaint as a duplicate (non-destructive)
   */
  public static async linkDuplicate(params: {
    complaintId: string;
    duplicateOfId: string;
    user: IAuthUser;
    remarks?: string;
  }): Promise<IComplaintDocument> {
    const { complaintId, duplicateOfId, user, remarks } = params;

    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError("Only administrators can link duplicate complaints.");
    }

    if (!Types.ObjectId.isValid(complaintId) || !Types.ObjectId.isValid(duplicateOfId)) {
      throw new ValidationError("Invalid complaint ID format");
    }

    if (complaintId === duplicateOfId) {
      throw new ValidationError("A complaint cannot be linked as a duplicate of itself.");
    }

    const [target, primary] = await Promise.all([
      ComplaintModel.findById(complaintId),
      ComplaintModel.findById(duplicateOfId),
    ]);

    if (!target) throw new NotFoundError("Target complaint not found");
    if (!primary) throw new NotFoundError("Primary complaint to link not found");

    if (primary.isDuplicate && primary.duplicateOf?.toString() === target._id.toString()) {
      throw new ValidationError("Cannot link complaints in a circular duplicate relationship.");
    }

    target.duplicateOf = primary._id;
    target.isDuplicate = true;
    await target.save();

    await ComplaintStatusHistoryModel.create({
      complaintId: target._id,
      fromStatus: target.status,
      toStatus: target.status,
      actorId: new Types.ObjectId(user.id),
      remarks: remarks || `Advisory link: marked as duplicate of primary incident ${primary.referenceNumber}.`,
    });

    logger.info("Complaint linked as duplicate", {
      targetId: target._id.toString(),
      targetRef: target.referenceNumber,
      primaryId: primary._id.toString(),
      primaryRef: primary.referenceNumber,
      adminId: user.id,
    });

    return target;
  }
}
