import { ComplaintStatus } from "./enums";

/**
 * Canonical Complaint Status Transitions
 * 
 * SUBMITTED -> UNDER_REVIEW
 * UNDER_REVIEW -> VERIFIED | REJECTED
 * VERIFIED -> ASSIGNED
 * ASSIGNED -> IN_PROGRESS
 * IN_PROGRESS -> RESOLVED
 * RESOLVED -> CLOSED
 */
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<ComplaintStatus, ReadonlyArray<ComplaintStatus>>> = {
  [ComplaintStatus.SUBMITTED]: [ComplaintStatus.UNDER_REVIEW],
  [ComplaintStatus.UNDER_REVIEW]: [ComplaintStatus.VERIFIED, ComplaintStatus.REJECTED],
  [ComplaintStatus.VERIFIED]: [ComplaintStatus.ASSIGNED, ComplaintStatus.CLOSED],
  [ComplaintStatus.REJECTED]: [], // Terminal state unless reopened by policy
  [ComplaintStatus.ASSIGNED]: [ComplaintStatus.IN_PROGRESS, ComplaintStatus.ASSIGNED, ComplaintStatus.CLOSED], // Allows work start, reassignment, or admin closure
  [ComplaintStatus.IN_PROGRESS]: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED],
  [ComplaintStatus.RESOLVED]: [ComplaintStatus.CLOSED],
  [ComplaintStatus.CLOSED]: [], // Terminal state
};

export function isValidStatusTransition(from: ComplaintStatus, to: ComplaintStatus): boolean {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
