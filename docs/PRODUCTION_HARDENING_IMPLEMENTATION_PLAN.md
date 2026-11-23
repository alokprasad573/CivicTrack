# CivicTrack Production Hardening Implementation Plan

## Goal

Bring the current CivicTrack working tree to a production-ready state by fixing the confirmed security, privacy, API-contract, workflow, realtime, configuration, navigation, analytics, and UI consistency issues found during the code review.

This is an implementation plan for Antigravity. It does not authorize replacing the current working tree or restoring deleted files. Preserve all existing uncommitted changes and build on the current tree.

## Validation findings added to this plan

An offline validation pass was run with database and cloud credentials unset. The server, Clerk webhook, complaint, maps, notification, analytics/SLA, security-hardening, and socket suites passed. The staff-auth suite exited after skipping its DB-backed cases. The storage suite passed its schema, ownership, and image-signature checks, then attempted a real S3 upload/delete and failed with sandbox `EACCES`. No S3 object was written. The full workspace typecheck had passed earlier.

The run exposed validation gaps that must be closed during implementation:

- Existing auth tests mostly prove unauthenticated requests get `401`; they do not exercise authenticated privilege escalation, role boundaries, session revocation, department scoping, or private-field exposure.
- Staff-auth tests silently count a missing database as a successful skip. CI needs a clearly separated unit suite and an integration suite that must run against an explicitly named, isolated test database before release.
- The maps suite treats a synthetic route as success even while `/maps/status` reports `isConfigured: false`. Production expectations must differ from development fallback behavior.
- The storage suite’s default command performs live S3 `PutObject` and `DeleteObject` operations. That is unsafe and cannot run reliably in an offline test job.
- In this environment the `tsx` CLI initially failed at `os.userInfo()` with `uv_os_get_passwd returned ENOMEM`; it required a temporary test-runner shim. Pin/document a supported Node version and make the standard test command work without machine-specific shims in CI.

## Instructions for Antigravity

1. Read this plan and inspect the current code before editing. The working tree already contains substantial uncommitted work, including new staff authentication files and modified citizen, admin, officer, map, and notification screens.
2. Do not run `git reset`, `git checkout`, `git clean`, or restore deleted documentation. Do not discard or rewrite unrelated user changes.
3. Implement one phase at a time, in order. Keep each phase reviewable and report changed files, behavior, and validation results before moving to the next phase.
4. Use the existing shared Zod contracts as the source of truth for request and response shapes. Update both server and client callers when changing an API contract.
5. Do not ship a mock, demo credential, test-token, or synthetic routing path in production behavior.
6. Add focused regression tests for each fix. Do not mark a phase complete from TypeScript success alone; include the relevant API/service/component tests and a production build/typecheck gate.
7. Keep production secrets out of source, generated bundles, logs, and documentation. Never rotate or modify a real external credential as part of implementation; provide a migration/configuration note instead.

## Phase 0 — Baseline and implementation map

### Work

- Inspect the current `git status` and treat all existing modifications/deletions as user-owned work.
- Map every API route to its controller, service, contract, and frontend caller before making edits.
- Record current scripts and test coverage. Run only non-destructive checks that are needed to establish a baseline.
- Confirm production deployment topology: whether browser requests use the Next.js rewrite or call a separate API origin, and whether MongoDB Atlas is a replica set.
- Declare the supported Node.js version in package metadata and CI; confirm `npm test` starts normally with that version and no local OS shim.
- Split tests into deterministic offline/unit checks and explicit database/cloud integration checks. Integration suites must require dedicated test resources, never reuse a developer or production `.env` implicitly.

### Exit criteria

- Antigravity reports the current baseline and confirms no existing work was reverted.
- Each planned route change has its caller and contract identified.

## Phase 1 — Release-blocking authentication and credential fixes (P0)

### 1. Remove self-service role escalation

**Files:** `apps/server/src/modules/users/user.routes.ts`, `apps/web/src/app/admin/analytics/page.tsx`, `apps/web/src/app/admin/officers/page.tsx`, and any caller of `/api/v1/users/me/switch-role`.

- Remove `/me/switch-role` from production routing, or make it unavailable unless an explicit development-only flag is enabled and `NODE_ENV !== "production"`.
- Remove production UI controls that call this endpoint. Do not use a request-body role as an authorization source.
- Keep role changes on the existing admin-only `/users/:id/role` path, with target-user and department validation.
- Add an integration regression test proving a citizen cannot promote itself to `ADMIN` or `OFFICER`, even with a valid Clerk session.
- Add authenticated role-matrix tests for citizen, officer, and admin against every role-changing route. A test must fail if the auth fixture cannot provision its identity; do not turn missing DB/auth setup into a passing skip.

### 2. Remove public/default staff credentials

**Files:** `apps/web/src/app/admin/login/page.tsx`, `apps/web/src/app/officer/login/page.tsx`, `apps/server/src/scripts/seed-staff.ts`, `apps/server/src/scripts/bootstrap-admin.ts`, and staff auth configuration.

- Remove prefilled passwords and visible testing credentials from both login screens.
- Remove fixed passwords and personal-account provisioning from `seed-staff.ts`. Seeding must be idempotent and must not reset an existing password every time it runs.
- Replace demo provisioning with an explicit, secure bootstrap flow (one-time secret supplied out of source, forced password setup, or an audited invite/reset mechanism).
- Repair or deprecate `bootstrap-admin.ts`: it currently creates/promotes an account without establishing a usable staff password/session identity. The chosen flow must work with the current staff JWT login and must not silently create a conflicting Clerk/email identity.
- Add deployment documentation requiring rotation of any credentials that may already have been exposed.

### 3. Make auth secrets mandatory in production

**Files:** `apps/server/src/config/env.ts`, `apps/server/src/modules/staff-auth/jwt.service.ts`, and deployment environment docs.

- Remove predictable production fallbacks for `STAFF_JWT_ACCESS_SECRET` and `STAFF_JWT_REFRESH_SECRET`.
- Require independent, high-entropy secrets when `NODE_ENV=production`; reject missing, placeholder, weak, or identical secrets at startup.
- Set an explicit `NODE_ENV` in deployment rather than silently defaulting a production process to development behavior.
- Add environment validation tests for missing and placeholder production secrets.

### 4. Remove the Socket.IO test-token production bypass

**File:** `apps/server/src/socket.ts`.

- Delete `test-token-*` authentication in production. Prefer removing it from runtime auth entirely and using a test-only injected authenticator in tests.
- If a development-only shortcut must remain, gate it on both test/development mode and an explicit opt-in flag; reject it in production regardless of token contents.
- Add a socket auth regression test showing `test-token-<known user id>` is rejected in production mode and cannot join personal, department, or complaint rooms.
- Exercise the actual Socket.IO handshake middleware, not only `authorizeRoomJoin`, for test-token rejection in production mode.

## Phase 2 — Authorization and data privacy (P1)

### 5. Restrict the public nearby-complaints response

**Files:** `apps/server/src/modules/complaints/complaint.routes.ts`, `complaint.controller.ts`, `complaint-query.service.ts`, and a shared public map response contract.

- Keep the endpoint public only if public map discovery is a product requirement.
- Return an explicit allowlist DTO with only public map fields (for example: public reference, category/status, approximate or approved location, and timestamps).
- Do not populate citizen name/email. Do not return `citizenId`, internal assignment data, complaint history, evidence object keys, or signed S3 URLs from the public endpoint.
- Keep evidence viewing behind the existing authenticated, object-authorized URL endpoint.
- Add an anonymous API test that asserts the response contains no personal identifiers, internal fields, object keys, or signed URLs.
- Seed a complaint with populated citizen details and evidence in the isolated test database so this test verifies a non-empty response rather than passing against an empty offline result.

### 6. Enforce directory and department scopes

**Files:** `apps/server/src/modules/users/user.routes.ts`, `user.service.ts`, `apps/server/src/modules/departments/department.routes.ts`, and admin complaint detail callers.

- Restrict `/users` to admins unless there is a documented officer use case. If officers need it, constrain them to their own department in the database query.
- Parse and apply `departmentId`; do not accept it as a frontend-only filter.
- Select and serialize only fields required by the screen. Never expose Clerk IDs, password hashes, or unrelated account properties in a staff directory response.
- Restrict `GET /departments/:id/officers` to the roles that need it and enforce the officer’s department scope if officers may call it.
- Update the admin complaint detail page to use the scoped officers route or the corrected filtered users endpoint.
- Add tests proving citizens are denied, officers see only authorized staff, and an admin can query the intended roster.
- Include at least one non-empty cross-department fixture; empty database responses do not validate scoping.

### 7. Enforce object-level scope on duplicate candidate discovery

**Files:** `apps/server/src/modules/duplicate-detection/duplicate-detection.controller.ts`, `duplicate-detection.service.ts`, and routes.

- Require admin for candidate discovery, or verify the target complaint belongs to the officer’s department before returning candidate data.
- Do not rely only on “not a citizen” role checks.
- Add cross-department access tests for both candidate discovery and linking.

### 8. Revoke access immediately on logout and role changes

**Files:** `apps/server/src/modules/identity/clerk.middleware.ts`, `apps/server/src/modules/staff-auth/staff-auth.service.ts`, `staff-session.model.ts`, `staff-auth.controller.ts`.

- Validate the access token’s `sessionId` against a non-revoked, unexpired staff session (or implement an equivalent revocation mechanism).
- Ensure refresh rotation is atomic so simultaneous refresh requests cannot both rotate the same refresh token successfully.
- Ensure logout revokes the active session and invalidates its access token immediately.
- Ensure changing/deactivating a staff role/account revokes existing sessions.
- Add tests for logout invalidation, refresh-token reuse, concurrent refresh, deactivation, and role change.
- Run these as required DB-backed integration tests in CI; a missing test database must fail this integration job instead of being reported as a pass.

### 9. Add CSRF/origin protection for cookie-authenticated staff writes

**Files:** `apps/server/src/app.ts`, staff auth cookie configuration, and mutation routes.

- Keep `HttpOnly`, `Secure` in production, and an appropriate `SameSite` policy.
- Validate `Origin`/`Referer` or use a CSRF token strategy for staff cookie-authenticated state-changing requests, while keeping webhook signature verification and legitimate same-origin Next.js rewrites working.
- Add tests for allowed app origin and rejected cross-origin form submissions.

## Phase 3 — Repair API workflows and contract mismatches (P1)

### 10. Make officer resolution uploads conform to the shared storage contract

**Files:** `packages/contracts/src/storage.ts`, `apps/web/src/app/officer/complaints/[id]/page.tsx`, `apps/server/src/modules/storage/storage.controller.ts`, `storage.service.ts`, `s3.service.ts`, `upload-intent.model.ts`, and resolution workflow.

- The client must send required `filename`, `contentType`, and `size` fields.
- The client must read the server’s `data.uploads` response and consume the returned `objectKey`, URL, method, and headers.
- Before attaching a presigned upload, verify that the upload intent exists, belongs to the authenticated user, is pending/unexpired, and matches actual S3 object size/content type (use S3 object metadata/head validation as appropriate).
- Do not accept arbitrary evidence keys or client-claimed MIME/size as proof of upload validity.
- Preserve the direct multipart citizen submission path and make its ownership/cleanup behavior explicit.
- Add an end-to-end regression test for valid officer proof upload, invalid MIME, oversize upload, another user’s key, expired intent, and upload intent reuse.
- Keep default storage tests network-free by mocking the S3 adapter. Move real S3 roundtrips to a separate opt-in integration command guarded by `CIVICTRACK_S3_INTEGRATION_TESTS=true` and explicit dedicated test bucket configuration.
- The live S3 integration test must use a unique test prefix, refuse production bucket/account configuration, and delete only the object it created in a `finally` block. Never run it as part of the default `npm test` suite.

### 11. Align duplicate candidate and link contracts end to end

**Files:** `packages/contracts/src/duplicate-detection.ts`, `apps/server/src/modules/duplicate-detection/*`, `apps/web/src/app/admin/page.tsx`, and OpenAPI.

- Use one candidate shape consistently: `complaintId`, `similarityScore`, `reasons`, and the declared metadata.
- Update UI keys, score display, signal chips, and link action to use those fields; remove undeclared `candidate._id`, `score`, `signals`, and `textSimilarity` assumptions or add them deliberately to the contract/service.
- Send `duplicateOfId` and `remarks` as required by `LinkDuplicateSchema`.
- Validate complaint IDs and disallow self-linking, cycles, and relinking rules as product policy requires.
- Add API/component tests for empty results, candidate rendering, valid link, invalid payload, self-link, and unauthorized link.

### 12. Make the officer queue scope real

**Files:** `apps/server/src/modules/complaints/complaint.controller.ts`, `complaint-query.service.ts`, and `apps/web/src/app/officer/page.tsx`.

- Parse `assignedToMe` as a boolean and pass it to the service.
- For “ME”, constrain to `assignedOfficerId = current user`; for “DEPARTMENT”, constrain to the officer’s department. Never let a supplied query override the authenticated identity.
- Add service/API tests with assigned, unassigned, same-department, and cross-department complaints.

### 13. Make API docs derive from real schemas or update them comprehensively

**Files:** `apps/server/src/docs/openapi.ts`, `packages/contracts/src/*`, and route documentation.

- Correct nearby parameter names and requiredness, enum values, complaint request/evidence fields, upload-intent fields and result shape, and duplicate link body.
- Document both citizen Clerk auth and staff cookie/JWT auth accurately; describe webhooks separately.
- Add a consistency check or test that catches schema/docs drift for the known endpoints.

## Phase 4 — Reliability and production behavior (P1/P2)

### 14. Fail clearly when production dependencies are missing

**Files:** `apps/server/src/config/env.ts`, `config/database.ts`, `config/s3.ts`, `config/maps.ts`, `server.ts`, and deployment docs.

- Require production-critical DB/auth/S3 configuration at startup. Fail fast on missing placeholders instead of silently running with dummy S3 credentials or predictable defaults.
- Support the AWS default credential provider chain/IAM roles where deployed; do not force dummy static credentials when instance credentials are intended.
- Keep optional map integration explicit: report routing as unavailable rather than fabricating a real route.
- Return service-unavailable responses for DB-dependent operations when production DB is disconnected; do not make outages look like valid empty complaint lists or zeroed analytics.
- Confirm health and readiness semantics against the deployment probe configuration.
- Add configuration tests for production and development modes.

### 15. Remove synthetic turn-by-turn routing from production

**Files:** `apps/server/src/modules/maps/ola-maps.adapter.ts`, maps controller/service, navigation client and officer UI.

- In production, return a clear `ROUTING_UNAVAILABLE` response when a real route cannot be fetched.
- If a straight-line estimate is retained for development, label it as an estimate and never present synthetic turns as road navigation.
- Make the officer UI distinguish a real route from an unavailable/estimated route and offer a safe retry/alternate navigation action.
- Add tests for provider success, provider failure, missing key, and production no-fake-route behavior.
- Change the existing maps test so missing configuration plus `NODE_ENV=production` expects an unavailable response and never accepts generated synthetic turns. Keep a separate development-mode test if the fallback remains for local demos.

### 16. Run SLA scans automatically and safely

**Files:** `apps/server/src/modules/sla/*`, server worker/scheduler integration, deployment configuration.

- Trigger scans on a reliable schedule or through a managed external scheduler; the current admin-only manual endpoint must not be the sole production mechanism.
- Keep scans idempotent across concurrent instances using the existing unique `{ complaintId, dueAt }` index and handle duplicate-key races without failing the whole scan.
- Use an appropriate SLA breach notification type rather than reusing `COMPLAINT_IN_PROGRESS`.
- Add scheduler/scan idempotency and notification tests plus operational logging/metrics.

### 17. Correct analytics filter semantics

**Files:** `apps/server/src/modules/analytics/analytics.service.ts`, controller, and analytics UI.

- Apply department/date filters consistently to daily trend and all other aggregates, or label the trend explicitly as global/last-14-days and separate it from filtered metrics.
- Validate invalid `departmentId` rather than silently ignoring it; enforce officer department scope on the server.
- Add tests proving every displayed metric uses the documented filter semantics.
- Use non-empty fixtures across multiple departments and dates; do not validate filtering with the offline empty-summary fallback.

### 18. Make search safe and bounded

**Files:** `apps/server/src/modules/users/user.service.ts`, `complaint-query.service.ts`, and query schemas.

- Bound search string length and escape literal regex characters, or use an indexed text-search strategy.
- Validate enums and pagination/sort input at the API boundary; allow only an explicit sort-field allowlist.
- Add tests for regex metacharacters, pathological patterns, long input, and normal search.

### 19. Production-scale rate limiting and workflow consistency

**Files:** `apps/server/src/common/middleware/rate-limit.middleware.ts`, complaint workflow services, deployment configuration.

- Use a shared rate-limit store for multi-instance production deployments; the in-memory limiter is per process.
- Apply upload-specific request/body limits to direct multipart complaint submission, not only `/storage` routes.
- Review multi-document status/history/notification mutations for partial-write failure. Where MongoDB deployment supports transactions, persist core state and audit history atomically; keep notification delivery retryable/outbox-backed.
- Add tests for oversized multipart requests, distributed limiter configuration, and partial workflow failure behavior.

## Phase 5 — Realtime and UI/UX consistency (P2)

### 20. Make socket event subscriptions reliable

**Files:** `apps/web/src/hooks/use-socket.ts`, `use-notifications.ts`, socket context/provider if introduced.

- Store event subscriptions until the socket exists, or expose a stable shared socket provider that replays subscriptions after connect/reconnect.
- Refresh/reconnect citizen sockets when Clerk auth changes and ensure staff cookie auth remains supported.
- Make notification updates idempotent so reconnect/replay does not double-increment unread counts.
- Add tests for listeners registered before connect, reconnection, auth changes, and duplicate events.

### 21. Apply one theme system across all portals

**Files:** `apps/web/src/components/theme/*`, `globals.css`, all three layout shells, login screens, dashboards, details, dialogs, notifications, and map controls.

- Put the theme toggle in a shared visible location across citizen/admin/officer portals and auth screens where appropriate.
- Replace hard-coded light-only surface/text/border classes with existing design tokens and add deliberate dark variants only where a token cannot express the state.
- Initialize theme before first paint from stored preference/system preference to prevent a dark/light flash.
- Verify contrast, focus rings, disabled/loading/error states, overlays, maps, Clerk controls, and mobile navigation in both themes.
- Add visual checks/screenshots for key screens in light and dark modes.

## Phase 6 — Final regression and release gate

### Required validation

- Run workspace typecheck and production build.
- Run all deterministic server tests without network access; run required DB-backed integration tests against a dedicated test database.
- Run cloud integration tests only in a separately approved/configured job using isolated resources. The default suite must never upload/delete objects in a live application bucket.
- Ensure missing DB configuration is visibly reported as “integration tests not run” and fails the release gate when those tests are required; it must not look like a green test run.
- Run new authenticated security/API tests for role escalation, JWT session revocation, socket handshake test-token rejection, nearby response privacy, staff/department scopes, duplicate authorization, and officer assignment scope.
- Run frontend lint and any UI/component checks available.
- Exercise a staging smoke flow: citizen login/report/map/track/feedback; admin triage/assign/analytics; officer assigned queue/start/resolve/upload proof; logout/revocation; notifications and reconnect.
- Verify no known test credentials, test-token auth, mock route instructions, dummy production configuration, or exposed evidence URLs remain in a production build/API response.
- Review the final `git diff` and confirm no user-owned unrelated modifications or deleted files were restored/discarded.

## Suggested merge order

1. Phase 1 release blockers.
2. Phase 2 authorization/privacy.
3. Phase 3 broken workflows/contracts.
4. Phase 4 production reliability and operations.
5. Phase 5 realtime and visual consistency.
6. Phase 6 regression and release gate.

Do not deploy until Phases 1–4 and the relevant Phase 6 checks pass. Theme polish can proceed after security and workflow fixes, but should still be completed before calling the application production-ready.
