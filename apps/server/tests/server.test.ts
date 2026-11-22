import request from "supertest";
import { app } from "../src/app.js";

async function runTests(): Promise<void> {
  console.log("Running Phase 2 Server, Database, and Readiness Verification Tests...\n");

  // 1. Liveness Check /health
  const healthRes = await request(app).get("/health");
  console.log("GET /health:");
  console.log("  Status:", healthRes.status);
  console.log("  Body:", JSON.stringify(healthRes.body));
  if (healthRes.status !== 200 || !healthRes.body.success) {
    throw new Error("Liveness check /health failed");
  }

  // 2. Liveness Check /api/v1/health
  const apiHealthRes = await request(app).get("/api/v1/health");
  console.log("\nGET /api/v1/health:");
  console.log("  Status:", apiHealthRes.status);
  console.log("  Body:", JSON.stringify(apiHealthRes.body));
  if (apiHealthRes.status !== 200 || !apiHealthRes.body.success) {
    throw new Error("Liveness check /api/v1/health failed");
  }

  // 3. Readiness Check /ready (Checks server and database state)
  const readyRes = await request(app).get("/ready");
  console.log("\nGET /ready:");
  console.log("  Status:", readyRes.status);
  console.log("  Body:", JSON.stringify(readyRes.body));
  if (!readyRes.body.data || !readyRes.body.data.checks) {
    throw new Error("Readiness check response structure invalid");
  }

  // 4. 404 Not Found Handling with correlation ID
  const notFoundRes = await request(app).get("/api/v1/nonexistent");
  console.log("\nGET /api/v1/nonexistent (404 test):");
  console.log("  Status:", notFoundRes.status);
  console.log("  Body:", JSON.stringify(notFoundRes.body));
  if (notFoundRes.status !== 404 || notFoundRes.body.success !== false) {
    throw new Error("404 Not Found handling failed");
  }

  // 5. Correlation ID tracking verification
  const reqId = healthRes.headers["x-request-id"];
  if (!reqId) {
    throw new Error("X-Request-ID header missing from response");
  }
  console.log("\nCorrelation ID Header Verified: X-Request-ID =", reqId);

  console.log("\n>>> ALL PHASE 2 TESTS PASSED SUCCESSFULLY! <<<\n");
}

runTests().catch((err: unknown) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
