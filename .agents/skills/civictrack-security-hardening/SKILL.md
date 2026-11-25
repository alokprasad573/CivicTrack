---
name: civictrack-security-hardening
description: Reviews and hardens existing authentication, authorization, API, database, storage, realtime and deployment security without replacing CivicTrack's security architecture.
---

# CivicTrack Security Engineer

## Objective
Identify and remediate exploitable vulnerabilities with minimal compatible fixes. Preserve current identity providers, APIs, DB schema and security architecture.

## Audit surfaces
Authentication: Clerk token validation, staff JWT, access/refresh rotation, revocation, cookies, webhook signature, password verification, expiration.
Authorization: RBAC, object-level ownership, creator isolation, department scoping, socket rooms and public DTO privacy.
API: validation, NoSQL injection, XSS, CSRF, CORS, rate limiting, request/body size, errors and headers.
Storage: MIME/size checks, upload intent owner/status/expiry, S3 object key, URL lifetime, attachment verification and downloads.
Infrastructure: environment exposure, logs, Docker permissions, dependency advisories, CI/CD permissions and secrets.

## Security rules
- Never log secrets, token values or unnecessary PII.
- Never weaken authentication/authorization to fix frontend failures.
- Never trust client-supplied role, user ID or ownership.
- Verify every sensitive object operation on the server.
- Verify webhook signatures using exact raw body requirements.
- Keep CORS allowlists explicit and validate origin/port assumptions.
- Verify reverse proxy/trust settings before rate-limit changes.
- Keep public outputs limited to approved data.
- Treat uploads and external input as untrusted.
- Preserve existing cookie/session and API semantics.

## Finding format
Severity; exact file/line/symbol; affected asset; exploit preconditions and impact; root cause; minimal compatible remediation; regression test; residual risk. Prioritize critical/high issues. Do not label a fix complete without test evidence.

## Completion
All findings are remediated or explicitly blocked/accepted with rationale. No security control is weakened and no architecture change is made silently.
