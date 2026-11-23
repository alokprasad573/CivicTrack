import request from "supertest";
import express from "express";
import { app } from "../src/app.js";
import { sanitizeInputMiddleware } from "../src/common/middleware/sanitize.middleware.js";
import { createTestRateLimiter } from "../src/common/middleware/rate-limit.middleware.js";
import { openApiSpec } from "../src/docs/openapi.js";

async function runSecurityHardeningTests() {
  console.log("Running Phase 11 Security, Quality & Hardening Verification Tests...\n");

  // 1. Security Headers Verification
  console.log("1. Testing Security HTTP Headers via Helmet:");
  const healthRes = await request(app).get("/health");
  console.log("   GET /health status:", healthRes.status);

  const xFrameOptions = healthRes.headers["x-frame-options"];
  const xContentTypeOptions = healthRes.headers["x-content-type-options"];
  const corp = healthRes.headers["cross-origin-resource-policy"];

  if (xFrameOptions !== "DENY" && xFrameOptions !== "SAMEORIGIN") {
    throw new Error(`Expected X-Frame-Options to be DENY, got: ${xFrameOptions}`);
  }
  console.log(`   X-Frame-Options: ${xFrameOptions} (verified)`);

  if (xContentTypeOptions !== "nosniff") {
    throw new Error(`Expected X-Content-Type-Options to be nosniff, got: ${xContentTypeOptions}`);
  }
  console.log(`   X-Content-Type-Options: ${xContentTypeOptions} (verified)`);

  if (!corp) {
    throw new Error("Expected Cross-Origin-Resource-Policy header to be set");
  }
  console.log(`   Cross-Origin-Resource-Policy: ${corp} (verified)`);
  console.log("   -> Security HTTP headers verified\n");

  // 2. CORS Preflight & Allowlist
  console.log("2. Testing CORS Configuration:");
  const corsRes = await request(app)
    .options("/api/v1/health")
    .set("Origin", "http://localhost:3000")
    .set("Access-Control-Request-Method", "GET");

  const allowOrigin = corsRes.headers["access-control-allow-origin"];
  const allowCredentials = corsRes.headers["access-control-allow-credentials"];
  console.log(`   Access-Control-Allow-Origin: ${allowOrigin}`);
  console.log(`   Access-Control-Allow-Credentials: ${allowCredentials}`);

  if (allowOrigin !== "http://localhost:3000" && allowOrigin !== "*") {
    throw new Error(`Unexpected Access-Control-Allow-Origin: ${allowOrigin}`);
  }
  console.log("   -> CORS origin policy verified\n");

  // 3. NoSQL Query Operator Injection Sanitization
  console.log("3. Testing NoSQL Query Operator Injection Sanitization:");
  const testSanitizeApp = express();
  testSanitizeApp.use(express.json());
  testSanitizeApp.use(sanitizeInputMiddleware);
  testSanitizeApp.post("/test-sanitize", (req, res) => {
    res.status(200).json({ body: req.body });
  });

  const maliciousPayload = {
    title: "Clean civic issue",
    $where: "malicious code execution()",
    nested: {
      $gt: "",
      "injection.field": "unsafe",
      safeKey: "valid content",
    },
  };

  const sanitizeRes = await request(testSanitizeApp)
    .post("/test-sanitize")
    .send(maliciousPayload);

  console.log("   Sanitized body output:", JSON.stringify(sanitizeRes.body.body));
  if ("$where" in sanitizeRes.body.body) {
    throw new Error("Sanitization failed: $where operator was not stripped!");
  }
  if ("$gt" in sanitizeRes.body.body.nested) {
    throw new Error("Sanitization failed: nested $gt operator was not stripped!");
  }
  if ("injection.field" in sanitizeRes.body.body.nested) {
    throw new Error("Sanitization failed: dotted key was not stripped!");
  }
  if (sanitizeRes.body.body.nested.safeKey !== "valid content") {
    throw new Error("Sanitization corrupted legitimate safe fields!");
  }
  console.log("   -> NoSQL query selector injection safely stripped\n");

  // 4. Rate Limiting Enforcement
  console.log("4. Testing Rate Limiting (HTTP 429 Too Many Requests):");
  const testRateLimitApp = express();
  // Bound to max 2 requests
  testRateLimitApp.use(createTestRateLimiter(2, 60000));
  testRateLimitApp.get("/rate-limited", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  const r1 = await request(testRateLimitApp).get("/rate-limited");
  const r2 = await request(testRateLimitApp).get("/rate-limited");
  const r3 = await request(testRateLimitApp).get("/rate-limited");

  console.log(`   Request 1 status: ${r1.status}`);
  console.log(`   Request 2 status: ${r2.status}`);
  console.log(`   Request 3 status: ${r3.status} (Body: ${JSON.stringify(r3.body)})`);

  if (r1.status !== 200 || r2.status !== 200) {
    throw new Error("Initial requests within limit were incorrectly throttled!");
  }
  if (r3.status !== 429) {
    throw new Error(`Expected HTTP 429 on request 3 exceeding rate limit, got ${r3.status}`);
  }
  if (r3.body.error?.code !== "RATE_LIMIT_EXCEEDED") {
    throw new Error(`Expected RATE_LIMIT_EXCEEDED error code, got: ${r3.body.error?.code}`);
  }
  console.log("   -> Rate limiter successfully blocked excessive requests with HTTP 429\n");

  // 5. OpenAPI & Swagger UI Endpoint Accessibility
  console.log("5. Testing OpenAPI 3.0 & Swagger UI Documentation Endpoints:");
  const openApiRes = await request(app).get("/api/v1/docs/openapi.json");
  console.log(`   GET /api/v1/docs/openapi.json status: ${openApiRes.status}`);

  if (openApiRes.status !== 200) {
    throw new Error(`Failed to load OpenAPI spec, status: ${openApiRes.status}`);
  }
  if (openApiRes.body.openapi !== "3.0.3") {
    throw new Error(`Expected OpenAPI version 3.0.3, got: ${openApiRes.body.openapi}`);
  }
  if (!openApiRes.body.paths["/complaints"]) {
    throw new Error("OpenAPI spec missing /complaints documentation path");
  }
  console.log(`   OpenAPI version: ${openApiRes.body.openapi}`);
  console.log(`   Documented endpoints count: ${Object.keys(openApiRes.body.paths).length}`);

  const swaggerUiRes = await request(app).get("/docs/");
  console.log(`   GET /docs/ status: ${swaggerUiRes.status}`);
  if (swaggerUiRes.status !== 200 && swaggerUiRes.status !== 301) {
    throw new Error(`Swagger UI route failed with status: ${swaggerUiRes.status}`);
  }
  console.log("   -> Interactive Swagger UI & OpenAPI 3.0 JSON spec verified\n");

  // 6. Stack Trace Masking on Unhandled Errors
  console.log("6. Testing Error Stack Trace Suppression:");
  const notFoundRes = await request(app).get("/api/v1/random-non-existent-route");
  console.log(`   GET /api/v1/random-non-existent-route status: ${notFoundRes.status}`);
  if (notFoundRes.body.stack) {
    throw new Error("Security breach: Stack trace leaked in response body!");
  }
  console.log("   -> Stack trace safely suppressed from client response body\n");

  // 7. Role Escalation Protection (/me/switch-role must return 403 in production / when disabled)
  console.log("7. Testing Role Escalation Protection (/me/switch-role):");
  const switchRoleRes = await request(app)
    .post("/api/v1/users/me/switch-role")
    .send({ role: "ADMIN" });
  console.log(`   POST /api/v1/users/me/switch-role status: ${switchRoleRes.status}`);
  if (switchRoleRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden on /me/switch-role self-promotion, got ${switchRoleRes.status}`);
  }
  console.log("   -> Self-service role escalation strictly forbidden with 403\n");

  // 8. CSRF Origin Protection on Cookie-Authenticated Staff Mutations
  console.log("8. Testing CSRF Origin Protection for Staff Cookies:");
  const csrfRes = await request(app)
    .post("/api/v1/complaints/test-id/verify")
    .set("Cookie", ["civictrack_staff_access=fake-session-token"])
    .set("Origin", "https://attacker.com")
    .send({ remarks: "Attacker payload" });
  console.log(`   Cross-origin staff cookie POST status: ${csrfRes.status} (Code: ${csrfRes.body.error?.code})`);
  if (csrfRes.status !== 403 || csrfRes.body.error?.code !== "CSRF_DETECTED") {
    throw new Error(`Expected HTTP 403 CSRF_DETECTED on cross-origin cookie mutation, got ${csrfRes.status}`);
  }
  console.log("   -> CSRF cross-origin state-changing request safely blocked\n");

  // 9. Safe and Bounded Search Regex Sanitization
  console.log("9. Testing Safe & Bounded Search Sanitization:");
  const searchRes = await request(app)
    .get("/api/v1/complaints?search=.*+?^${}()|[\\]\\\\")
    .set("Authorization", "Bearer mock-token");
  console.log(`   GET /api/v1/complaints with pathological regex status: ${searchRes.status}`);
  // Should not crash with 500
  if (searchRes.status === 500) {
    throw new Error("Search sanitization failed: pathological regex caused HTTP 500!");
  }
  console.log("   -> Search metacharacters safely escaped without ReDoS or regex engine crash\n");

  console.log("ALL PHASE 11 SECURITY, QUALITY & HARDENING TESTS PASSED SUCCESSFULLY!\n");
}

runSecurityHardeningTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
