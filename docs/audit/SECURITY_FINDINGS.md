# CivicTrack Phase 0 — Security Findings Report

## Priority Matrix

| ID | Severity | Title | Location |
| :--- | :--- | :--- | :--- |
| SEC-01 | CRITICAL | CSRF protection completely bypassed for staff cookies | `apps/server/src/app.ts:70-72` |
| SEC-02 | CRITICAL | Account takeover via public `/admin/auth/register` & Clerk `syncFromClerk` | `apps/server/src/modules/staff-auth/staff-auth.service.ts:118-137`, `user.service.ts:51-77` |
| SEC-03 | CRITICAL | Creator-based multi-admin isolation gaps across workflow, invites, duplicates, SLA, storage & Socket.IO | `complaint-workflow.service.ts`, `user.service.ts:425-489`, `staff-auth.service.ts:476-546`, `duplicate-detection.service.ts`, `sla.service.ts`, `storage.service.ts:151`, `socket.ts:93,101` |
| SEC-04 | CRITICAL | S3 `validateUploadIntents` bypass & `resolved/image/` hijack + unauthorized view access | `apps/server/src/modules/storage/storage.service.ts:209,238-286` |
| SEC-05 | CRITICAL | Hardcoded real Ola Maps API key fallback committed in frontend source | `apps/web/src/lib/ola-maps-config.ts:17-22` |
| SEC-06 | HIGH | Stored/DOM XSS in `generateComplaintPopupHtml` (unsanitized string interpolation into `.setHTML()`) | `apps/web/src/components/maps/map-popup-generator.ts:81-128` |
| SEC-07 | HIGH | Socket.IO fails open on `complaint:*` when DB disconnected & never checks revoked `StaffSession` | `apps/server/src/socket.ts:106-119, 178-187` |
| SEC-08 | HIGH | Auth middleware cookie shadows Bearer token & officer without `departmentId` sees global records | `apps/server/src/modules/identity/clerk.middleware.ts:36-44, 84-86`, `user.routes.ts:98-103`, `complaint-query.service.ts:147-156` |
| SEC-09 | HIGH | Publicly exposed paid Maps API endpoints, citizen access to `/departments/:id`, dead staff logout socket disconnect | `maps.routes.ts:6-9`, `department.routes.ts:72-119`, `staff-auth.controller.ts:157, 254` |
| SEC-10 | MEDIUM | CORS `127.0.0.1/3000` typo, unvalidated `X-Request-ID`, unauthenticated `/api/v1` Edge middleware behavior & third-party `ipapi.co` IP leak | `app.ts:57`, `request-id.middleware.ts:13-16`, `apps/web/src/hooks/use-geolocation.ts:135` |

---

## Detailed Evidence & Analysis

### SEC-01: CSRF Origin Check Never Triggers for Real Staff Cookies
- **Evidence:** `apps/server/src/app.ts:70-72` vs `apps/server/src/modules/staff-auth/staff-auth.controller.ts:24, 39-40`.
- **Root Cause:** `app.ts` checks `req.cookies?.civictrack_staff_access || req.cookies?.civictrack_staff_refresh`, whereas `StaffAuthController.setStaffCookies` sets `civictrack_admin_token`, `civictrack_admin_refresh`, `civictrack_officer_token`, `civictrack_officer_refresh` with `sameSite: "lax"`.
- **Impact:** Cross-origin state-changing requests carrying valid staff cookies are never validated for matching `Origin`/`Referer`. Additionally `tests/security-hardening.test.ts:167` tests the nonexistent cookie name, creating a false-positive security test.

### SEC-02: Privilege Escalation / Account Takeover via Self-Registration & Clerk Sync
- **Evidence:** `apps/server/src/modules/staff-auth/staff-auth.service.ts:118-137` (`StaffAuthService.adminRegister`); `apps/server/src/modules/users/user.service.ts:51-77` (`UserService.syncFromClerk`).
- **Root Cause:**
  1. `adminRegister` only throws `ConflictError` if `existingUser && existingUser.isActive && (ADMIN || OFFICER)`. Any unauthenticated caller registering with the email of an existing `CITIZEN` or deactivated (`isActive: false`) staff account overwrites `name`, `passwordHash`, `role = ADMIN`, `isActive = true` (reclaiming prior `createdByAdminId` departments!).
  2. `syncFromClerk` matches `$or: [{ clerkUserId }, { email }]` and attaches `clerkUserId` even if `existing.role` is `ADMIN`/`OFFICER`, allowing external email impersonation/binding into a staff account if Clerk email exists or collides.

### SEC-03: Incomplete Creator-Based Multi-Admin Isolation
- **Evidence:**
  - `complaint-workflow.service.ts:38-246, 262-282, 585-669` (`review`, `verify`, `reject`, `assign` missing check on current complaint department + fallback when `createdByAdminId` unset, `close`).
  - `user.service.ts:425-489` (`updateRoleAndDepartment` only validates `requestingAdminId` when `params.role === UserRole.OFFICER`, allowing cross-admin demotion/promotion and missing ObjectId validation).
  - `staff-auth.service.ts:476-546` (`listInvitations` and `revokeInvitation` lack creator/department scoping).
  - `duplicate-detection.service.ts:68-105, 185-238` (`findCandidates` and `linkDuplicate` lack creator-admin scoping).
  - `sla.service.ts:62, 100-109, 153-181` (`scanAndEscalateOverdue` notifies all admins globally; `getOverdueComplaints` exposes all complaints to any admin).
  - `storage.service.ts:151-153` (`verifyViewAuthorization` returns `true` for any `ADMIN`).
  - `socket.ts:93, 101, 425, 450, 477, 501` (`authorizeRoomJoin` grants every admin `dept:*` and `complaint:*` rooms; broadcasters target global `"role:admin"`).

### SEC-04: S3 UploadIntent Validation & Authorization Bypasses
- **Evidence:** `apps/server/src/modules/storage/storage.service.ts:209, 238-286`; `storage.controller.ts:43-50`.
- **Root Cause:**
  - `validateUploadIntents`: when `!intent`, skips DB and `HeadObject` checks for `complaints/${userId}/`, `resolved/image/`, or `resolved/${userId}/`; sets `isOwner = true` for ANY key prefixed `resolved/image/` regardless of owner (`L250`); skips `ContentLength` check when `0` (`L272`) and ignores non-404 AWS errors (`L284`).
  - `createUploadIntents`: lets `CITIZEN` pass `folder: "resolved"` and unsanitized `complaintId` (path traversal in object key).
  - `verifyViewAuthorization`: allows ANY `OFFICER` to view evidence when `!deptId` (`L209`).

### SEC-05: Hardcoded API Key Exposed in Frontend Source
- **Evidence:** `apps/web/src/lib/ola-maps-config.ts:17-22`.
- **Root Cause:** `getClientOlaMapsApiKey()` falls back to a literal string key if `NEXT_PUBLIC_OLA_MAPS_API_KEY` is unset, shipping a hardcoded credential in client JS bundles and Git history.

### SEC-06: Map Popup HTML Injection (XSS Risk)
- **Evidence:** `apps/web/src/components/maps/map-popup-generator.ts:81-128` -> `map-marker-layer.tsx:283` (`new Popup().setHTML(popupHtml)`).
- **Root Cause:** `data.title`, `data.description`, `data.address`, `data.referenceNumber` are interpolated verbatim into an HTML template without HTML escaping before rendering into MapLibre's DOM popup container.

### SEC-07: Socket.IO Revocation & Fail-Open Gaps
- **Evidence:** `apps/server/src/socket.ts:106-119, 178-187`.
- **Root Cause:** Disconnected DB (`readyState !== 1`) returns `true` for `complaint:*` joins; `initSocketServer` validates Staff JWT signature without checking `StaffSessionModel` revocation or expiry; unassigned complaints (`!complaint.departmentId`) allow any officer into `complaint:*` room.

### SEC-08 & SEC-09: Auth Precedence, Missing Guards, Broken Logout Disconnect
- **Evidence:** `clerk.middleware.ts:36-44, 84-86`; `user.routes.ts:98-103`; `complaint-query.service.ts:147-156`; `staff-auth.controller.ts:155-159, 252-256`; `department.routes.ts:72-119`; `maps.routes.ts:6-9`.
- **Impact:** Stale cookie blocks valid `Authorization: Bearer` tokens; officer records missing `departmentId` query all users/complaints; `adminLogout`/`officerLogout` never disconnect active WebSockets because `req.user` is always `undefined`; citizens can query inactive `/departments/:id`; Maps routes consume third-party API quota anonymously.

### SEC-10: Origin Typo, Header Reflection & Third-Party Geolocation Leak
- **Evidence:** `apps/server/src/app.ts:57` (`"http://127.0.0.1/3000"`), `request-id.middleware.ts:13-16`, `apps/web/src/hooks/use-geolocation.ts:135` (`fetch("https://ipapi.co/json/")`), `apps/web/src/middleware.ts:17-20` (`pathname.startsWith(prefix)` without boundary).
