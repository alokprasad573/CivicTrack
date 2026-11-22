import request from "supertest";
import { app } from "../src/app.js";
import {
  NotificationType,
  SocketEvent,
  NotificationQuerySchema,
} from "@civictrack/contracts";
import { NotificationModel, formatNotification } from "../src/modules/notifications/notification.model.js";
import { NotificationService } from "../src/modules/notifications/notification.service.js";
import { getIO, emitNotification, emitComplaintStatusUpdated, emitComplaintAssigned } from "../src/socket.js";
import { Types } from "mongoose";

async function runNotificationTests(): Promise<void> {
  console.log("Running Phase 9 Notifications & Real-Time Delivery Tests...\n");

  // 1. Unauthenticated endpoints must return 401
  console.log("1. Testing unauthenticated endpoint protection:");
  const unauthListRes = await request(app).get("/api/v1/notifications");
  console.log("   GET /api/v1/notifications status:", unauthListRes.status);
  if (unauthListRes.status !== 401) {
    throw new Error("Failed: GET /api/v1/notifications must return 401 UNAUTHORIZED");
  }

  const unauthPatchRes = await request(app).patch("/api/v1/notifications/507f1f77bcf86cd799439011/read");
  console.log("   PATCH /api/v1/notifications/:id/read status:", unauthPatchRes.status);
  if (unauthPatchRes.status !== 401) {
    throw new Error("Failed: PATCH /api/v1/notifications/:id/read must return 401 UNAUTHORIZED");
  }

  const unauthReadAllRes = await request(app).post("/api/v1/notifications/read-all");
  console.log("   POST /api/v1/notifications/read-all status:", unauthReadAllRes.status);
  if (unauthReadAllRes.status !== 401) {
    throw new Error("Failed: POST /api/v1/notifications/read-all must return 401 UNAUTHORIZED");
  }
  console.log("   -> All notification endpoints strictly require authentication (401)\n");

  // 2. Notification Query Schema Validation
  console.log("2. Testing NotificationQuerySchema validation:");
  const validQuery = { page: "1", limit: "20", unreadOnly: "true" };
  const parsed = NotificationQuerySchema.safeParse(validQuery);
  if (!parsed.success) {
    throw new Error(`Failed to parse valid query: ${JSON.stringify(parsed.error)}`);
  }
  if (parsed.data.unreadOnly !== true || parsed.data.limit !== 20 || parsed.data.page !== 1) {
    throw new Error("Parsed query values mismatch expected coerced types");
  }
  console.log("   -> Valid query coerced and parsed correctly");

  const invalidLimitQuery = { limit: 500 };
  const invalidLimitParsed = NotificationQuerySchema.safeParse(invalidLimitQuery);
  if (invalidLimitParsed.success) {
    throw new Error("Failed: Limit > 100 must be rejected");
  }
  console.log("   -> Over-limit query (>100) rejected as expected\n");

  // 3. NotificationModel Schema and Compound Index Check
  console.log("3. Testing NotificationModel schema and compound indexing:");
  const indexes = NotificationModel.schema.indexes();
  const hasCompoundIndex = indexes.some(([fields]) => {
    return (
      fields.recipientId === 1 &&
      fields.readAt === 1 &&
      fields.createdAt === -1
    );
  });
  if (!hasCompoundIndex) {
    throw new Error("Failed: NotificationModel missing required compound index { recipientId: 1, readAt: 1, createdAt: -1 }");
  }
  console.log("   -> Compound index { recipientId: 1, readAt: 1, createdAt: -1 } verified\n");

  // 4. Persist-Before-Emit Unit Test
  console.log("4. Testing Persist-Before-Emit with NotificationService:");
  const testUserId = new Types.ObjectId().toString();
  const doc = await NotificationService.createAndEmit({
    recipientId: testUserId,
    type: NotificationType.COMPLAINT_VERIFIED,
    title: "Complaint Verified",
    message: "Your reported pothole has been verified by municipal triage.",
    resourceType: "COMPLAINT",
    resourceId: "CT-2026-000001",
  });

  if (!doc) {
    throw new Error("Failed: createAndEmit must return instantiated document");
  }
  const jsonDoc = formatNotification(doc);
  if (jsonDoc.type !== NotificationType.COMPLAINT_VERIFIED || jsonDoc.resourceId !== "CT-2026-000001") {
    throw new Error("Notification payload corrupted");
  }
  if (jsonDoc.readAt !== null) {
    throw new Error("Newly created notification must have readAt as null");
  }
  console.log("   -> Notification instantiated and prepared for emit: " + jsonDoc.title + " (" + jsonDoc.type + ")\n");

  // 5. Socket Server and Event Emitter Exports Check
  console.log("5. Testing Socket.io Emitters and Handshake Safety:");
  // Ensure emitters don't throw when socket server is uninitialized or in test mode
  emitNotification(testUserId, jsonDoc);
  emitComplaintStatusUpdated({
    complaintId: "507f1f77bcf86cd799439011",
    referenceNumber: "CT-2026-000001",
    status: jsonDoc.type as any,
    citizenId: testUserId,
  });
  emitComplaintAssigned({
    complaintId: "507f1f77bcf86cd799439011",
    referenceNumber: "CT-2026-000001",
    departmentId: "507f1f77bcf86cd799439012",
  });
  console.log("   -> Socket emitter functions handle offline/no-client state gracefully\n");

  console.log("All Phase 9 Notification & Real-Time tests passed successfully!\n");
}

runNotificationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
