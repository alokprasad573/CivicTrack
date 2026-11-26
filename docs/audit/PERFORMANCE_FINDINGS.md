# CivicTrack Phase 0 — Performance Findings Report

## 1. Frontend Performance, Rendering & Bundle Bottlenecks

| ID | Impact | Location | Root Cause & Measured Evidence |
| :--- | :--- | :--- | :--- |
| PERF-FE-01 | HIGH | `apps/web/src/app/page.tsx:18-19` | `HomePage` awaits `auth()`, forcing `/` to be dynamic SSR (`ƒ /` in Next 16 build) on every request instead of static edge caching (`○ /`). |
| PERF-FE-02 | HIGH | `apps/web/src/app/globals.css:1` | Imports `maplibre-gl/dist/maplibre-gl.css` globally into the root stylesheet (`67.6 KB` CSS baseline chunk) instead of scoping CSS to map components, bloating every non-map route. |
| PERF-FE-03 | HIGH | `apps/web/src/app/map/page.tsx:13`, `apps/web/src/app/officer/complaints/[id]/page.tsx:10` | Statically imports `LocationPicker` (pulling `OlaMap`, `olamaps-web-sdk`, `maplibre-gl`) and `OfficerNavigation`. Contributes to `4,415.1 KB` `.next/static` JS with `968 KB` + `967 KB` + `733 KB` chunks. |
| PERF-FE-04 | MEDIUM | `apps/web/src/app/layout.tsx:42-51`, `components/layout/*-shell.tsx` | Inline `<script dangerouslySetInnerHTML>` runs synchronously on every route; layout shells mount duplicate `NotificationBell` + `useNotifications()` socket + REST fetch even alongside `app/notifications/page.tsx` (which instantiates `useNotifications()` a second time!). |
| PERF-FE-05 | MEDIUM | `app/admin/page.tsx`, `app/citizen/complaints/page.tsx`, `app/admin/officers/page.tsx` | Search input `onChange` triggers `fetch` immediately on every keystroke with zero debounce (`300ms`). |
| PERF-FE-06 | MEDIUM | `app/citizen/complaints/[id]/page.tsx`, `app/officer/complaints/[id]/page.tsx`, `app/admin/complaints/[id]/page.tsx` | Triggers N+1 sequential `GET /api/v1/storage/view-url` calls even though complaint detail endpoint already pre-signs evidence URLs, plus `OfficerDashboardPage` lacks pagination UI controls despite paged API response. |
| PERF-FE-07 | LOW | `app/officer/complaints/[id]/page.tsx:66-70`, `app/citizen/page.tsx`, `app/admin/page.tsx` | Redundant `useEffect` / `useCallback` re-fetches and fallback sequential requests (`map/page.tsx:161-196` fires up to 3 serial nearby requests on empty default result). |

---

## 2. Backend API & Database Latency Bottlenecks

| ID | Impact | Location | Root Cause & Behavior |
| :--- | :--- | :--- | :--- |
| PERF-BE-01 | CRITICAL | `apps/server/src/modules/complaints/complaint.controller.ts:195-243`, `complaint-query.service.ts:214` | `ComplaintController.list` loops over all returned complaints and calls `S3Service.generatePresignedViewUrl` (`crypto` + AWS SigV4 signing) for every `evidence` and `resolutionEvidence` item (up to `100 * 10 = 1,000` signer invocations per paginated list call) alongside full un-lean Mongoose hydration. |
| PERF-BE-02 | HIGH | `apps/server/src/modules/analytics/analytics.service.ts:64-287`, `analytics.controller.ts:43` | Executes 6 separate full `ComplaintModel.aggregate` passes over `matchQuery` instead of a single `$facet` pipeline; additionally `DepartmentModel.find` is executed twice per request (once in controller, once in service), and `ComplaintModel` lacks `{ departmentId: 1, createdAt: -1 }`. |
| PERF-BE-03 | HIGH | `apps/server/src/modules/sla/sla.service.ts:46-135` | `scanAndEscalateOverdue` queries all overdue complaints without `.limit()`, `.lean()`, or omitting unused `populate("departmentId")`; runs N+1 `SlaEscalationModel.findOne` per complaint (`L73`) and sequential `O(complaints * admins)` `await NotificationService.createAndEmit(...)` loops (`L100-126`). |
| PERF-BE-04 | HIGH | `apps/server/src/modules/identity/clerk.middleware.ts:44-51` | Every cookie/JWT staff API request executes 2 sequential non-lean Mongoose `.findById()` queries (`StaffSessionModel` then `UserModel`) instead of `.lean()` with minimal field projections (or parallel lookup). |
| PERF-BE-05 | HIGH | `apps/server/src/modules/maps/ola-maps.adapter.ts:43, 93, 142` | Upstream `fetch()` calls to `https://api.olamaps.io` omit `AbortSignal.timeout()`, allowing stalled upstream sockets to hang request handlers indefinitely (and `api_key` in URL string risks leaking in error logs). |
| PERF-BE-06 | MEDIUM | `apps/server/src/modules/complaints/complaint-query.service.ts:159, 176` | Admin complaint listing executes 2 separate `DepartmentModel.find({ createdByAdminId, ... })` queries back-to-back instead of 1 query projecting `_id`. |
| PERF-BE-07 | MEDIUM | `apps/server/src/modules/storage/storage.service.ts:51-92, 263-286, 357-374`, `s3.service.ts:159-174, 227-269` | Sequential `await` loops for pre-signing upload intents, S3 `HeadObjectCommand` checks, `DeleteObjectCommand` orphan cleanup, and multipart image uploads instead of `Promise.all` / batching (`DeleteObjectsCommand` / `insertMany`). |
| PERF-BE-08 | LOW | `apps/server/src/modules/staff-auth/staff-auth.service.ts:182-209, 606-633` | `createStaffSession` and `refresh` insert `StaffSession` with `refreshTokenHash: "pending"` then immediately execute a second `.save()`, doubling DB write roundtrips per login/refresh. |
| PERF-BE-09 | LOW | `user.service.ts`, `department.service.ts`, `notification.service.ts`, `duplicate-detection.service.ts`, `staff-auth.service.ts` | Read-only listing/lookup queries omit `.lean()` and unnecessary fields remain hydrated. |
