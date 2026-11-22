import request from "supertest";
import { app } from "../src/app.js";
import {
  ComplaintPriority,
  ComplaintCategory,
  AnalyticsFilterSchema,
  LinkDuplicateSchema,
} from "@civictrack/contracts";
import { calculateDueAt, DEFAULT_SLA_HOURS } from "../src/modules/sla/sla.config.js";
import { SlaEscalationModel } from "../src/modules/sla/sla-escalation.model.js";
import { SlaService } from "../src/modules/sla/sla.service.js";

async function runAnalyticsSlaTests(): Promise<void> {
  console.log("Running Phase 10 Analytics, Duplicate Suggestions & SLA Escalation Tests...\n");

  // 1. Unauthenticated endpoints must return 401
  console.log("1. Testing unauthenticated endpoint protection:");
  const unauthAnalytics = await request(app).get("/api/v1/analytics/summary");
  console.log("   GET /api/v1/analytics/summary status:", unauthAnalytics.status);
  if (unauthAnalytics.status !== 401) {
    throw new Error("Failed: GET /api/v1/analytics/summary must return 401 UNAUTHORIZED");
  }

  const unauthScan = await request(app).post("/api/v1/sla/scan");
  console.log("   POST /api/v1/sla/scan status:", unauthScan.status);
  if (unauthScan.status !== 401) {
    throw new Error("Failed: POST /api/v1/sla/scan must return 401 UNAUTHORIZED");
  }

  const unauthDuplicates = await request(app).get("/api/v1/duplicates/507f1f77bcf86cd799439011/candidates");
  console.log("   GET /api/v1/duplicates/:id/candidates status:", unauthDuplicates.status);
  if (unauthDuplicates.status !== 401) {
    throw new Error("Failed: GET /api/v1/duplicates/:id/candidates must return 401 UNAUTHORIZED");
  }

  const unauthLink = await request(app).post("/api/v1/duplicates/507f1f77bcf86cd799439011/link").send({
    duplicateOfId: "507f1f77bcf86cd799439012",
  });
  console.log("   POST /api/v1/duplicates/:id/link status:", unauthLink.status);
  if (unauthLink.status !== 401) {
    throw new Error("Failed: POST /api/v1/duplicates/:id/link must return 401 UNAUTHORIZED");
  }
  console.log("   -> All Analytics, SLA, and Duplicate endpoints require authentication (401)\n");

  // 2. SLA Due Date Calculation Tests
  console.log("2. Testing SLA Due Date Calculations:");
  const baseDate = new Date("2026-11-21T10:00:00.000Z");

  const criticalDue = calculateDueAt(ComplaintPriority.CRITICAL, undefined, baseDate);
  const diffHoursCritical = (criticalDue.getTime() - baseDate.getTime()) / (3600 * 1000);
  console.log(`   CRITICAL priority duration: ${diffHoursCritical}h (expected ${DEFAULT_SLA_HOURS[ComplaintPriority.CRITICAL]}h)`);
  if (diffHoursCritical !== 12) {
    throw new Error(`CRITICAL SLA calculation incorrect: expected 12h, got ${diffHoursCritical}h`);
  }

  const highDue = calculateDueAt(ComplaintPriority.HIGH, undefined, baseDate);
  const diffHoursHigh = (highDue.getTime() - baseDate.getTime()) / (3600 * 1000);
  console.log(`   HIGH priority duration: ${diffHoursHigh}h (expected ${DEFAULT_SLA_HOURS[ComplaintPriority.HIGH]}h)`);
  if (diffHoursHigh !== 24) {
    throw new Error(`HIGH SLA calculation incorrect: expected 24h, got ${diffHoursHigh}h`);
  }

  const medDue = calculateDueAt(ComplaintPriority.MEDIUM, undefined, baseDate);
  const diffHoursMed = (medDue.getTime() - baseDate.getTime()) / (3600 * 1000);
  console.log(`   MEDIUM priority duration: ${diffHoursMed}h (expected ${DEFAULT_SLA_HOURS[ComplaintPriority.MEDIUM]}h)`);
  if (diffHoursMed !== 48) {
    throw new Error(`MEDIUM SLA calculation incorrect: expected 48h, got ${diffHoursMed}h`);
  }

  const lowDue = calculateDueAt(ComplaintPriority.LOW, undefined, baseDate);
  const diffHoursLow = (lowDue.getTime() - baseDate.getTime()) / (3600 * 1000);
  console.log(`   LOW priority duration: ${diffHoursLow}h (expected ${DEFAULT_SLA_HOURS[ComplaintPriority.LOW]}h)`);
  if (diffHoursLow !== 72) {
    throw new Error(`LOW SLA calculation incorrect: expected 72h, got ${diffHoursLow}h`);
  }
  console.log("   -> Deterministic SLA due date calculations verified\n");

  // 3. SlaEscalationModel Compound Unique Index Check
  console.log("3. Testing SlaEscalationModel compound uniqueness for idempotency:");
  const indexes = SlaEscalationModel.schema.indexes();
  const hasUniqueCompound = indexes.some(([fields, options]) => {
    return fields.complaintId === 1 && fields.dueAt === 1 && options?.unique === true;
  });
  if (!hasUniqueCompound) {
    throw new Error("Failed: SlaEscalationModel must enforce unique compound index on { complaintId: 1, dueAt: 1 }");
  }
  console.log("   -> SlaEscalationModel { complaintId: 1, dueAt: 1, unique: true } index verified\n");

  // 4. SLA Overdue Scan Execution (Offline fallback)
  console.log("4. Testing SLA Scan & Overdue Escalation:");
  const scanResult = await SlaService.scanAndEscalateOverdue();
  console.log("   Scan Result:", JSON.stringify(scanResult));
  if (typeof scanResult.scannedCount !== "number" || typeof scanResult.escalatedCount !== "number") {
    throw new Error("Scan result schema invalid");
  }
  console.log("   -> SLA overdue scanner executed successfully\n");

  // 5. Schema Validation for Analytics and Duplicate Linking
  console.log("5. Testing Zod Schemas:");
  const validFilter = AnalyticsFilterSchema.safeParse({
    startDate: "2026-11-01T00:00:00Z",
    endDate: "2026-11-21T23:59:59Z",
    departmentId: "507f1f77bcf86cd799439011",
  });
  if (!validFilter.success) {
    throw new Error(`Failed to parse valid analytics filter: ${JSON.stringify(validFilter.error)}`);
  }
  console.log("   -> Analytics filter schema validated successfully");

  const validLink = LinkDuplicateSchema.safeParse({
    duplicateOfId: "507f1f77bcf86cd799439011",
    remarks: "Visual confirmation of identical pothole location",
  });
  if (!validLink.success) {
    throw new Error(`Failed to parse link duplicate payload: ${JSON.stringify(validLink.error)}`);
  }
  console.log("   -> Link duplicate payload validated successfully\n");

  console.log("All Phase 10 Analytics, Duplicate Suggestions & SLA Escalation tests passed!\n");
}

runAnalyticsSlaTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
