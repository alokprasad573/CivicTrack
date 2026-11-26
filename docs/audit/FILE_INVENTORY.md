# CivicTrack Phase 0 — File Inventory

**Audit Timestamp:** 2026-11-26  
**Branch:** `feature/civictrack-production-modernization` (base commit `58d251a`)  
**Total Tracked Files (`git ls-files`):** `230` (excluding untracked local skill metadata `skills-lock.json` and `.agents/skills/modern-web-guidance/`).

## Summary by Category

| Category | Tracked Count | Status | Notes |
| :--- | :---: | :--- | :--- |
| Root, Infra, CI/CD, Config & Scripts | 23 VERIFIED, 1 REVIEWED | Verified / Reviewed | `package-lock.json` parsed structurally (`lockfileVersion: 3`, 459 entries) rather than line-by-line |
| Governance (`.agents/**`, `Update/**`) | 26 | VERIFIED | Read in full across master and audit setup |
| Repository Documentation (`docs/*.md`) | 7 | VERIFIED | Contradictions against code documented in `ARCHITECTURE_GAP_ANALYSIS.md` |
| Shared Packages (`packages/**`) | 16 | VERIFIED | `@civictrack/contracts` (13 TS sources) and `@civictrack/config` |
| Backend Source (`apps/server/src/**`) | 73 | VERIFIED | Entrypoints, config, common, 11 modules, OpenAPI docs, 5 CLI scripts |
| Backend Tests (`apps/server/tests/**`) | 17 | VERIFIED | 15 deterministic suites in `npm test`; 2 integration runners |
| Frontend Source (`apps/web/src/**`) | 67 | VERIFIED | Middleware, 27 app routes/layouts/styles, 21 components, 1 context, 8 hooks, 5 libs |
| **Total** | **230** | **229 VERIFIED, 1 REVIEWED** | Zero source files left `NOT_STARTED` |

---

## 1. Root, Config, Docker, CI/CD & Scripts (24 files)

| File | Category | Status | Role / Exports / Notes |
| :--- | :--- | :--- | :--- |
| `.dockerignore` | Config | VERIFIED | Excludes `.git`, `*.md`, `node_modules`, `.next`, `dist`, `.env*` (except `.env.example`) |
| `.editorconfig` | Config | VERIFIED | 2-space indent, LF line endings, UTF-8 |
| `.gitignore` | Config | VERIFIED | Ignores `.env*`, `node_modules`, `.next`, `dist`, logs |
| `LICENSE` | Legal | VERIFIED | MIT License |
| `README.md` | Docs | VERIFIED | Root project documentation (contains doc-vs-code discrepancies) |
| `docker-compose.yml` | Infra | VERIFIED | Services `mongo`, `server`, `web`; **bug:** sets `DATABASE_URL` instead of `ATLAS_URI` |
| `package.json` | Manifest | VERIFIED | npm workspaces (`apps/*`, `packages/*`), root scripts (`build`, `typecheck`, `lint`, `test`, `clean`) |
| `package-lock.json` | Lockfile | REVIEWED | Lockfile v3, 459 package entries inspected via Node parser for exact dependency versions |
| `tsconfig.base.json` | Config | VERIFIED | Shared strict TypeScript base config (`ES2022`) |
| `.github/workflows/ci.yml` | CI/CD | VERIFIED | Static typecheck/lint, server tests, workspace build, Docker smoke build (uses `actions/*@v4`) |
| `.github/workflows/cd.yml` | CI/CD | VERIFIED | GHCR Docker push + deploy webhook + health check |
| `scripts/test-endpoints.mjs` | Script | VERIFIED | `testAll` live smoke script against `127.0.0.1:4000` (11 basic checks; sets `X-Forwarded-For`) |
| `apps/server/.env.example` | Config | VERIFIED | Server env template (`ATLAS_URI`, `STAFF_JWT_*`, Clerk, Ola Maps, S3) |
| `apps/server/Dockerfile` | Infra | VERIFIED | Multi-stage Node 24 Alpine build for `@civictrack/contracts` + `@civictrack/server` |
| `apps/server/package.json` | Manifest | VERIFIED | Express 4.21/Mongoose 8.10 backend; `@types/multer` & `@types/swagger-ui-express` in `dependencies` |
| `apps/server/tsconfig.json` | Config | VERIFIED | `NodeNext` build; **gap:** `"include": ["src/**/*"]` excludes `tests/` from `tsc --noEmit` |
| `apps/web/.env.example` | Config | VERIFIED | Web env template (`NEXT_PUBLIC_*`, `CLERK_SECRET_KEY`) |
| `apps/web/Dockerfile` | Infra | VERIFIED | Multi-stage Next.js standalone image build (`NODE_ENV=production` at build time) |
| `apps/web/next-env.d.ts` | Generated/TS | VERIFIED | Next.js TS ambient references |
| `apps/web/next.config.mjs` | Config | VERIFIED | `reactStrictMode: true`, `transpilePackages` (`@civictrack/contracts`, `olamaps-web-sdk`, `maplibre-gl`), `/api/v1/:path*` + `/docs/:path*` rewrites (lacks `output: "standalone"`) |
| `apps/web/package.json` | Manifest | VERIFIED | Next 16.4.6 / React 19; `lint` aliases `tsc --noEmit`; `test` is stub `exit 0` |
| `apps/web/postcss.config.mjs` | Config | VERIFIED | `tailwindcss`, `autoprefixer` |
| `apps/web/tailwind.config.ts` | Config | VERIFIED | Tailwind 3.4 dark-class theme tokens, custom keyframe `civic-bounce` |
| `apps/web/tsconfig.json` | Config | VERIFIED | `strict: true`, `@/*` path alias to `./src/*` |

---

## 2. Governance, Roadmaps & Repository Documentation (37 files)

| Path Group | Files | Status | Scope |
| :--- | :--- | :--- | :--- |
| `.agents/AGENTS.md`, `.agents/AGENT_HIERARCHY.md` | 2 | VERIFIED | Non-negotiable invariants, agent ownership boundaries, workflow gates |
| `.agents/agents/*.md` | 11 | VERIFIED | `architecture-guardian`, `backend-performance`, `dependency-engineer`, `frontend-performance-seo`, `independent-reviewer`, `master-orchestrator`, `qa-engineer`, `repository-intelligence`, `security-engineer`, `ui-modernization`, `workflow-integrity` |
| `.agents/skills/civictrack-*/SKILL.md` | 9 | VERIFIED | Domain-specific CivicTrack skills (9 directories) |
| `Update/*.md` | 4 | VERIFIED | `README.md`, `MASTER_PROMPT.md`, `IMPLEMENTATION_PLAN.md`, `AGENT_WORKING.md` |
| `docs/*.md` | 7 | VERIFIED | `ARCHITECTURE.md`, `DATABASE_STUCTURE.md`, `API_DOCUMENTATION.md`, `FEATURES.md`, `TECH_STACK.md`, `CI_CD_PIPELINE.md`, `QUICKSTART.md` |

---

## 3. Shared Packages (`packages/**`, 16 files)

| File | Status | Exports / Responsibility | Consumers |
| :--- | :--- | :--- | :--- |
| `packages/config/package.json` | VERIFIED | Placeholder `@civictrack/config` workspace (`exit 0` scripts) | Root workspaces |
| `packages/contracts/package.json` | VERIFIED | `@civictrack/contracts` build/typecheck manifest (only dep: `zod`) | Server & Web |
| `packages/contracts/tsconfig.json` | VERIFIED | `NodeNext` compiler settings | `@civictrack/contracts` |
| `packages/contracts/src/index.ts` | VERIFIED | Barrel re-export of all contract modules | Server & Web |
| `packages/contracts/src/enums.ts` | VERIFIED | `UserRole`, `ComplaintCategory`, `ComplaintStatus`, `ComplaintPriority` | All modules & UI |
| `packages/contracts/src/api.ts` | VERIFIED | `ApiErrorResponse`, `ApiResponse<T>`, `PaginatedResponse<T>`, `PaginationQuerySchema` | Controllers & hooks |
| `packages/contracts/src/auth.ts` | VERIFIED | `UpdateRoleSchema`, `AdminRegisterSchema`, `CreateStaffInvitationSchema`, `AcceptStaffInvitationSchema`, `VerifyStaffInvitationResponse`, `UserProfile` | `staff-auth`, `users`, web forms |
| `packages/contracts/src/complaints.ts` | VERIFIED | `GeoJsonPointSchema`, `CreateComplaintSchema`, `UpdateComplaintStatusSchema`, `ComplaintFilterSchema`, `ComplaintSummary` | `complaints` module & UI |
| `packages/contracts/src/workflow.ts` | VERIFIED | `ALLOWED_STATUS_TRANSITIONS`, `isValidStatusTransition`, `SubmitFeedbackSchema`, `ReviewComplaintSchema`, `VerifyComplaintSchema`, `RejectComplaintSchema`, `AssignComplaintSchema`, `StartWorkSchema`, `ResolveComplaintSchema`, `CloseComplaintSchema` | `complaints` service & tests |
| `packages/contracts/src/storage.ts` | VERIFIED | `ALLOWED_EVIDENCE_MIME_TYPES`, `MAX_EVIDENCE_FILE_SIZE`, `MAX_EVIDENCE_COUNT`, `CreateUploadIntentSchema`, `ViewUrlQuerySchema`, response interfaces | `storage` & `complaints` |
| `packages/contracts/src/maps.ts` | VERIFIED | `ReverseGeocodeQuerySchema`, `ForwardGeocodeQuerySchema`, `DirectionsRequestSchema`, `GeocodeResult`, `RouteCalculationResult`, `OlaMapMode`, navigation types | `maps` module & UI maps |
| `packages/contracts/src/notifications.ts` | VERIFIED | `NotificationType`, `INotification`, `NotificationQuerySchema` | `notifications` module & UI |
| `packages/contracts/src/analytics.ts` | VERIFIED | `AnalyticsFilterSchema`, `IAnalyticsSummary`, category/dept/status/priority/daily breakdown types | `analytics` module & UI |
| `packages/contracts/src/sla.ts` | VERIFIED | `SlaEscalationLevel`, `ISlaEscalation`, `ISlaOverdueComplaint`, `SlaScanResult` | `sla` module |
| `packages/contracts/src/duplicate-detection.ts` | VERIFIED | `DuplicateSignalType`, `IDuplicateCandidate`, `LinkDuplicateSchema` | `duplicate-detection` & admin |
| `packages/contracts/src/realtime.ts` | VERIFIED | `SocketEvent`, payload schemas (`ComplaintCreated`, `ComplaintStatusUpdated`, `ComplaintAssigned`, `Notification`, `DashboardStatsUpdated`) | `socket.ts`, UI hooks, tests |

---

## 4. Backend Source (`apps/server/src/**`, 73 files)

### Entrypoints, Config, Common & Docs (17 files — all VERIFIED)
- `apps/server/src/server.ts`: HTTP + Socket.IO server startup, 15m `setInterval` SLA scan, process error handlers, graceful shutdown.
- `apps/server/src/app.ts`: Express app factory (`helmet`, `cors`, `cookieParser`, custom staff-cookie CSRF check, `10mb` JSON/urlencoded + `rawBody`, `sanitizeInputMiddleware`, rate limiters, `/health`, `/ready`, `clerkMiddleware`, `/docs`, 11 module routers, `notFoundMiddleware`, `errorMiddleware`).
- `apps/server/src/socket.ts`: Dual Socket.IO auth handshake (Staff JWT + Clerk), room join authorization (`authorizeRoomJoin`), `disconnectUserSockets`, event emitters.
- `apps/server/src/config/{env,database,s3,maps}.ts`: Env Zod validation + production checks, Mongoose connect/index sync (`dns.setServers`), S3 client/bucket helpers, Ola Maps config.
- `apps/server/src/common/errors/app-error.ts`: `AppError` hierarchy (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `ServiceUnavailableError`).
- `apps/server/src/common/utils/logger.ts`: Structured JSON/formatted console logger.
- `apps/server/src/common/middleware/{error,not-found,rate-limit,request-id,sanitize,upload}.middleware.ts`: Global error handler, 404 handler, rate limiters (`300`/`60`/`50` per 15m), request-id middleware, NoSQL `$`/`.` sanitizer, Multer memory storage filter.
- `apps/server/src/docs/{openapi,swagger.routes}.ts`: Static OpenAPI 3.0.3 JSON spec and Swagger UI router.

### Domain Modules (51 files — all VERIFIED)
- **Identity (5):** `modules/identity/{clerk-webhook.controller,clerk.middleware,identity.routes,identity.types,rbac.middleware}.ts` (`requireDepartmentAccess` in `rbac.middleware.ts` is UNUSED).
- **Staff Auth (6):** `modules/staff-auth/{jwt.service,staff-auth.controller,staff-auth.routes,staff-auth.service,staff-invitation.model,staff-session.model}.ts`.
- **Users (3):** `modules/users/{user.model,user.routes,user.service}.ts` (`UserService.bootstrapAdmin` is UNUSED).
- **Departments (3):** `modules/departments/{department.model,department.routes,department.service}.ts` (`DepartmentService.seedDefaults` is UNUSED).
- **Complaints (10):** `modules/complaints/{assignment.model,complaint-history.model,complaint-query.service,complaint-submission.service,complaint-workflow.service,complaint.controller,complaint.model,complaint.routes,complaint.service,counter.model}.ts` (`AssignmentModel` is UNUSED dead code).
- **Storage (5):** `modules/storage/{s3.service,storage.controller,storage.routes,storage.service,upload-intent.model}.ts`.
- **Maps (4):** `modules/maps/{maps.controller,maps.routes,maps.service,ola-maps.adapter}.ts`.
- **Notifications (4):** `modules/notifications/{notification.controller,notification.model,notification.routes,notification.service}.ts`.
- **Analytics (3):** `modules/analytics/{analytics.controller,analytics.routes,analytics.service}.ts`.
- **Duplicate Detection (3):** `modules/duplicate-detection/{duplicate-detection.controller,duplicate-detection.routes,duplicate-detection.service}.ts`.
- **SLA (5):** `modules/sla/{sla-escalation.model,sla.config,sla.controller,sla.routes,sla.service}.ts` (`SlaService.calculateDueDate` is UNUSED).

### CLI Scripts (5 files — all VERIFIED)
- `apps/server/src/scripts/{backfill-department-creators,bootstrap-admin,create-invite,seed-staff,sync-indexes}.ts`.

---

## 5. Backend Tests (`apps/server/tests/**`, 17 files — all VERIFIED)

- **15 suites executed by `npm test --workspace=@civictrack/server`:** `server.test.ts`, `auth.test.ts`, `staff-auth.test.ts`, `admin-register.test.ts`, `complaints.test.ts`, `storage.test.ts`, `maps.test.ts`, `notifications.test.ts`, `analytics-sla.test.ts`, `security-hardening.test.ts`, `socket-auth.test.ts`, `authorization-privacy.test.ts`, `officers-management.test.ts`, `admin-scoped-data.test.ts`, `clerk-jit-concurrency.test.ts`.
- **2 live integration runners:** `run-db-integration.ts` (`REQUIRE_TEST_DB=true`), `run-storage-integration.ts` (`CIVICTRACK_S3_INTEGRATION_TESTS=true`).

---

## 6. Frontend Source (`apps/web/src/**`, 67 files — all VERIFIED)

- **Middleware (1):** `apps/web/src/middleware.ts`
- **App Router Pages, Layouts & Styles (27):**
  - Root/Public/Auth: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/map/page.tsx`, `app/not-found.tsx`, `app/notifications/page.tsx`, `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`
  - Citizen Portal: `app/citizen/{layout,page,complaints/page,complaints/[id]/page,report/page}.tsx`
  - Officer Portal: `app/officer/{layout,login/page,register/page,page,complaints/[id]/page}.tsx`
  - Admin Portal: `app/admin/{layout,login/page,register/page,page,analytics/page,departments/page,officers/page,complaints/[id]/page}.tsx`
- **Components (21):**
  - Auth/Complaints/Evidence/Notifications: `components/auth/staff-register-form.tsx`, `components/complaints/complaint-status-tracker.tsx`, `components/evidence/evidence-lightbox.tsx`, `components/notifications/notification-bell.tsx`
  - Layouts: `components/layout/{admin-shell,citizen-shell,officer-shell,persona-pills}.tsx` (`persona-pills.tsx` is DEAD/UNUSED)
  - UI Primitives: `components/ui/{empty-state,page-header,priority-badge,status-badge,toast-context}.tsx`
  - Maps & Navigation: `components/maps/{current-location-marker,location-picker,map-controls,map-marker-layer,map-markers,map-popup-generator,officer-navigation,ola-map,spatial-map-preview}.tsx|.ts`, `components/maps/navigation/{navigation-panel,officer-navigation-view,route-layer}.tsx` (`components/maps/navigation/*` are ALL DEAD/UNUSED!)
- **Context (1):** `context/staff-auth-context.tsx`
- **Hooks (8):** `hooks/{use-complaint-detail-realtime,use-complaint-markers,use-geolocation,use-navigation,use-notifications,use-ola-map,use-realtime-complaints,use-socket,use-spatial-map}.ts` (`use-navigation.ts` is DEAD/UNUSED)
- **Libraries (5):** `lib/{api-client,maplibre-loader,navigation-service,ola-maps-config,utils}.ts` (`navigation-service.ts` and `utils.ts` are DEAD/UNUSED)
