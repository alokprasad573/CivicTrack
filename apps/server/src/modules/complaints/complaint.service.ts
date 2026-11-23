import { ComplaintQueryService } from "./complaint-query.service.js";
import { ComplaintSubmissionService } from "./complaint-submission.service.js";
import { ComplaintWorkflowService } from "./complaint-workflow.service.js";

// Re-export specialized domain services for targeted imports
export { ComplaintQueryService } from "./complaint-query.service.js";
export { ComplaintSubmissionService } from "./complaint-submission.service.js";
export { ComplaintWorkflowService } from "./complaint-workflow.service.js";

/**
 * Unified ComplaintService Facade
 *
 * Provides a unified entry point while delegating domain logic
 * to specialized single-responsibility services:
 *
 * 1. ComplaintSubmissionService:
 *    - Complaint submission with S3 evidence ownership verification
 *    - Reference number generation (CT-YYYY-NNNNNN)
 *    - Citizen feedback submission & automatic closed advancement
 *
 * 2. ComplaintQueryService:
 *    - Object-level authorized single-complaint retrieval with audit history
 *    - Role-based scoped listing (Citizen, Officer, Admin)
 *    - GeoJSON 2dsphere proximity searches ($near)
 *
 * 3. ComplaintWorkflowService:
 *    - Administrative review triage (SUBMITTED -> UNDER_REVIEW)
 *    - Formal approval verification (UNDER_REVIEW -> VERIFIED)
 *    - Administrative rejection (UNDER_REVIEW -> REJECTED)
 *    - Department & Officer assignment (VERIFIED/ASSIGNED -> ASSIGNED)
 *    - Field investigation commencement (ASSIGNED -> IN_PROGRESS)
 *    - Resolution with evidence and remarks (IN_PROGRESS -> RESOLVED)
 */
export class ComplaintService {
  // --- Complaint Submission & Feedback ---
  public static readonly create = ComplaintSubmissionService.create;
  public static readonly submitFeedback = ComplaintSubmissionService.submitFeedback;

  // --- Query, Search & Geospatial Retrieval ---
  public static readonly getById = ComplaintQueryService.getById;
  public static readonly list = ComplaintQueryService.list;
  public static readonly findNearby = ComplaintQueryService.findNearby;

  // --- Workflow Lifecycle & Status State Machine ---
  public static readonly review = ComplaintWorkflowService.review;
  public static readonly verify = ComplaintWorkflowService.verify;
  public static readonly reject = ComplaintWorkflowService.reject;
  public static readonly assign = ComplaintWorkflowService.assign;
  public static readonly startWork = ComplaintWorkflowService.startWork;
  public static readonly resolve = ComplaintWorkflowService.resolve;
  public static readonly close = ComplaintWorkflowService.close;
}
