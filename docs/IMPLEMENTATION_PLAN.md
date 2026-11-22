# CivicTrack — Step-by-Step Implementation Plan

**Document:** `IMPLEMENTATION_PLAN.md`  
**Project:** CivicTrack — Smart Civic Complaint Management System  
**Version:** 1.0  
**Status:** Execution baseline  
**Target:** B.Tech final-year major project, portfolio, internship and placement demonstration

---

## 1. Purpose

This document converts the CivicTrack PRD, System Architecture and UI/UX Design System into an ordered engineering execution plan.

It defines:
- What to implement, and in what order.
- The expected output of each step.
- Dependencies and completion gates.
- Commands and tests to run before moving forward.
- Rules for using Antigravity without allowing it to generate the entire application in one uncontrolled pass.

## 2. Source of Truth and Locked Decisions

Read these documents before implementation:

1. `docs/01_PRD_Product_Requirements.md`
2. `docs/02_SYSTEM_ARCHITECTURE.md`
3. `docs/03_UI_UX_DESIGN_SYSTEM.md`
4. `docs/IMPLEMENTATION_PLAN.md` — this document

**Authority order:** PRD defines product behavior; Architecture defines technical boundaries; UI/UX defines visual behavior; this plan defines implementation sequence. If they conflict, stop and report the conflict. Do not silently change the product scope or technology.

### Locked technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + TypeScript |
| UI | shadcn/ui |
| Styling | Tailwind CSS |
| Backend | Node.js + Express.js + TypeScript |
| Database | MongoDB + Mongoose |
| Authentication | Clerk (managed authentication and sessions) |
| Object storage | AWS S3 with private bucket and pre-signed URLs |
| Maps | Ola Maps API |
| Charts | shadcn/ui Charts (Recharts) |
| Real-time | Socket.io |
| Validation | Zod |
| API documentation | Swagger / OpenAPI |
| Backend tests | Jest + Supertest |
| Frontend tests | Vitest |
| Deployment | Vercel (web) + Render (API) |
| Version control | Git + GitHub |

**Architecture:** Modular monolith, REST APIs and Socket.io. Do not introduce microservices, Redis, queues or additional infrastructure unless a documented requirement justifies it.

### UI direction

Use a premium civic-tech interface with a black/graphite/charcoal foundation and restrained teal/cyan accents. Use amber for warnings, green for success and red for destructive/error states. Do not use purple, violet, lavender, magenta or indigo. Avoid neon gradients, excessive glassmorphism, emoji icons and decorative UI that harms readability.

---

## 3. Execution Rules

1. Implement one numbered step at a time.
2. Before editing, inspect the repository and read the relevant source documents.
3. Ask Antigravity to propose a plan for any step that changes architecture, authentication, authorization, data models or deployment.
4. Do not ask the agent to build the entire application in one prompt.
5. Run the verification commands for the current step before starting the next.
6. Review `git diff`; never accept unrelated rewrites.
7. Commit every completed step.
8. Keep secrets in environment variables. Never commit `.env` files, Clerk secret keys, webhook secrets or AWS credentials.
9. Do not use mock data to disguise unfinished backend functionality. Clearly label demo/seed data.
10. Keep API contracts, schemas and frontend types synchronized.
11. Use UTC timestamps in storage and ISO 8601 in API responses.
12. Prefer explicit, typed errors and structured logs over swallowed exceptions.

### Definition of Done — applies to every step

A step is complete only when:
- Acceptance criteria for that step are met.
- Type checking, linting and relevant tests pass.
- Loading, empty, error and success states are handled where applicable.
- Authentication and object-level authorization are enforced where applicable.
- No secrets or sensitive personal data are logged.
- The changed files and known limitations are reported.
- The changes are reviewed and committed.

---

## 4. Repository Bootstrap

Use a monorepo with independently runnable web and API applications.

```text
civictrack/
├── apps/
│   ├── web/                 # Next.js application
│   └── api/                 # Express API
├── packages/
│   └── shared/              # Shared enums, API contracts and schemas
├── docs/
│   ├── 01_PRD_Product_Requirements.md
│   ├── 02_SYSTEM_ARCHITECTURE.md
│   ├── 03_UI_UX_DESIGN_SYSTEM.md
│   └── IMPLEMENTATION_PLAN.md
├── .github/
│   └── workflows/
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Keep the shared package small. Do not share server-only code with the browser bundle.

---

# 5. Phased Implementation

## Phase 0 — Repository Inspection and Project Foundation

### Step 0.1 — Inspect the existing workspace

**Tasks**
- Inspect current files, package manager, scripts and Git state.
- Identify whether the repository is empty or contains an existing application.
- Read all project documents.
- Report conflicts, missing decisions and proposed implementation sequence.
- Do not modify files during this inspection step.

**Exit criteria**
- Repository state is understood.
- No existing work will be overwritten.
- Proposed structure is approved.

### Step 0.2 — Initialize the monorepo

**Tasks**
- Configure pnpm workspaces.
- Create `apps/web`, `apps/api` and `packages/shared`.
- Add root scripts for development, build, lint, typecheck and test.
- Configure TypeScript strict mode.
- Configure ESLint and Prettier consistently.
- Add `.editorconfig` and a comprehensive `.gitignore`.
- Add a root README with setup instructions.

**Exit criteria**
- Web and API apps start independently.
- Root scripts execute successfully.
- No secrets or generated build output are tracked.

### Step 0.3 — Add environment configuration

**Tasks**
- Add `.env.example` files for web and API.
- Validate API environment variables at startup using Zod.
- Separate development, test and production configuration.
- Document required external service credentials without including real values.

Suggested API variables:

```dotenv
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:3000
ATLAS_URI=
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=
OLA_MAP_PROJECT_ID=
OLA_MAPS_API_KEY=
OLA_MAP_CLIENT_ID=
OLA_MAP_CLIENT_SECRET=
```

Suggested web variables:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_OLA_MAPS_API_KEY=
NEXT_PUBLIC_OLA_MAP_PROJECT_ID=
```

Only expose values prefixed with `NEXT_PUBLIC_` when the provider explicitly permits browser-side use. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the web environment. Keep `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SIGNING_SECRET` server-side only. If Ola Maps requires a secret key for a particular operation, proxy that operation through the API instead.

**Exit criteria**
- Missing or malformed required environment values cause a clear startup failure.
- `.env` files are ignored by Git.
- `.env.example` contains placeholders only.

---

## Phase 1 — Backend Foundation and Database

### Step 1.1 — Create the Express application

**Tasks**
- Configure Express with TypeScript.
- Add request ID / correlation ID middleware.
- Add structured logging.
- Add centralized error handling.
- Add not-found handling.
- Configure CORS for the known web origin.
- Configure secure HTTP headers.
- Add `/api/v1/health` endpoint.
- Set request body size limits.

**Exit criteria**
- API starts and returns health status.
- Unexpected errors return a consistent response shape.
- Stack traces and secrets are not returned to clients in production.

### Step 1.2 — Connect MongoDB

**Tasks**
- Configure Mongoose connection and graceful shutdown.
- Handle connection failure and reconnect behavior.
- Create database module and model conventions.
- Add indexes through explicit model/index definitions.
- Add a database health check.

**Exit criteria**
- API connects to local or hosted MongoDB.
- API handles database unavailability without crashing silently.
- Shutdown closes the database connection cleanly.

### Step 1.3 — Establish shared contracts

**Tasks**
- Define shared enums for user roles, complaint categories, priorities and statuses.
- Define common API response and pagination types.
- Define canonical complaint status transition rules.
- Add Zod request schemas in the appropriate package or API module.
- Avoid duplicating business rules in frontend-only code.

**Exit criteria**
- Frontend and backend use the same canonical values.
- Invalid status values and invalid transitions are rejected by the backend.

### Step 1.4 — Create core database models

Implement in this order:

1. `User`
2. `Department`
3. `Complaint`
4. `Assignment`
5. `ComplaintStatusHistory`
6. `Notification`
7. `Feedback`
8. `AuditLog`

**Important model rules**
- Store password hashes only; never store plaintext passwords.
- Store map coordinates as GeoJSON Point: `[longitude, latitude]`.
- Create a `2dsphere` index for complaint locations.
- Add indexes for common filters: status, category, priority, department, assigned officer, created date and citizen.
- Use timestamps consistently.
- Keep status history append-only.
- Store S3 object keys and metadata, not permanent public object URLs.
- Avoid unbounded embedded arrays for status history or notifications.

**Exit criteria**
- Models validate required fields and enums.
- Indexes are created and verified.
- GeoJSON coordinate order is correct.

---

## Phase 2 — Clerk Authentication, Authorization and User Management

### Step 2.1 — Configure Clerk in Next.js

**Tasks**
- Create a Clerk application and configure development and production environments.
- Install and configure the official Clerk Next.js SDK.
- Configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and server-only `CLERK_SECRET_KEY`.
- Add Clerk middleware and protect authenticated route groups.
- Implement sign-in, sign-up and user profile UI using Clerk components or approved custom flows.
- Configure allowed redirect URLs and sign-out behavior.
- Enable only the authentication methods required by the product.
- Keep Clerk user IDs as the external identity reference in CivicTrack.

**Exit criteria**
- Citizen can sign up, sign in and sign out.
- Protected pages redirect unauthenticated users appropriately.
- Clerk secrets are not exposed in client bundles or committed to Git.

### Step 2.2 — Verify Clerk sessions in the Express API

**Tasks**
- Install the official Clerk backend SDK for Express/Node.js.
- Add middleware that verifies Clerk session tokens on protected API routes.
- Validate tokens using Clerk's supported verification flow; do not merely decode tokens.
- Derive the authenticated principal from the verified Clerk user ID.
- Resolve that ID to an active local CivicTrack user.
- Return consistent `401` responses for missing or invalid sessions.
- Configure trusted origins and credential/session behavior deliberately.

**Important**
- Do not implement a second custom JWT login system.
- Do not manually store Clerk session tokens in localStorage.
- Never trust a user ID or role supplied in the request body.
- Frontend route protection is not a substitute for backend authorization.

### Step 2.3 — Synchronize Clerk identities with CivicTrack users

**Tasks**
- Keep a local `User` document for CivicTrack profile, role, department membership and account state.
- Store Clerk's stable user ID in a unique indexed field such as `clerkUserId`.
- Create/update local user records through verified Clerk webhooks and/or a safe just-in-time synchronization flow.
- Verify webhook signatures using `CLERK_WEBHOOK_SIGNING_SECRET`.
- Make webhook handlers idempotent because webhook delivery may be retried.
- Handle user deletion/deactivation and profile changes safely.
- Define a safe bootstrap process for the first admin. Public sign-up must never allow users to choose the Admin role.
- Treat Clerk as the identity provider and the CivicTrack database as the source of truth for application roles and department permissions.

### Step 2.4 — Implement backend authorization

**Tasks**
- Implement role-based authorization for Citizen, Admin and Department Officer.
- Implement object-level authorization:
  - Citizen can access only their own complaints and profile.
  - Officer can access only complaints assigned to them or within their explicitly authorized department scope.
  - Admin can access administrative functions according to explicit permissions.
- Resolve roles and department permissions from the trusted local user record, not client-controlled metadata.
- Define behavior for a valid Clerk session whose local user is missing, disabled or not yet provisioned.
- Audit privileged role and department changes.

**Exit criteria**
- API integration tests prove cross-user and cross-department access is rejected.
- Client metadata or request-body tampering cannot grant elevated roles.
- Webhook retries do not create duplicate users or corrupt roles.
- A disabled local account is denied even if its Clerk session remains valid.

### Step 2.5 — Implement user and department administration

**Tasks**
- Read/update the user's CivicTrack profile.
- Admin creates and manages departments.
- Admin provisions officer access using the approved Clerk invitation/onboarding flow.
- Admin assigns officers to departments.
- Admin activates/deactivates local application access.
- Record privileged changes in audit logs.

**Exit criteria**
- Clerk handles authentication while CivicTrack enforces application authorization.
- Admin cannot be self-assigned through public registration or editable client metadata.
- Authentication and authorization integration tests pass.

---

## Phase 3 — Frontend Foundation and Design System

### Step 3.1 — Initialize Next.js application

**Tasks**
- Configure Next.js App Router and TypeScript.
- Configure Tailwind CSS and shadcn/ui.
- Add Geist or Inter typography.
- Add Lucide icons.
- Configure path aliases.
- Add route groups for public, citizen, admin and officer experiences.
- Configure error, loading and not-found boundaries.

### Step 3.2 — Implement design tokens and shared components

**Tasks**
- Define background, surface, border, text and semantic color tokens.
- Implement light/dark behavior only if specified; default to the approved premium dark direction.
- Build buttons, inputs, selects, dialogs, dropdowns, badges, cards, tables, tabs, skeletons and toasts.
- Create reusable page headers, breadcrumbs and responsive sidebar.
- Ensure keyboard navigation and visible focus states.

**Visual acceptance**
- Black/graphite base, teal/cyan primary accent.
- No purple/violet/indigo family colors.
- Consistent spacing, typography and border radii.
- Accessible text contrast.
- No fabricated metrics or charts presented as real data.

### Step 3.3 — Build application shells

**Tasks**
- Public marketing shell.
- Citizen dashboard shell.
- Admin dashboard shell.
- Officer workspace shell.
- Role-aware navigation.
- Responsive mobile navigation.

**Exit criteria**
- All shells render at desktop, tablet and mobile widths.
- Navigation visibility follows role permissions.
- Shared components have documented usage examples.

---

## Phase 4 — Complaint Creation, Image Upload and Location

### Step 4.1 — Implement complaint domain service

**Tasks**
- Define complaint creation and update schemas.
- Generate a human-readable complaint reference ID using a collision-safe strategy.
- Implement create/list/detail endpoints.
- Enforce citizen ownership on reads and updates.
- Implement pagination, filtering and sorting with allowlisted fields.
- Add status history creation for initial submission.
- Add audit events for important actions.

**Exit criteria**
- A citizen can create and retrieve their own complaint.
- A citizen cannot read or modify another citizen's complaint by guessing its ID.
- Pagination and filters are validated and bounded.

### Step 4.2 — Implement secure S3 upload flow

**Flow**
1. Browser requests an upload authorization from the API.
2. API authenticates the user and validates file metadata.
3. API generates a short-lived pre-signed upload URL for a private bucket.
4. Browser uploads directly to S3.
5. Browser confirms upload to the API.
6. API verifies/records the object metadata and associates it with the complaint.

**Tasks**
- Restrict file types and maximum file size.
- Generate unpredictable object keys.
- Keep the bucket private and enable encryption.
- Configure CORS narrowly for the web origin.
- Do not trust client-provided MIME type alone.
- Validate object ownership and upload association.
- Use short-lived signed URLs for authorized viewing.
- Add cleanup for abandoned uploads where practical.

**Exit criteria**
- Upload and retrieval work without exposing AWS credentials.
- Unauthorized users cannot retrieve private evidence.
- Unsupported files and oversized uploads are rejected.

### Step 4.3 — Implement Ola Maps integration

**Tasks**
- Build a map picker with draggable/selectable marker.
- Support address search and reverse geocoding.
- Capture latitude/longitude and formatted address.
- Store coordinates as GeoJSON `[longitude, latitude]`.
- Add nearby complaint query using MongoDB geospatial operators.
- Keep map provider calls behind a small integration boundary.

**Exit criteria**
- Selected location is saved accurately.
- Nearby search uses a geospatial index.
- API validates coordinate ranges and coordinate order.
- Map failure does not prevent manual address entry where appropriate.

### Step 4.4 — Build citizen complaint screens

**Screens**
- Complaint list and filters.
- New complaint wizard/form.
- Map/location selection.
- Image evidence upload.
- Complaint detail and timeline.
- Citizen profile and history.

**Exit criteria**
- Full citizen submission flow works against the real API.
- Forms show field-level validation.
- Upload progress, retry, empty, loading and error states are implemented.

---

## Phase 5 — Complaint Workflow and Administrative Operations

### Step 5.1 — Implement complaint state machine

Canonical lifecycle:

```text
SUBMITTED
   |
UNDER_REVIEW
   |--------------------|
VERIFIED              REJECTED
   |
ASSIGNED
   |
IN_PROGRESS
   |
RESOLVED
   |
CLOSED
```

**Tasks**
- Implement allowed transitions in one backend domain service.
- Require rejection reason.
- Require assignment details before `ASSIGNED`.
- Require officer remarks and resolution evidence where applicable.
- Record actor, timestamp, previous state, next state and remarks.
- Reject invalid transitions with a clear domain error.
- Make updates atomic to avoid concurrent conflicting transitions.

**Exit criteria**
- Unit tests cover every allowed and forbidden transition.
- Concurrent updates cannot silently overwrite one another.
- Status history is created in the same transaction/session strategy as the state change where supported.

### Step 5.2 — Build admin complaint review

**Tasks**
- Admin complaint queue with search and filters.
- Complaint detail with evidence and map.
- Verify or reject with reason.
- Set priority.
- Assign department and officer.
- Reassign with reason.
- View status history and audit trail.

### Step 5.3 — Build officer workspace

**Tasks**
- Assigned complaint queue.
- Complaint detail with location and evidence.
- Accept/start work.
- Add progress remarks.
- Mark resolved with resolution evidence.
- View due date and priority.
- Prevent officers from modifying complaints outside their scope.

### Step 5.4 — Implement assignment integrity

**Tasks**
- Validate officer belongs to the selected department.
- Ensure complaint is in a valid assignable state.
- Use optimistic concurrency/version checks or an atomic conditional update.
- Record assignment history.
- Notify affected users after a successful assignment.

**Exit criteria**
- Admin can verify, reject and assign.
- Officer can process only authorized complaints.
- Invalid assignment and status operations are rejected server-side.

---

## Phase 6 — Real-Time Notifications

### Step 6.1 — Implement notification persistence

**Tasks**
- Create notification service and persistence model.
- Generate notifications for submission acknowledgement, verification/rejection, assignment, status changes and resolution.
- Add read/unread state and pagination.
- Ensure notification creation is tied to successful domain operations.

### Step 6.2 — Add Socket.io

**Tasks**
- Authenticate socket connections using the same trusted session/token strategy.
- Join users to server-authorized rooms.
- Emit only events the recipient is allowed to receive.
- Use stable event names and typed payloads.
- Handle reconnect and missed events by fetching persisted notifications.
- Do not treat socket events as the source of truth; MongoDB remains authoritative.

**Exit criteria**
- Authorized users receive relevant updates in real time.
- Users cannot subscribe to another user's private room.
- Reconnect does not lose durable notifications.

---

## Phase 7 — Analytics and Reporting

### Step 7.1 — Define analytics API contracts

**Metrics**
- Total complaints.
- Open, in-progress, resolved and rejected complaints.
- Complaints by category and status.
- Monthly complaint trend.
- Average resolution time.
- Department workload and performance.
- Overdue complaints.
- Geographic distribution where appropriate.

### Step 7.2 — Implement MongoDB aggregation pipelines

**Tasks**
- Aggregate metrics server-side.
- Apply admin/department scope restrictions.
- Validate date ranges and filters.
- Add indexes based on observed query patterns.
- Avoid loading all complaints into application memory.
- Define how cancelled, rejected and reopened records affect metrics.

### Step 7.3 — Build analytics UI

**Tasks**
- KPI cards.
- Trend line/area chart.
- Category distribution.
- Status distribution.
- Department performance table/chart.
- Date range and department filters.
- Loading, no-data and error states.
- Accessible chart labels and tabular alternatives.

**Exit criteria**
- Charts use live API data.
- Totals reconcile with filtered complaint records.
- Expensive aggregations are bounded and measured.

---

## Phase 8 — Duplicate Suggestions and SLA Escalation

### Step 8.1 — Implement duplicate candidate suggestions

**Candidate signals**
- Same or related category.
- Geographic distance within a configurable radius.
- Text similarity.
- Recentness and current status.

**Rules**
- Suggestions are advisory for admins.
- Never auto-reject a complaint.
- Show why two complaints were suggested as duplicates.
- Allow admin to dismiss or link records.
- Preserve the original complaint and audit the decision.

### Step 8.2 — Implement SLA policy

**Tasks**
- Define configurable target durations by category and priority.
- Calculate due dates on verification/assignment according to the approved policy.
- Define pause/resume behavior if required.
- Mark overdue records using a reliable scheduled mechanism.
- Record escalation events and notify the appropriate admin/department.
- Make escalation processing idempotent so repeated execution does not duplicate events.

**Important:** If the deployment platform cannot guarantee a persistent scheduler, use a supported scheduled trigger or external cron service. Do not rely on an in-memory `setInterval` in a serverless or ephemeral process.

**Exit criteria**
- SLA calculation is deterministic and tested.
- Re-running overdue checks does not duplicate escalations.
- Admin can inspect overdue complaints and escalation history.

---

## Phase 9 — Testing, Security and Quality Hardening

### Step 9.1 — Backend test coverage

Add tests for:
- Auth registration/login/logout/refresh.
- RBAC and object-level authorization.
- Complaint CRUD and ownership.
- Status transition state machine.
- Assignment integrity and concurrent updates.
- S3 authorization and metadata validation.
- Geospatial query validation.
- Notification authorization.
- Analytics filters and aggregation results.
- Duplicate suggestion behavior.
- SLA idempotency.

Use Jest and Supertest. Use isolated test databases and deterministic fixtures.

### Step 9.2 — Frontend tests

Add Vitest tests for:
- Form validation.
- Role-aware navigation.
- Complaint status display.
- Upload states.
- Error and empty states.
- Critical component behavior.

### Step 9.3 — End-to-end tests

Use a browser E2E framework if available in the project toolchain. Cover at least:
1. Citizen registers/logs in.
2. Citizen creates a complaint with map location and image.
3. Admin verifies and assigns it.
4. Officer updates progress and resolves it.
5. Citizen sees the timeline and submits feedback.

### Step 9.4 — Security review

Checklist:
- [ ] Password hashing and token lifecycle reviewed.
- [ ] Cookie flags and CSRF protection verified.
- [ ] CORS allowlist is strict.
- [ ] Rate limits cover authentication and upload authorization.
- [ ] Every sensitive endpoint has role and object-level authorization.
- [ ] Request schemas reject unexpected or malformed input.
- [ ] MongoDB query operators cannot be injected through user input.
- [ ] S3 bucket is private; signed URLs expire.
- [ ] File size/type and upload ownership are checked.
- [ ] Secrets are not committed or logged.
- [ ] Error responses do not leak stack traces.
- [ ] Audit logs cover privileged actions.
- [ ] Dependencies are checked for known vulnerabilities.

### Step 9.5 — Performance and reliability review

- Add pagination to every potentially large collection endpoint.
- Inspect slow MongoDB queries and query plans.
- Avoid N+1 database access patterns.
- Bound analytics date ranges and aggregation workloads.
- Add request timeouts and graceful shutdown.
- Verify Socket.io reconnect behavior.
- Test with realistic seed data volumes.
- Document known limits rather than claiming unmeasured performance.

**Exit criteria**
- Critical workflow tests pass.
- Security checklist has no unresolved critical/high issue.
- Build, lint and typecheck pass in CI.

---

## Phase 10 — Deployment and Release

### Step 10.1 — Prepare production configuration

**Tasks**
- Create production MongoDB database and restricted database user.
- Create private S3 bucket with encryption and least-privilege IAM.
- Configure Ola Maps credentials and allowed origins.
- Configure API and web environment variables.
- Configure trusted CORS origins and cookie domain strategy.
- Configure production logging and health checks.

### Step 10.2 — Deploy API

**Tasks**
- Deploy Express API to Render.
- Configure build/start commands.
- Configure health check path.
- Configure persistent environment variables.
- Verify database connectivity and Socket.io behavior.
- Confirm the selected Render service supports the required long-lived connections.

### Step 10.3 — Deploy frontend

**Tasks**
- Deploy Next.js app to Vercel.
- Configure API base URL.
- Configure public map key only if safe for browser exposure.
- Verify cookie-based authentication across the deployed origins.
- Verify CORS and CSRF configuration.

### Step 10.4 — Production smoke test

Run the complete citizen → admin → officer → citizen workflow in production using test accounts and non-sensitive sample data.

**Exit criteria**
- Production health checks pass.
- Login and cookies work on deployed domains.
- S3 uploads and signed reads work.
- Map, API and socket connections work.
- Critical user journey succeeds.
- Rollback/redeployment steps are documented.

---

## Phase 11 — Final-Year Project and Portfolio Deliverables

Prepare:
- [ ] Final README with architecture, features and setup.
- [ ] Architecture diagram and ER/data model diagram.
- [ ] API documentation (Swagger/OpenAPI).
- [ ] Screenshots of citizen, admin and officer workflows.
- [ ] Test report with actual results.
- [ ] Security and limitations section.
- [ ] Deployment guide.
- [ ] Demo accounts with non-production credentials.
- [ ] Short demo video.
- [ ] Final-year report: problem statement, objectives, methodology, implementation, testing, results and future scope.
- [ ] Resume project entry with truthful, measurable contributions.

Do not claim performance improvements, user adoption or resolution-time gains unless they were measured.

---

## 6. Suggested Milestone Schedule

Estimates are for planning only; adjust after repository inspection and actual progress.

| Milestone | Scope | Suggested duration | Demonstrable result |
|---|---|---:|---|
| M0 | Repository and foundation | 1–2 days | Running web and API apps |
| M1 | Backend and database | 2–3 days | API health + core models |
| M2 | Authentication and RBAC | 3–4 days | Clerk sign-in with backend-enforced role-based access |
| M3 | UI foundation | 2–4 days | Premium responsive shells |
| M4 | Citizen complaints, S3 and maps | 4–6 days | Citizen can submit a geo-tagged complaint |
| M5 | Admin and officer workflows | 4–6 days | Complaint can be assigned and resolved |
| M6 | Notifications | 2–3 days | Persisted and real-time updates |
| M7 | Analytics | 2–4 days | Live operational dashboard |
| M8 | Duplicate and SLA | 3–5 days | Advisory duplicate and overdue workflows |
| M9 | QA and deployment | 4–6 days | Tested deployed MVP |

These durations are not commitments. Do not cut authorization, testing or data integrity to meet an arbitrary date.

---

## 7. Recommended Build Order and MVP Boundary

### MVP — must work end-to-end

1. Repository and application foundation.
2. Authentication and RBAC.
3. Citizen complaint creation with image and location.
4. Admin verification/rejection and assignment.
5. Officer progress updates and resolution evidence.
6. Citizen complaint timeline.
7. Basic persisted notifications.
8. Core admin dashboard.
9. Tests, security checks and deployment.

### Advanced features — after MVP is stable

1. Real-time Socket.io updates.
2. Detailed analytics and department performance.
3. Duplicate complaint suggestions.
4. SLA rules and escalations.
5. Advanced geographic analytics and reporting.

A polished, secure, fully working MVP is more valuable than a broad application with incomplete or simulated workflows.

---

## 8. Antigravity Prompt Template

Use the following prompt for **one step only**. Replace the placeholders before submitting.

```text
You are implementing CivicTrack, a production-minded modular monolith.

Before changing code:
1. Read docs/01_PRD_Product_Requirements.md.
2. Read docs/02_SYSTEM_ARCHITECTURE.md.
3. Read docs/03_UI_UX_DESIGN_SYSTEM.md.
4. Read docs/IMPLEMENTATION_PLAN.md.
5. Inspect the existing repository and current Git diff.

Current task: [INSERT ONE STEP ID AND TITLE]

Rules:
- Implement only this task. Do not start future steps.
- Preserve the locked stack and architecture.
- Do not rewrite unrelated files.
- Use TypeScript strict mode and Zod validation.
- Use Clerk for identity/session authentication; verify sessions in the Express API with the official Clerk backend SDK. Enforce application roles and object-level authorization in the CivicTrack backend.
- Add structured logging and safe error handling.
- Add or update tests for the behavior changed.
- Do not use fake data to represent a completed backend integration.
- Follow the premium black/graphite + teal/cyan UI system. No purple, violet, lavender, magenta or indigo.
- Do not expose secrets or credentials.
- If a requirement is ambiguous or conflicts with the source documents, stop and report it instead of guessing.

Before implementation:
- State the intended design and files to change.
- Identify dependencies, risks and acceptance criteria.

After implementation:
- List files changed and explain why.
- List commands executed and their actual results.
- Report tests, lint, typecheck and build status.
- Report security considerations and known limitations.
- Provide manual verification steps.
- Stop and wait for review. Do not proceed to the next step.
```

### Recovery prompt when Antigravity makes an incorrect change

```text
Stop implementation. Inspect the current Git diff and identify the smallest change that fixes the issue. Do not discard unrelated work, do not use destructive Git commands, and do not rewrite files that are not required. Explain the root cause, apply the minimal fix, rerun the relevant tests, and report the result.
```

---

## 9. Git Commit Strategy

Use small, reviewable commits. Suggested sequence:

```bash
git add .
git commit -m "chore: initialize CivicTrack monorepo"

git add .
git commit -m "feat(api): add Express foundation and health endpoint"

git add .
git commit -m "feat(db): add core MongoDB models and indexes"

git add .
git commit -m "feat(auth): integrate Clerk and implement backend RBAC"

git add .
git commit -m "feat(web): establish CivicTrack design system and app shells"

git add .
git commit -m "feat(complaints): implement citizen complaint workflow"

git add .
git commit -m "feat(storage): add secure S3 upload flow"

git add .
git commit -m "feat(maps): integrate Ola Maps location selection"

git add .
git commit -m "feat(workflow): add admin review and officer assignment"

git add .
git commit -m "feat(notifications): add persisted and real-time notifications"

git add .
git commit -m "feat(analytics): add complaint analytics dashboard"

git add .
git commit -m "feat(operations): add duplicate suggestions and SLA escalation"

git add .
git commit -m "test: harden critical workflows and authorization"

git add .
git commit -m "chore(deploy): add production deployment documentation"
```

Only commit after reviewing the staged diff. Adjust commit boundaries to match actual work; do not create empty commits just to match this list.

---

## 10. Final Release Gate

CivicTrack is ready for final demonstration only when:

- [ ] Citizen can register, log in and submit a complaint.
- [ ] Complaint includes valid location and private image evidence.
- [ ] Admin can verify/reject and assign a complaint.
- [ ] Officer can update progress and submit resolution evidence.
- [ ] Citizen can view the complete status timeline.
- [ ] Authorization prevents cross-user and cross-department data access.
- [ ] Important operations are audited.
- [ ] Notifications are persisted and delivered to authorized recipients.
- [ ] Analytics reflect actual database records.
- [ ] Critical automated tests pass.
- [ ] Production deployment and environment setup are documented.
- [ ] No known critical/high security issue remains unresolved.
- [ ] Demo and final-year documentation are ready.

**Release principle:** correctness, authorization and traceability take priority over feature count and visual polish.

---

# 11. Complete Frontend UI/UX Design System Implementation Plan
*(Reference: `docs/civictrack_frontend.tsx` — Warm Sandstone + Terracotta + Forest Charcoal)*

### 11.1 Reference UI Deep Analysis & Design Tokens

#### Visual Identity
- **Design Metaphor:** Warm Nordic Sandstone + Terracotta + Forest Charcoal Civic Ledger.
- **Light Theme Tokens:**
  - Page Background: `#F6F3EC` (`hsl(42, 27%, 94%)`)
  - Card & Surface Background: `#FCFAF6` (`hsl(40, 40%, 98%)`)
  - Header & Nav Background: `#FCFAF6` with subtle backdrop blur
  - Primary Brand Accent: `#D95D39` (`hsl(13, 67%, 54%)`) — Terracotta
  - Primary Hover: `#C34E2C` (`hsl(13, 63%, 47%)`)
  - Main Body Text: `#1C1B18` (`hsl(45, 8%, 10%)`)
  - Structural Borders: `#E2DBD0` (`hsl(38, 23%, 85%)`)
  - Secondary Inset Surface: `#F2EEE6` (`hsl(40, 24%, 93%)`)
- **Dark Theme Tokens:**
  - Page Background: `#121514` (`hsl(160, 7%, 7%)`) — Forest Charcoal
  - Card & Surface Background: `#181C1A` (`hsl(150, 8%, 10%)`)
  - Header & Nav Background: `#171B19` (`hsl(150, 7%, 9%)`)
  - Primary Brand Accent: `#D95D39` (`hsl(13, 67%, 54%)`)
  - Primary Hover: `#C34E2C` (`hsl(13, 63%, 47%)`)
  - Main Body Text: `#F2EFE9` (`hsl(38, 23%, 93%)`)
  - Structural Borders: `#2A302D` (`hsl(150, 7%, 18%)`)
  - Secondary Inset Surface: `#111413` (`hsl(150, 7%, 7%)`)
- **Typography:**
  - Display Headings: `'Fraunces', Georgia, serif` (`font-display`, `tracking-tight`)
  - Primary Body & Interface: `'Plus Jakarta Sans', -apple-system, sans-serif` (`font-sans`)
  - Code, IDs, Coordinates & Metadata: `'JetBrains Mono', monospace` (`font-mono-code` / `font-mono`)
- **Card & Geometry Styling:**
  - Cards: `rounded-2xl border bg-card` with subtle drop shadows
  - Buttons: Terracotta primary button (`bg-[#d95d39] hover:bg-[#c34e2c] text-white font-semibold rounded-xl transition`)
  - Status & Priority Badges: Semantic pill badges with glowing dot indicators
  - Interactive Map: Ola Maps Web SDK canvas with 3 styles (Editorial Atlas, Satellite, Relief/Terrain)

### 11.2 Component & Portal Mapping Matrix

| Reference UI Section | Existing CivicTrack Location | Target Production Implementation |
|---|---|---|
| Color Tokens & CSS Variables | `apps/web/src/app/globals.css`, `tailwind.config.ts` | Configured Warm Sandstone & Forest Charcoal HSL variables, Terracotta primary accent, Fraunces/Plus Jakarta Sans/JetBrains Mono fonts |
| Theme Provider & Toggle | `apps/web/src/components/theme/theme-provider.tsx`, `theme-toggle.tsx` | React Context managing `dark`/`light` mode, persisting to `localStorage`, and syncing `html.dark` class |
| Shared Navigation Shells | `apps/web/src/components/layout/*` | Universal persona switcher pills (`PUBLIC`, `CITIZEN`, `ADMIN`, `OFFICER`), sub-navigation bar, UserButton, NotificationBell, ThemeToggle |
| Public Landing Page | `apps/web/src/app/page.tsx` | Hero section, Real-time metrics strip, "How CivicTrack Works" 4-step cards, Supported Categories & SLA targets, Track Reference search |
| Public Civic Map | `apps/web/src/app/map/page.tsx` | Ola Maps live municipal issues atlas, 10km proximity filters, incident list, complaint location pin picker with GPS radar beacon |
| Citizen Dashboard | `apps/web/src/app/citizen/page.tsx` | Welcome banner, 3 KPI cards (Total, Active, Resolved), recent complaints list, compact nearby Ola Map preview |
| Citizen Report Wizard | `apps/web/src/app/citizen/report/page.tsx` | 4-step wizard (1. Category & Details, 2. Ola Map Pin & GPS, 3. Private S3 Evidence Upload, 4. Review & Submit with `CT-YYYY-NNNNNN` ref) |
| Citizen Complaints List | `apps/web/src/app/citizen/complaints/page.tsx` | Search, status filter tabs, complaint cards with reference badges, status pills, category labels |
| Complaint Details & Feedback | `apps/web/src/app/citizen/complaints/[id]/page.tsx` | Detail view, S3 evidence gallery, immutable vertical status audit timeline, interactive 1-5 star rating and feedback advancing `RESOLVED` to `CLOSED` |
| Admin Operations & Triage | `apps/web/src/app/admin/page.tsx` | 4 KPI cards (Total, Review, Overdue, Resolution %), cluster map, triage table with `Duplicate? X%` badge, Verify & Assign modal, Reject modal |
| Admin Analytics & SLA | `apps/web/src/app/admin/analytics/page.tsx` | Idempotent SLA scan trigger, Category distribution progress bars, Department workload & SLA adherence matrix |
| Admin Departments & Officers | `apps/web/src/app/admin/departments/page.tsx`, `apps/web/src/app/admin/officers/page.tsx` | Department management and officer roster with active task count and resolved statistics |
| Officer Field Workspace | `apps/web/src/app/officer/page.tsx` | Assigned queue, GPS telemetry indicator, Start Field Work action (`IN_PROGRESS`), Submit Resolution modal with S3 proof |

### 11.3 Implementation Phases & Execution Order

1. **Phase 1: Project & Reference Analysis (COMPLETED)**
   - Audit repository tree, existing Next.js architecture, Clerk authentication, Express API contracts, and complete `civictrack_frontend.tsx`.
2. **Phase 2: Design Tokens, Fonts & Theme System**
   - Import Google Fonts (Fraunces, Plus Jakarta Sans, JetBrains Mono) in `globals.css`.
   - Update HSL variables in `globals.css` for light (Sandstone) and dark (Forest Charcoal).
   - Update `tailwind.config.ts` font families (`font-display`, `font-sans`, `font-mono`).
   - Implement `ThemeProvider` and `ThemeToggle` with persistent `localStorage` support.
3. **Phase 3: Shared Application Shell & Navigation**
   - Update `CitizenShell`, `AdminShell`, and `OfficerShell` to adopt the reference header layout, persona pills, theme toggle, and sub-navigation bar.
4. **Phase 4: Public Portal (`/`, `/map`)**
   - Overhaul `apps/web/src/app/page.tsx` with reference Hero, Metrics strip, How CivicTrack Works steps, Category SLAs, and Track Reference search.
   - Refine `apps/web/src/app/map/page.tsx` with the reference atlas styling and controls.
5. **Phase 5: Citizen Portal (`/citizen`, `/citizen/report`, `/citizen/complaints`)**
   - Update Citizen Dashboard (`/citizen`) with KPI cards and split layout.
   - Overhaul `/citizen/report` into the 4-step wizard adhering to the reference visual design.
   - Update `/citizen/complaints` and `[id]/page.tsx` with the reference card layouts, S3 evidence cards, audit timeline, and 5-star resolution feedback.
6. **Phase 6: Admin Portal (`/admin`, `/admin/analytics`, `/admin/departments`, `/admin/officers`)**
   - Update `/admin` with 4 KPI cards, cluster map, triage table, Verify & Assign modal, and Reject modal.
   - Update `/admin/analytics` with the reference category distribution chart and department workload matrix.
   - Update `/admin/departments` and `/admin/officers` with the reference officer cards.
7. **Phase 7: Officer Portal (`/officer`)**
   - Update Officer workspace with assigned queue, Start Field Work button, and Submit Resolution modal.
8. **Phase 8: Maps, S3 Uploads, Socket.io & Backend Integration Verification**
   - Ensure real backend APIs, Ola Maps, AWS S3 upload/download, and Socket.io notifications remain fully wired.
9. **Phase 9: Responsive Design & Accessibility Hardening**
   - Verify mobile drawer, touch targets, contrast ratios, and keyboard navigation.
10. **Phase 10: Testing, Quality Gates & Production Build**
    - Run typecheck, server tests, and Next.js 16.4.6 production build to ensure 0 errors.
