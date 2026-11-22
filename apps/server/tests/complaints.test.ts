import request from "supertest";
import { app } from "../src/app.js";
import {
  CreateComplaintSchema,
  SubmitFeedbackSchema,
  ReviewComplaintSchema,
  VerifyComplaintSchema,
  RejectComplaintSchema,
  AssignComplaintSchema,
  StartWorkSchema,
  ResolveComplaintSchema,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
  isValidStatusTransition,
} from "@civictrack/contracts";
import { getNextComplaintReference } from "../src/modules/complaints/counter.model.js";

async function runComplaintTests(): Promise<void> {
  console.log("Running Phase 4 Core Data Models & Complaint Domain Verification Tests...\n");

  // 1. Department listing endpoint
  const deptRes = await request(app).get("/api/v1/departments");
  console.log("1. GET /api/v1/departments:");
  console.log("   Status:", deptRes.status);
  console.log("   Body:", JSON.stringify(deptRes.body));
  if (deptRes.status !== 200 || !deptRes.body.success) {
    throw new Error("Failed: GET /api/v1/departments must return 200 OK");
  }
  console.log("   -> Active departments listed successfully\n");

  // 2. Unauthenticated complaint creation must be rejected with 401
  const unauthCreateRes = await request(app)
    .post("/api/v1/complaints")
    .send({
      title: "Broken streetlight near main gate",
      description: "The streetlight has been blinking and completely off for the past week, creating safety hazards.",
      category: ComplaintCategory.STREETLIGHTS,
      location: { type: "Point", coordinates: [77.5946, 12.9716] },
      address: "123 Civic Road, Bangalore",
    });
  console.log("2. POST /api/v1/complaints (unauthenticated):");
  console.log("   Status:", unauthCreateRes.status);
  console.log("   Body:", JSON.stringify(unauthCreateRes.body));
  if (unauthCreateRes.status !== 401) {
    throw new Error("Failed: unauthenticated complaint creation must return 401 UNAUTHORIZED");
  }
  console.log("   -> Correctly rejected with 401 UNAUTHORIZED\n");

  // 3. Nearby spatial query validation
  // 3a. Invalid coordinates (longitude > 180) must return 400
  const invalidGeoRes = await request(app).get("/api/v1/complaints/nearby?lng=999&lat=12.9716");
  console.log("3a. GET /api/v1/complaints/nearby (invalid longitude 999):");
  console.log("    Status:", invalidGeoRes.status);
  console.log("    Body:", JSON.stringify(invalidGeoRes.body));
  if (invalidGeoRes.status !== 400) {
    throw new Error("Failed: nearby query with out-of-range coordinates must return 400");
  }
  console.log("    -> Correctly rejected with 400 VALIDATION_ERROR\n");

  // 3b. Valid coordinates must return 200 OK
  const validGeoRes = await request(app).get("/api/v1/complaints/nearby?lng=77.5946&lat=12.9716&radius=1000");
  console.log("3b. GET /api/v1/complaints/nearby (valid coordinates):");
  console.log("    Status:", validGeoRes.status);
  console.log("    Body:", JSON.stringify(validGeoRes.body));
  if (validGeoRes.status !== 200 || !validGeoRes.body.success) {
    throw new Error("Failed: valid nearby spatial query must return 200 OK");
  }
  console.log("    -> Valid nearby query processed successfully\n");

  // 4. Schema-level validation unit tests
  console.log("4. Testing Zod Complaint Contracts & GeoJSON Validation:");
  const validPayload = {
    title: "Major water leakage on 5th cross",
    description: "Continuous water flow observed from underground pipe since yesterday morning.",
    category: ComplaintCategory.WATER_SUPPLY,
    location: { type: "Point" as const, coordinates: [77.5946, 12.9716] as [number, number] },
    address: "5th Cross Road, Ward 12",
  };
  const parseResult = CreateComplaintSchema.safeParse(validPayload);
  if (!parseResult.success) {
    throw new Error(`Failed to validate valid complaint payload: ${JSON.stringify(parseResult.error)}`);
  }
  console.log("   -> Valid complaint schema parsed successfully");

  // Invalid description too short (< 20 chars)
  const shortDescPayload = { ...validPayload, description: "Too short" };
  const shortDescResult = CreateComplaintSchema.safeParse(shortDescPayload);
  if (shortDescResult.success) {
    throw new Error("Failed: Schema must reject description shorter than 20 characters");
  }
  console.log("   -> Short description rejected as expected");

  // Invalid coordinates (lat > 90)
  const invalidLatPayload = {
    ...validPayload,
    location: { type: "Point" as const, coordinates: [77.5946, 150.0] as [number, number] },
  };
  const invalidLatResult = CreateComplaintSchema.safeParse(invalidLatPayload);
  if (invalidLatResult.success) {
    throw new Error("Failed: Schema must reject latitude > 90");
  }
  console.log("   -> Out-of-bounds latitude [77.5946, 150.0] rejected as expected\n");

  // 5. Concurrency-safe complaint reference number generator
  console.log("5. Testing Reference Number Generation:");
  const ref1 = await getNextComplaintReference();
  const ref2 = await getNextComplaintReference();
  console.log("   Generated ref 1:", ref1);
  console.log("   Generated ref 2:", ref2);
  const refRegex = /^CT-\d{4}-\d{6}$/;
  if (!refRegex.test(ref1) || !refRegex.test(ref2)) {
    throw new Error(`Reference number format invalid. Expected pattern ^CT-YYYY-NNNNNN$, got ${ref1}`);
  }
  if (ref1 === ref2) {
    throw new Error("Consecutive reference numbers must be unique");
  }
  console.log("   -> Reference numbers follow canonical CT-YYYY-NNNNNN pattern and are unique\n");

  // 6. Canonical state machine workflow rules
  console.log("6. Testing Status Transition State Machine Rules:");
  if (!isValidStatusTransition(ComplaintStatus.SUBMITTED, ComplaintStatus.UNDER_REVIEW)) {
    throw new Error("SUBMITTED -> UNDER_REVIEW should be valid");
  }
  if (isValidStatusTransition(ComplaintStatus.SUBMITTED, ComplaintStatus.RESOLVED)) {
    throw new Error("SUBMITTED -> RESOLVED must be rejected (cannot skip review/assignment)");
  }
  if (!isValidStatusTransition(ComplaintStatus.UNDER_REVIEW, ComplaintStatus.VERIFIED)) {
    throw new Error("UNDER_REVIEW -> VERIFIED should be valid");
  }
  if (!isValidStatusTransition(ComplaintStatus.UNDER_REVIEW, ComplaintStatus.REJECTED)) {
    throw new Error("UNDER_REVIEW -> REJECTED should be valid");
  }
  if (isValidStatusTransition(ComplaintStatus.REJECTED, ComplaintStatus.IN_PROGRESS)) {
    throw new Error("REJECTED -> IN_PROGRESS must be rejected (terminal state)");
  }
  console.log("   -> State machine rules strictly enforce canonical workflow\n");

  // 7. Feedback submission and validation
  console.log("7. Testing Citizen Feedback & Validation:");
  const validFeedback = SubmitFeedbackSchema.safeParse({ rating: 5, comment: "Quick resolution, thank you!" });
  if (!validFeedback.success) {
    throw new Error("Failed: Valid feedback rating 5 should be accepted");
  }
  const invalidFeedbackLow = SubmitFeedbackSchema.safeParse({ rating: 0 });
  if (invalidFeedbackLow.success) {
    throw new Error("Failed: Feedback rating 0 must be rejected");
  }
  const invalidFeedbackHigh = SubmitFeedbackSchema.safeParse({ rating: 6 });
  if (invalidFeedbackHigh.success) {
    throw new Error("Failed: Feedback rating 6 must be rejected");
  }
  console.log("   -> Feedback rating boundary validation (1..5) enforced correctly");

  const unauthFeedbackRes = await request(app)
    .post("/api/v1/complaints/673d32840000000000000001/feedback")
    .send({ rating: 4, comment: "Good work" });
  if (unauthFeedbackRes.status !== 401) {
    throw new Error(`Failed: unauthenticated feedback must return 401, got ${unauthFeedbackRes.status}`);
  }
  console.log("   -> Unauthenticated feedback submission rejected with 401 UNAUTHORIZED\n");

  // 8. Phase 8 Admin Triage & Assignment Contract Verification
  console.log("8. Testing Phase 8 Admin Triage & Assignment Contracts:");
  // Rejection requires min 5 char reason
  const validReject = RejectComplaintSchema.safeParse({ reason: "Duplicate submission of existing reported water leak" });
  if (!validReject.success) throw new Error("Failed: Valid rejection reason should pass");
  const shortReject = RejectComplaintSchema.safeParse({ reason: "bad" });
  if (shortReject.success) throw new Error("Failed: Rejection reason shorter than 5 chars must fail");
  console.log("   -> RejectComplaintSchema min-length validation enforced");

  // Assignment requires departmentId
  const validAssign = AssignComplaintSchema.safeParse({
    departmentId: "673d32840000000000000010",
    priority: ComplaintPriority.HIGH,
    remarks: "Priority fix due to main arterial road traffic",
  });
  if (!validAssign.success) throw new Error("Failed: Valid assignment schema should pass");
  const missingDeptAssign = AssignComplaintSchema.safeParse({ priority: ComplaintPriority.HIGH });
  if (missingDeptAssign.success) throw new Error("Failed: Assignment without departmentId must fail");
  console.log("   -> AssignComplaintSchema department requirement enforced");

  // Authentication guards on admin endpoints
  const unauthReview = await request(app).post("/api/v1/complaints/673d32840000000000000001/review").send({});
  const unauthVerify = await request(app).post("/api/v1/complaints/673d32840000000000000001/verify").send({});
  const unauthReject = await request(app).post("/api/v1/complaints/673d32840000000000000001/reject").send({ reason: "Test reason" });
  const unauthAssign = await request(app).post("/api/v1/complaints/673d32840000000000000001/assign").send({ departmentId: "673d32840000000000000010" });

  if (unauthReview.status !== 401 || unauthVerify.status !== 401 || unauthReject.status !== 401 || unauthAssign.status !== 401) {
    throw new Error("Failed: Unauthenticated admin workflow calls must be rejected with 401");
  }
  console.log("   -> All admin endpoints (review, verify, reject, assign) protected with 401 guards\n");

  // 9. Phase 8 Officer Workflow & Resolution Verification
  console.log("9. Testing Phase 8 Officer Workflow & Resolution Contracts:");
  // Resolution requires min 10 char remarks
  const validResolve = ResolveComplaintSchema.safeParse({
    remarks: "Asphalt repaved and pothole filled with cold mix bitumen; verified level with road.",
    evidence: [{ objectKey: "evidence/test/resolved.jpg", contentType: "image/jpeg", size: 102400 }],
  });
  if (!validResolve.success) throw new Error("Failed: Valid resolution schema should pass");
  const shortResolve = ResolveComplaintSchema.safeParse({ remarks: "Fixed" });
  if (shortResolve.success) throw new Error("Failed: Resolution remarks shorter than 10 chars must fail");
  console.log("   -> ResolveComplaintSchema remarks length and evidence validation enforced");

  // Officer endpoint auth guards
  const unauthStart = await request(app).post("/api/v1/complaints/673d32840000000000000001/start-work").send({});
  const unauthResolve = await request(app).post("/api/v1/complaints/673d32840000000000000001/resolve").send({
    remarks: "Repaired underground water pipe and restored supply.",
  });
  if (unauthStart.status !== 401 || unauthResolve.status !== 401) {
    throw new Error("Failed: Unauthenticated officer workflow calls must be rejected with 401");
  }
  console.log("   -> Officer endpoints (start-work, resolve) protected with 401 guards\n");

  console.log(">>> ALL CORE DATA MODEL, COMPLAINT, ADMIN & OFFICER TESTS PASSED! <<<\n");
}

runComplaintTests().catch((err: unknown) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
