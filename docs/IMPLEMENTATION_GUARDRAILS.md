# CivicTrack — Implementation Guardrails

**Phase:** Phase 1 (Architecture Guardian Validation & Sign-Off Baseline)  
**Branch:** `feature/civictrack-production-modernization`  
**Governing Rules:** `.agents/AGENTS.md` and `.agents/skills/civictrack-architecture-guard/SKILL.md`

---

## 1. Non-Negotiable Architectural Invariants

All implementation work in Phases 3–10 MUST preserve:
1. **Monorepo & Tech Stack:** npm workspaces (`packages/*`, `apps/*`), Node.js `>=24.0.0`, `apps/web` (Next.js 16 App Router, React 19, TypeScript 5.x, Tailwind CSS 3.4), `apps/server` (Express 4.x, TypeScript, Mongoose 8.x), `packages/contracts` (`zod`). Zero new production dependencies and zero major framework replacements without explicit owner approval.
2. **Shared Contract Boundary (`packages/contracts/src/`):** Single source of truth for Zod schemas, enums (`UserRole`, `ComplaintCategory`, `ComplaintStatus`, `ComplaintPriority`), `ALLOWED_STATUS_TRANSITIONS`, `SocketEvent`, and response envelopes (`ApiResponse`, `PaginatedResponse`, `ApiErrorResponse`).
3. **Database Collections & Document Shapes:** Preserve all 11 Mongoose models, collection names, field names, types, enums, and relationships. Zero collection redesign, zero field removals/renames, zero data migrations.
4. **REST API Semantics:** Preserve existing endpoint paths, HTTP methods (`POST` on complaint transitions and `POST /notifications/read-all`), status codes, and response envelopes.
5. **Authentication & Isolation:** Clerk OAuth2/JWT + Svix raw-body webhooks for citizens; custom JWT + SHA-256 single-use rotating HttpOnly cookies (`civictrack_{admin|officer}_{token|refresh}`) for staff; strict RBAC, object ownership, and `Department.createdByAdminId` multi-tenant admin isolation.
6. **Realtime, Storage & Geospatial:** Socket.IO (`4.8.4`) with Persist-Before-Emit ordering, `SocketEvent` payloads, and room authorization (`user:*`, `role:*`, `dept:*`, `complaint:*`); AWS S3 pre-signed upload-intent flow plus backward-compatible multipart support; Ola Maps Web SDK v2 + MapLibre GL + Ola Directions API.
7. **Product Scope:** No new user-facing features. Fix bugs, modernize UI, harden security, optimize performance/SEO, and upgrade compatible existing dependencies only.

---

## 2. Verified Implementation Baseline (Source-of-Truth Reference)

Where markdown docs conflict with code, the verified implementation below is the immutable baseline (docs and `openapi.ts` must be reconciled to match code):
- **Complaint Lifecycle States:** `SUBMITTED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` (`packages/contracts/src/enums.ts:7-16`).
- **Complaint Transitions (`workflow.ts:13-22`):** `SUBMITTED -> UNDER_REVIEW`; `UNDER_REVIEW -> VERIFIED | REJECTED`; `VERIFIED -> ASSIGNED | CLOSED`; `ASSIGNED -> IN_PROGRESS | ASSIGNED | CLOSED`; `IN_PROGRESS -> RESOLVED | CLOSED`; `RESOLVED -> CLOSED`.
- **Complaint Workflow HTTP Methods:** All 7 transition routes mount **`POST`** (`/review`, `/verify`, `/reject`, `/assign`, `/close` = `ADMIN`; `/start-work`, `/resolve` = assigned/dept `OFFICER` or owning `ADMIN`).
- **Notifications Read-All:** `POST /api/v1/notifications/read-all`.
- **Staff Auth Cookies (`staff-auth.controller.ts:39-40`):** `civictrack_admin_token`, `civictrack_admin_refresh`, `civictrack_officer_token`, `civictrack_officer_refresh` (`httpOnly: true`, `sameSite: "lax"`, `path: "/"`).
- **Upload MIME Allowlist:** `image/jpeg`, `image/png`, `image/webp`, max `10 MB`, max `5` files per request (NO PDF support); view pre-sign TTL `3600s`; upload pre-sign TTL `900s`.
- **Socket.IO Rooms:** `user:{userId}`, `role:admin`, `role:officer`, `dept:{departmentId}`, `complaint:{complaintId}`.
- **SLA Thresholds (`sla.config.ts`):** `CRITICAL: 12h`, `HIGH: 24h`, `MEDIUM: 48h`, `LOW: 72h`, category overrides (`ELECTRICITY: 18h`, `WATER_SUPPLY: 24h`) taking `Math.min(base, override)`.

---

## 3. Specific Guardrails for Critical Subsystems

### 3.1 Multi-Admin Creator Isolation & Citizen Auto-Routing
- **Preserve Global Citizen Routing:** `DepartmentService.findByCategory` MUST continue matching active departments globally across admins when a citizen submits a complaint (citizens are not scoped to an admin; sort deterministically by `createdAt: 1`). Once assigned a `departmentId`, the complaint belongs strictly to that department's `createdByAdminId`.
- **Enforce Strict Creator Ownership Across Services:**
  - `ComplaintQueryService.getById` & `ComplaintWorkflowService.{review,verify,reject,assign,close,startWork,resolve}`: if `complaint.departmentId` is set, require `DepartmentModel.createdByAdminId === adminId`, else `403`. In `assign`, check BOTH the complaint's current `departmentId` AND the target `dto.departmentId`. Unassigned intake (`!complaint.departmentId`) remains accessible for triage. *Operational/Test Prerequisite:* Legacy DB departments lacking `createdByAdminId` require running `scripts/backfill-department-creators.ts`, and test fixtures must explicitly populate `createdByAdminId`.
  - `UserService.updateRoleAndDepartment`: validate ObjectId; require `requestingAdminId` ownership for target `OFFICER`s' current department AND forbid mutating another `ADMIN`.
  - `StaffAuthService.{listInvitations,revokeInvitation}`: scope to `invitedBy` or departments created by `requestingAdminId`.
  - `DuplicateDetectionService.{findCandidates,linkDuplicate}`: enforce creator ownership on source/primary/candidate complaints for `ADMIN`.
  - `SlaService`: `getOverdueComplaints` scopes admin view to owned departments + unassigned intake; `scanAndEscalateOverdue` notifies **only** the owning `createdByAdminId` when `departmentId` is set (and active admins only when `departmentId` is unset).
  - `StorageService.verifyViewAuthorization`: remove unconditional `ADMIN` and unassigned-`OFFICER` bypasses; authorize `ADMIN` only for their own uploads, unassigned intake complaints, or complaints in departments they created. Fail closed when DB is disconnected *(co-update `tests/storage.test.ts:259` offline expectation accordingly rather than weakening fail-closed checks)*.
- **Socket.IO Multi-Tenant Broadcasts (`apps/server/src/socket.ts`):**
  - Keep `SocketEvent` names and payload schemas unchanged.
  - On connection, join `ADMIN` sockets to `dept:{id}` for every active department they created (`createdByAdminId`), plus `user:{id}` and `role:admin`.
  - In `initSocketServer` (`io.use` handshake): check `StaffSessionModel` revocation/expiry whenever a Staff JWT is presented and fail closed when DB is disconnected.
  - In `authorizeRoomJoin`: fail closed when DB is disconnected on `complaint:*` and creator-scoped `dept:*` checks; enforce `createdByAdminId` for `ADMIN` joining `dept:*` or `complaint:*`; forbid `OFFICER` joining unassigned `complaint:*` rooms.
  - Emit complaint events with `departmentId` (`emitComplaintCreated`, `emitComplaintStatusUpdated`, `emitComplaintAssigned`, and admin `emitDashboardStatsUpdated`) to `dept:{departmentId}` + owning `user:{ownerAdminId}` + `user:{citizenId}` + `user:{officerId}` + `complaint:{complaintId}`, omitting global `"role:admin"` broadcast whenever `departmentId` is set (emit `"role:admin"` ONLY for unassigned intake). *Test reconciliation required:* co-update pre-hardening assertions in `tests/socket-auth.test.ts:94-108,203-206,320-360` to match fail-closed and creator-scoped semantics.

### 3.2 Database Indexes & Query Safety
- **ALLOWED:** Non-unique read-optimization index `ComplaintSchema.index({ departmentId: 1, createdAt: -1 })`, non-unique `SlaEscalationSchema.index({ isResolved: 1, delayHours: -1 })`, and non-destructive startup/CLI `createIndexes()` for all active Mongoose models (`NotificationModel`, `ComplaintStatusHistoryModel`, `UploadIntentModel`, `SlaEscalationModel`, `StaffInvitationModel`, `StaffSessionModel`). Never call `syncIndexes()` automatically in production startup (could drop indexes).
- **PROHIBITED (Data-Loss / Migration Risk):**
  - Do NOT add an unconditional TTL index on `UploadIntentModel.expiresAt` (`ATTACHED` audit records and `PENDING` orphans <24h would be deleted after 15 minutes before `cleanupOrphanedUploads` runs).
  - Do NOT add a TTL index on `StaffInvitationModel.expiresAt` (deletes `ACCEPTED`/`REVOKED`/`EXPIRED` audit history).
  - Do NOT add `{ unique: true }` to `StaffSessionModel.refreshTokenHash` without prior data migration/test cleanup. Instead eliminate `"pending"` 2-step writes via pre-generated `new Types.ObjectId()`.

### 3.3 Citizen Evidence Flow & Detail Views
- Keep `POST /api/v1/complaints` accepting BOTH JSON (`CreateComplaintDto` with `evidence[]`) AND multipart `FormData` (`uploadEvidenceMiddleware`).
- Upgrade `apps/web/src/app/citizen/report/page.tsx` to use the documented S3 pre-signed `POST /api/v1/storage/upload-intent` -> direct S3 `PUT` -> JSON `POST /api/v1/complaints` flow (with automatic fallback to `POST /api/v1/storage/upload` + Clerk Bearer token + `credentials: "include"`), matching `officer/complaints/[id]/page.tsx`.
- Restrict `folder: "resolved"` on `/storage/upload-intent` & `/storage/upload` strictly to `OFFICER` and `ADMIN`; sanitize/validate `complaintId` prefixing.
- Fix `citizen/complaints/[id]/page.tsx` to read actual populated paths (`departmentId?.name`, `assignedOfficerId?.name`, `dueAt`), pass Clerk Bearer token on detail/view-url/feedback fetches, reload after feedback submission, and enforce Persist-Before-Emit in `ComplaintSubmissionService.submitFeedback`.

### 3.4 Next.js Routing, Auth Refresh, Maps Security & Infra
- **Next.js Middleware (`apps/web/src/middleware.ts`):** Fix `isPublicPath` slash boundary while keeping `/api` public; accept either access or refresh cookie on `/admin` & `/officer` so 7-day refresh cookies can renew 15-minute access cookies; support Clerk OR staff cookies on `/notifications` (`proxy.ts` migration permitted only if verified bug-free with Clerk `clerkMiddleware` in Next 16 build).
- **Staff Token Refresh (`staff-auth-context.tsx`):** Use a **single-flight shared Promise lock** when calling `POST /api/v1/{admin|officer}/auth/refresh` on `401` so concurrent requests never trigger refresh-token replay revocation.
- **Public Maps Endpoints:** Keep `/api/v1/maps/*` accessible for public `/map` `LocationPicker` (protect with rate limiting + `5s` `AbortSignal.timeout` + secret-scrubbed logging). Remove hardcoded Ola Maps API key fallback from `ola-maps-config.ts`. HTML-escape all interpolated strings in `map-popup-generator.ts` and `current-location-marker.tsx`.
- **Tooling & Typecheck:** Keep `"rootDir": "./src"` intact in `apps/server/tsconfig.json`; add `apps/server/tsconfig.test.json` (`noEmit: true`) for test compilation checks.
- **Docker / Env:** Support `DATABASE_URL` fallback only when `ATLAS_URI` is empty in `env.ts`; set `ATLAS_URI` in `docker-compose.yml` and pass `${AWS_S3_BUCKET_NAME:-REPLACE_ME}` (never use a fake non-`REPLACE_ME` bucket placeholder under `NODE_ENV: production`, as `config/s3.ts:21-22` would falsely report `isS3Configured() === true`); guard `dns.setServers` in `database.ts` for `mongodb+srv://` only; move `@types/multer` & `@types/swagger-ui-express` to `devDependencies` in `apps/server/package.json`.
