import request from "supertest";
import { Webhook } from "svix";

// Svix requires a `whsec_` secret whose suffix is valid Base64. Set it before
// importing the app so the webhook controller reads the same test secret.
const TEST_WEBHOOK_SECRET =
  "whsec_dGVzdF9jaXZpY3RyYWNrX3dlYmhvb2tfc2VjcmV0XzMyYnl0ZXMhIQ==";
process.env.CLERK_WEBHOOK_SIGNING_SECRET = TEST_WEBHOOK_SECRET;

async function runAuthTests(): Promise<void> {
  const [{ app }, { env }] = await Promise.all([
    import("../src/app.js"),
    import("../src/config/env.js"),
  ]);

  console.log("Running Phase 3 Clerk Authentication & Webhook Verification Tests...\n");

  // 1. Unauthenticated request to /api/v1/users/me must return 401
  const unauthRes = await request(app).get("/api/v1/users/me");
  console.log("1. GET /api/v1/users/me (unauthenticated):");
  console.log("   Status:", unauthRes.status);
  console.log("   Body:", JSON.stringify(unauthRes.body));
  if (unauthRes.status !== 401 || unauthRes.body.error?.code !== "UNAUTHORIZED") {
    throw new Error("Failed: unauthenticated /users/me must return 401 UNAUTHORIZED");
  }
  console.log("   -> Correctly rejected with 401 UNAUTHORIZED\n");

  // 2. Unauthenticated request to admin endpoint /api/v1/users must return 401
  const adminUnauthRes = await request(app).get("/api/v1/users");
  console.log("2. GET /api/v1/users (unauthenticated admin endpoint):");
  console.log("   Status:", adminUnauthRes.status);
  console.log("   Body:", JSON.stringify(adminUnauthRes.body));
  if (adminUnauthRes.status !== 401) {
    throw new Error("Failed: unauthenticated /users must return 401 UNAUTHORIZED");
  }
  console.log("   -> Correctly rejected with 401 UNAUTHORIZED\n");

  // 3. Webhook request with missing Svix headers must return 400
  const missingHeadersRes = await request(app)
    .post("/api/v1/webhooks/clerk")
    .send({ type: "user.created", data: { id: "test_user_123" } });
  console.log("3. POST /api/v1/webhooks/clerk (missing Svix headers):");
  console.log("   Status:", missingHeadersRes.status);
  console.log("   Body:", JSON.stringify(missingHeadersRes.body));
  if (missingHeadersRes.status !== 400) {
    throw new Error("Failed: webhook without Svix headers must return 400 VALIDATION_ERROR");
  }
  console.log("   -> Correctly rejected with 400 VALIDATION_ERROR\n");

  // 4. Webhook request with forged/invalid signature must return 400
  const forgedRes = await request(app)
    .post("/api/v1/webhooks/clerk")
    .set("svix-id", "msg_test_id_123")
    .set("svix-timestamp", Math.floor(Date.now() / 1000).toString())
    .set("svix-signature", "v1,forged_invalid_signature_abc123")
    .send({ type: "user.created", data: { id: "test_user_123" } });
  console.log("4. POST /api/v1/webhooks/clerk (forged signature):");
  console.log("   Status:", forgedRes.status);
  console.log("   Body:", JSON.stringify(forgedRes.body));
  if (forgedRes.status !== 400) {
    throw new Error("Failed: webhook with forged signature must return 400 VALIDATION_ERROR");
  }
  console.log("   -> Correctly rejected forged signature\n");

  // 5. Webhook request with valid Svix signature
  const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET!;
  const timestamp = Math.floor(Date.now() / 1000);
  const msgId = `msg_${Date.now()}`;
  const payload = JSON.stringify({
    type: "user.created",
    data: {
      id: "user_clerk_test_999",
      email_addresses: [{ id: "email_1", email_address: "citizen.test@civictrack.org" }],
      primary_email_address_id: "email_1",
      first_name: "Citizen",
      last_name: "Tester",
    },
  });

  // Generate valid cryptographic Svix signature
  const wh = new Webhook(signingSecret);
  const validSignature = wh.sign(msgId, new Date(timestamp * 1000), payload);

  const validWebhookRes = await request(app)
    .post("/api/v1/webhooks/clerk")
    .set("svix-id", msgId)
    .set("svix-timestamp", timestamp.toString())
    .set("svix-signature", validSignature)
    .set("Content-Type", "application/json")
    .send(payload);

  console.log("5. POST /api/v1/webhooks/clerk (valid cryptographically signed webhook):");
  console.log("   Status:", validWebhookRes.status);
  console.log("   Body:", JSON.stringify(validWebhookRes.body));
  if (validWebhookRes.status !== 200 || !validWebhookRes.body.success) {
    throw new Error("Failed: valid cryptographically signed webhook must be accepted with 200 OK");
  }
  console.log("   -> Valid webhook signature accepted and processed successfully!\n");

  console.log(">>> ALL PHASE 3 AUTHENTICATION & WEBHOOK TESTS PASSED! <<<\n");
}

runAuthTests().catch((err: unknown) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
