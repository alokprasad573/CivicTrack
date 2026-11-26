# CivicTrack — REST API & Realtime Event Reference

> Verified against Express route definitions in [`apps/server/src/app.ts`](../apps/server/src/app.ts), module routers in `apps/server/src/modules/`, Zod contracts in [`packages/contracts/src/`](../packages/contracts/src), and [`apps/server/src/socket.ts`](../apps/server/src/socket.ts).

**Related Docs:** [README](../README.md) • [Architecture](ARCHITECTURE.md) • [Database Structure](DATABASE_STRUCTURE.md) • [Features](FEATURES.md) • [Tech Stack](TECH_STACK.md) • [Quickstart](QUICKSTART.md) • [CI/CD Pipeline](CI_CD_PIPELINE.md)

---

## 1. Base URL, Mounting & Interactive Docs

- **API Base Path:** `/api/v1` (in Next.js `apps/web`, client requests to `/api/v1/:path*` and `/docs/:path*` are proxied via `next.config.mjs` rewrites to `INTERNAL_API_URL`; see [Quickstart](QUICKSTART.md#3-environment-variables)).
- **Dual Mount Paths:** Health, readiness, docs, webhooks, and core API routers are mounted at `/api/v1/*` and also at root paths (`/health`, `/ready`, `/docs`, `/webhooks/clerk`, `/users`, `/departments`, `/complaints`, `/storage`, `/maps`, `/duplicates`, `/sla`, `/analytics`, `/notifications`, `/admin/auth`, `/officer/auth`, `/staff/invitations`, `/admin/invitations`) in `apps/server/src/app.ts`.
- **Interactive Swagger / OpenAPI:**
  - `GET /docs/` and `GET /api/v1/docs/` — Swagger UI
  - `GET /docs/openapi.json` and `GET /api/v1/docs/openapi.json` — OpenAPI JSON
  - *Note:* `apps/server/src/docs/openapi.ts` documents a representative subset of routes and contains a few schema doc discrepancies (e.g., referencing `civictrack_staff_access` and `evidenceObjectKeys`) compared to the live Express routers documented below.

---

## 2. Authentication, Cookies & Security Controls

### Dual Authentication Model
1. **Citizen Authentication (Clerk):** Verified via `@clerk/express` (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`). When `NODE_ENV !== "production"` and `ALLOW_TEST_TOKEN_AUTH === "true"`, test bearer tokens may be enabled for automated test environments.
2. **Staff Authentication (`ADMIN` / `OFFICER`):** Custom JWT sessions delivered in HTTP-only cookies:
   - Admin cookies: `civictrack_admin_token` (access), `civictrack_admin_refresh` (refresh)
   - Officer cookies: `civictrack_officer_token` (access), `civictrack_officer_refresh` (refresh)
   - Cookie flags (`staff-auth.controller.ts`): `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`.
   - Default token TTLs: Access `15m` (`STAFF_JWT_ACCESS_EXPIRY`), Refresh `7d` (`STAFF_JWT_REFRESH_EXPIRY`).

### CSRF & Request Hardening (`app.ts`)
- Mutating HTTP requests carrying staff authentication cookies (excluding webhooks) validate the `Origin` or `Referer` header against the configured allowed origin set and reject mismatched origins with `403` (`CSRF_DETECTED`). No custom `X-CSRF-Protection` header is used.
- `helmet`, input sanitization middleware (`sanitize.middleware.ts`), and environment-gated rate limiters protect all routes.

### Rate Limits (`apps/server/src/common/middleware/rate-limit.middleware.ts`)
Rate limiting is skipped when `NODE_ENV === "test"` unless `ENABLE_TEST_RATE_LIMIT === "true"`.

| Limiter | Window | Max Requests | Scope |
| :--- | :--- | :--- | :--- |
| General API limiter | 15 minutes | `300` | Global API routes |
| `authWebhookRateLimiter` | 15 minutes | `60` | Auth, Clerk webhooks, and Maps endpoints |
| `uploadIntentRateLimiter` | 15 minutes | `50` | Pre-signed upload intents and `POST /api/v1/complaints` |

---

## 3. System & Webhook Endpoints

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` (and `/api/v1/health`) | Public | Process liveness probe (`200`) |
| `GET` | `/ready` (and `/api/v1/ready`) | Public | MongoDB readiness check (`200` when connected, `503` otherwise) |
| `GET` | `/docs/`, `/docs/openapi.json` (and `/api/v1/docs/*`) | Public | Swagger UI and OpenAPI JSON |
| `POST` | `/api/v1/webhooks/clerk` (and `/webhooks/clerk`) | Svix Signature | Handles `user.created`, `user.updated`, `user.deleted` (`authWebhookRateLimiter`) |

---

## 4. Staff Authentication & Invitation Endpoints

### 4.1 Admin Authentication (`/api/v1/admin/auth`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/auth/login` | Public (`authWebhookRateLimiter`) | Email/password login; sets `civictrack_admin_token` & `civictrack_admin_refresh` cookies |
| `POST` | `/api/v1/admin/auth/register` | Public (`authWebhookRateLimiter`) | Direct Admin registration (`name`, `email`, `password`; bcrypt cost `12`) |
| `POST` | `/api/v1/admin/auth/refresh` | Refresh Cookie | Rotates admin session tokens |
| `POST` | `/api/v1/admin/auth/logout` | Cookie / Session | Revokes `StaffSession` and clears admin cookies |
| `GET` | `/api/v1/admin/auth/me` | `ADMIN` | Returns current authenticated Admin profile |
| `GET` | `/api/v1/admin/auth/verify-invite` | Public | Verifies invite token query |

### 4.2 Officer Authentication (`/api/v1/officer/auth`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/officer/auth/login` | Public (`authWebhookRateLimiter`) | Email/password login; sets `civictrack_officer_token` & `civictrack_officer_refresh` cookies |
| `POST` | `/api/v1/officer/auth/register` | Public (`authWebhookRateLimiter`) | Officer onboarding via invitation token (`StaffRegisterForm`) |
| `POST` | `/api/v1/officer/auth/refresh` | Refresh Cookie | Rotates officer session tokens |
| `POST` | `/api/v1/officer/auth/logout` | Cookie / Session | Revokes `StaffSession` and clears officer cookies |
| `GET` | `/api/v1/officer/auth/me` | `OFFICER` | Returns current authenticated Officer profile |
| `GET` | `/api/v1/officer/auth/verify-invite` | Public | Verifies officer invitation token |

### 4.3 Staff Invitations (`/api/v1/staff/invitations` & `/api/v1/admin/invitations`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/staff/invitations/verify?token=...` | Public | Validates an invitation token (`PENDING` & unexpired) |
| `POST` | `/api/v1/staff/invitations/accept` | Public | Accepts invitation with name/password, creates staff user, sets session cookies |
| `POST` | `/api/v1/admin/invitations` | `ADMIN` | Creates an invitation for an officer (associated with department) |
| `GET` | `/api/v1/admin/invitations` | `ADMIN` | Lists invitations scoped to the admin's scope |
| `POST` | `/api/v1/admin/invitations/:id/revoke` | `ADMIN` | Marks a pending invitation as `REVOKED` |

---

## 5. Users & Departments

### 5.1 Users (`/api/v1/users`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users/me` | Authenticated | Current user profile |
| `POST` | `/api/v1/users/me/switch-role` | Authenticated | Dev-only role switcher (enabled only when `NODE_ENV !== "production"` and `ENABLE_DEV_ROLE_SWITCH === "true"`) |
| `GET` | `/api/v1/users` | `ADMIN`, `OFFICER` | Lists users (role/creator-scoped) |
| `PATCH` | `/api/v1/users/:id/role` | `ADMIN` | Updates user role/department assignment |
| `DELETE` | `/api/v1/users/officers/:id` | `ADMIN` | Deletes/deactivates an officer account safely |
| `DELETE` | `/api/v1/users/:id` | `ADMIN` | Removes user account |

### 5.2 Departments (`/api/v1/departments`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/departments` | Optional Auth | Lists departments (`ADMIN` requests are creator-scoped by `createdByAdminId`) |
| `POST` | `/api/v1/departments` | `ADMIN` | Creates a new department owned by the creating Admin |
| `GET` | `/api/v1/departments/:id` | `ADMIN` (creator) / assigned `OFFICER` | Fetches department details |
| `PATCH` | `/api/v1/departments/:id` | `ADMIN` (creator) | Updates department properties/categories |
| `DELETE` | `/api/v1/departments/:id` | `ADMIN` (creator) | Soft-deactivates department (`isActive = false`) |
| `GET` | `/api/v1/departments/:id/officers` | `ADMIN` (creator) / same-dept `OFFICER` | Lists officers belonging to the department |

---

## 6. Complaints & Workflow Transitions (`/api/v1/complaints`)

### 6.1 Discovery, Creation & Feedback

| Method | Endpoint | Auth | Parameters / Request Details |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/complaints/nearby` | Public | Query: `lng`/`longitude`, `lat`/`latitude`, `radius`/`radiusMeters`, `category`, `status`, `includeClosed`, `limit`. Returns sanitized public allowlist DTOs. |
| `POST` | `/api/v1/complaints` | Authenticated (`uploadIntentRateLimiter`) | Accepts **either** JSON (with pre-signed evidence object keys) **or** `multipart/form-data` (fields: `evidenceImages`, `images`, or `evidence`). Required fields include `title` (5–150), `description` (20–2000), `category`, `location` (`[lng, lat]`), `address`, optional `landmark`. Computes SLA `dueAt`. |
| `GET` | `/api/v1/complaints` | Authenticated | Role/creator-scoped list. Query: `page`, `limit` (default `10`, max `100`), `status`, `category`, `priority`, `departmentId`, `search`, `assignedToMe`. |
| `GET` | `/api/v1/complaints/:id` | Authenticated | Accepts MongoDB ObjectId or `referenceNumber` (`CT-YYYY-NNNNNN`). Populates fresh S3 pre-signed GET view URLs (`3600s` TTL). |
| `POST` | `/api/v1/complaints/:id/feedback` | Complaint-owner `CITIZEN` | Allowed when status is `RESOLVED` or `CLOSED`. Accepts `feedbackRating` (`1`–`5`) and `feedbackComment`. Submitting feedback transitions a `RESOLVED` complaint directly to `CLOSED`. |

### 6.2 Workflow Action Endpoints (All Actions Use `POST`)

| Method | Endpoint | Allowed Role | Enforced Transition | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/complaints/:id/review` | `ADMIN` | `SUBMITTED -> UNDER_REVIEW` | Moves new complaint into review |
| `POST` | `/api/v1/complaints/:id/verify` | `ADMIN` | `UNDER_REVIEW -> VERIFIED` | Confirms complaint validity |
| `POST` | `/api/v1/complaints/:id/reject` | `ADMIN` | `UNDER_REVIEW -> REJECTED` | Terminal rejection with `rejectionReason` |
| `POST` | `/api/v1/complaints/:id/assign` | `ADMIN` | `VERIFIED -> ASSIGNED`, `ASSIGNED -> ASSIGNED` | Assigns or reassigns `departmentId` / `assignedOfficerId` |
| `POST` | `/api/v1/complaints/:id/start-work` | `OFFICER`, `ADMIN` | `ASSIGNED -> IN_PROGRESS` | Field officer starts active work |
| `POST` | `/api/v1/complaints/:id/resolve` | `OFFICER`, `ADMIN` | `IN_PROGRESS -> RESOLVED` | Accepts JSON or `multipart/form-data` (`resolutionImages`, `resolutionEvidence`, `images`) plus `resolutionRemarks`. Marks active `SlaEscalation` resolved. |
| `POST` | `/api/v1/complaints/:id/close` | `ADMIN` | `VERIFIED` / `ASSIGNED` / `IN_PROGRESS` / `RESOLVED` -> `CLOSED` | Terminal administrative closure; marks active `SlaEscalation` resolved |

> **Frontend vs Backend Note:** `apps/web` also renders Verify controls on `SUBMITTED` complaints and Reassign controls on `IN_PROGRESS` complaints in the Admin complaint detail page, while `ComplaintWorkflowService` on the backend enforces `UNDER_REVIEW -> VERIFIED` and `VERIFIED | ASSIGNED -> ASSIGNED`.

---

## 7. Media Storage (`/api/v1/storage`)

Uploads accept **JPEG (`image/jpeg`), PNG (`image/png`), and WebP (`image/webp`) only** (validated with magic-byte inspection), up to **10 MB per file** and **5 files max**.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/storage/upload` | Authenticated | Direct multipart file upload handled via `multer.memoryStorage()` and uploaded to S3 |
| `POST` | `/api/v1/storage/upload-intent` (alias `/upload-intents`) | Authenticated (`uploadIntentRateLimiter`) | Requests pre-signed S3 PUT URLs (`900s` / 15-min TTL). Body: `{ files: [{ filename, contentType, size, checksum? }], folder?, complaintId? }` |
| `GET` | `/api/v1/storage/view-url?objectKey=...` | Authenticated | Generates a fresh S3 pre-signed GET URL (`3600s` / 1-hour TTL) |
| `POST` | `/api/v1/storage/cleanup?olderThanHours=24` | `ADMIN` | Cleans up stale/orphaned `UploadIntent` records (`olderThanHours` defaults to `24`) |

---

## 8. Maps, Duplicates, SLA, Analytics & Notifications

### 8.1 Maps (`/api/v1/maps`)
All maps endpoints use `authWebhookRateLimiter` (`60` req / 15m).

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/maps/status` | Public | Returns provider capability string (`"Ola Maps Web SDK v2 / Directions API"`) and configuration state |
| `GET` | `/api/v1/maps/reverse-geocode?lng=...&lat=...` | Public | Reverse geocodes coordinates to address metadata |
| `GET` | `/api/v1/maps/geocode?query=...` | Public | Searches places/addresses |
| `POST` | `/api/v1/maps/directions` | Public | Body: `{ origin: [lng, lat], destination: [lng, lat], mode? }`. Returns GeoJSON route geometry & turn steps (geometric fallback in dev; `503` in production if unconfigured/unavailable). |

### 8.2 Duplicate Detection (`/api/v1/duplicates`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/duplicates/:id/candidates` | `ADMIN`, `OFFICER` | Geospatial `$near` scan within `250m` (max `20` checked, excluding `REJECTED`/`CLOSED`, scoped to officer department if `OFFICER`). Scores `0`–`100` (`SAME_CATEGORY` +30; distance `<=50m` +35 / `<=100m` +25 / `<=250m` +15; description Jaccard >=0.2 up to +35; address Jaccard >=0.3 +10) and returns candidates with `similarityScore >= 40`. |
| `POST` | `/api/v1/duplicates/:id/link` | `ADMIN` | Non-destructively links a complaint to a primary complaint (`duplicateOf`, `isDuplicate: true`) without cancelling or deleting either record. |

### 8.3 SLA (`/api/v1/sla`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/sla/scan` | `ADMIN` | Manually triggers `SlaService.scanAndEscalateOverdue()` (the server also runs this every `15` minutes) |
| `GET` | `/api/v1/sla/overdue` | `ADMIN`, `OFFICER` | Lists currently overdue open complaints scoped by role/creator |

### 8.4 Analytics (`/api/v1/analytics`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/analytics/summary` | `ADMIN`, `OFFICER` | Aggregated complaint counts, status/category breakdowns, SLA compliance, and resolution metrics. Query: optional `startDate`, `endDate`, `departmentId`. Creator/department-scoped. |

### 8.5 Notifications (`/api/v1/notifications`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/notifications` | Authenticated | Lists notifications for the current authenticated user |
| `PATCH` | `/api/v1/notifications/:id/read` | Authenticated | Marks a specific notification as read |
| `POST` | `/api/v1/notifications/read-all` | Authenticated | Marks all unread notifications for the user as read |

---

## 9. Socket.IO Realtime Events (`apps/server/src/socket.ts`)

### Room Topology

| Room Name | Purpose |
| :--- | :--- |
| `user:{userId}` | Direct user notifications and personal updates |
| `role:citizen` | Broadcast room for citizen users |
| `role:officer` | Broadcast room for officer users |
| `role:admin` | Broadcast room for admin users |
| `admin:notifications` | Administrative alert & SLA breach notifications |
| `dept:{departmentId}` | Department-scoped updates for assigned officers |
| `complaint:{complaintId}` | Complaint detail live listeners |

### Emitted Events (`packages/contracts/src/realtime.ts`)

| Event Name | Purpose |
| :--- | :--- |
| `notification:new` | Pushes a persisted notification record to the recipient's user room |
| `complaint:created` | Signals new complaint submission |
| `complaint:status-updated` | Broadcasts workflow status changes to citizen, admin, department, and complaint rooms |
| `complaint:assigned` | Notifies department/officer rooms of complaint assignment |
| `dashboard:stats-updated` | Defined in contracts/`socket.ts` (`emitDashboardStatsUpdated`) and subscribed by `use-realtime-complaints.ts`; not currently emitted by HTTP route handlers |

On the client (`apps/web/src/hooks/use-socket.ts`), incoming events pass through a **10-second (`10000ms`) sliding-window deduplicator**, and `onReconnect` callbacks trigger data re-fetches after socket reconnection.
