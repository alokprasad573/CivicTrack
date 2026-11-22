# CivicTrack — Product Requirements Document (PRD)

**Product:** CivicTrack — Smart Civic Complaint Management System  
**Version:** 1.0  
**Audience:** Antigravity coding agent, developers, reviewers, B.Tech project evaluators  
**Product type:** Responsive web application  
**Primary architecture:** Modular monolith with REST APIs and real-time events

## 1. Product vision

CivicTrack connects citizens who report local civic issues with administrators and municipal department officers who verify, assign, investigate, and resolve those issues. It provides transparent complaint tracking, evidence uploads, location-aware reporting, and operational analytics.

Example issue categories:
- Roads and potholes
- Water supply and leakage
- Garbage and sanitation
- Drainage and sewage
- Streetlights
- Public electricity infrastructure
- Other civic issues

CivicTrack is an academic/portfolio product. Do not imply that it is officially connected to a municipality or government department unless a real authorized integration exists.

## 2. Goals

1. Let a citizen submit a complaint with a precise location and photo evidence.
2. Let administrators verify, reject, prioritize, and assign complaints.
3. Let department officers update progress and submit resolution evidence.
4. Let citizens follow the complaint lifecycle and receive timely updates.
5. Give administrators useful operational analytics.
6. Detect possible duplicate reports without silently discarding legitimate complaints.
7. Deliver a polished, accessible, responsive civic-tech experience.

## 3. Non-goals for the first release

- Native Android/iOS apps.
- Direct integration with government databases.
- Real payments.
- Public display of citizen personal information.
- Fully automated AI decisions that reject or close complaints.
- Microservices architecture.
- Production-grade SMS/WhatsApp delivery unless a provider is explicitly configured.

## 4. User roles and permissions

### Citizen
- Register, sign in, sign out, and manage own profile.
- Create complaints and upload evidence.
- Select a location on the map or use browser geolocation after explicit permission.
- View own complaints and their status history.
- View public complaint information only where configured.
- Receive notifications.
- Submit feedback after resolution.

### Admin
- View and filter complaints across the platform.
- Verify or reject submitted complaints with a reason.
- Set priority.
- Assign verified complaints to a department and officer.
- Manage departments and officer accounts.
- Monitor overdue complaints and escalations.
- View analytics and audit events.

### Department officer
- View complaints assigned to that officer or department.
- View relevant complaint details, location, and evidence.
- Change status only through permitted workflow transitions.
- Add progress notes and resolution evidence.
- View due dates and workload.

Enforce authorization on the backend for every protected resource. Hiding UI controls is not authorization.

## 5. Complaint lifecycle

Canonical statuses:
- `SUBMITTED`
- `UNDER_REVIEW`
- `VERIFIED`
- `ASSIGNED`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED`
- `REJECTED`

Expected transitions:
- Citizen creates: `SUBMITTED`
- Admin starts review: `SUBMITTED -> UNDER_REVIEW`
- Admin approves: `UNDER_REVIEW -> VERIFIED`
- Admin rejects with reason: `UNDER_REVIEW -> REJECTED`
- Admin assigns: `VERIFIED -> ASSIGNED`
- Officer starts work: `ASSIGNED -> IN_PROGRESS`
- Officer submits resolution: `IN_PROGRESS -> RESOLVED`
- Citizen confirms or authorized admin closes: `RESOLVED -> CLOSED`

Do not allow arbitrary status changes. Validate transitions in a domain service and persist every transition in `complaint_status_history` within a transaction where supported. If MongoDB deployment does not support transactions, use a carefully designed atomic update plus compensating/error handling.

## 6. Functional requirements

### FR-01 Authentication and application identity
- Use Clerk for registration, sign-in, sign-out, session management, and identity lifecycle.
- Next.js uses the official Clerk Next.js SDK and `ClerkProvider` / Clerk middleware.
- Express verifies Clerk session tokens using the official Clerk backend SDK (`@clerk/express` or the supported Clerk backend SDK flow). Never merely decode a token.
- Maintain a local MongoDB `users` record with a unique `clerkUserId`, normalized email, display name, application role, department membership, `isActive`, and timestamps.
- Resolve application roles (`CITIZEN`, `ADMIN`, `OFFICER`) and department permissions from the trusted MongoDB record. Never trust role, department, ownership, or account status sent by the browser or editable public metadata.
- Synchronize Clerk identity changes through a webhook verified with `CLERK_WEBHOOK_SIGNING_SECRET`; make webhook processing idempotent because delivery can be retried. A carefully designed just-in-time user upsert may be used as a fallback.
- Public sign-up must create only `CITIZEN` accounts. Never allow users to select `ADMIN` or `OFFICER` during public registration. Bootstrap the first admin through a controlled server-side script or manual database operation.
- A locally disabled CivicTrack account must be denied even when its Clerk session remains valid.
- Do not implement custom password hashing, custom access/refresh JWT issuance, or a parallel local login system. Do not store Clerk session tokens in localStorage.
- Apply object-level authorization to every complaint, assignment, notification, and evidence resource.

### FR-02 Complaint creation
Required fields:
- Title
- Description
- Category
- Location coordinates
- Human-readable address where available

Optional fields:
- One or more evidence images, subject to configured limits
- Landmark
- Preferred contact method

Validate text lengths, category enum, coordinate ranges, file type, and file size. Generate a human-readable complaint reference such as `CT-2026-000125`, but use the MongoDB ObjectId as the internal primary key.

### FR-03 Geolocation and maps
- Use Ola Maps for map display, place search, and geocoding only through supported current APIs/SDKs.
- Ask for browser location permission only after the user initiates location detection.
- Always allow manual map pin placement and address entry if permission is denied.
- Store GeoJSON as `[longitude, latitude]`, never latitude first.
- Create a `2dsphere` index for nearby queries.
- Do not expose a user's exact home location on public maps by default.

### FR-04 Evidence image storage
- Store images in a private AWS S3 bucket.
- Backend validates upload intent and issues short-lived pre-signed upload URLs.
- Browser uploads directly to S3.
- Backend verifies expected object key/metadata before attaching it to a complaint.
- Store object key, content type, size, checksum if available, and upload timestamp in MongoDB.
- Serve images through short-lived pre-signed GET URLs or an authenticated image proxy.
- Do not save permanent public S3 URLs.
- Validate actual file content where feasible; do not trust browser-provided MIME type alone.
- Set file size and count limits; reject SVG unless sanitized and explicitly required.

### FR-05 Admin verification and assignment
- Admin reviews complaint details and evidence.
- Admin can verify or reject with a mandatory reason for rejection.
- Admin selects department and optionally officer.
- Assignment operation must be atomic and prevent conflicting concurrent assignments.
- Record actor, timestamp, previous assignment, new assignment, and remarks.

### FR-06 Officer work management
- Officer sees assigned work with filters for status, priority, and due date.
- Officer can add progress remarks.
- Officer can upload resolution evidence.
- Officer can mark a complaint resolved only after required resolution notes/evidence are supplied, according to configurable rules.

### FR-07 Notifications
- Create in-app notification records for key events.
- Use Socket.io to push updates to authorized users.
- Socket rooms must be authorized server-side; never trust a client-supplied user or role identifier.
- Persist notifications so offline users can see them later.
- Socket events are a delivery mechanism, not the source of truth; MongoDB remains authoritative.

### FR-08 Duplicate detection
- Detect *possible* duplicates using category, geospatial distance, and normalized text similarity.
- Return candidates to the admin for review.
- Never automatically reject or merge a complaint based only on similarity.
- Store the detection method and candidate references for explainability.
- Make distance and similarity thresholds configurable.

### FR-09 Analytics
Provide server-side aggregate endpoints for:
- Complaint counts by status
- Complaints by category
- Monthly submission trend
- Department workload and resolution rate
- Average and median resolution duration
- Overdue/SLA counts
- Geographic density for map visualization

Apply role and date filters on the server. Avoid downloading all complaint documents to the browser for aggregation.

### FR-10 SLA and escalation
- Define configurable target resolution durations by category and priority.
- Calculate due dates on the server.
- Identify overdue complaints through a scheduled job.
- Record escalation events and notify responsible admins.
- Do not silently change complaint status merely because an SLA was missed.

### FR-11 Auditability
Record important actions:
- Login security events where appropriate
- Verification/rejection
- Assignment/reassignment
- Status transitions
- Department/officer changes
- SLA escalations
- Administrative changes

Do not log passwords, JWTs, S3 credentials, or unnecessary personal data.

## 7. Non-functional requirements

### Security
- Validate all inputs at API boundaries using Zod.
- Use Helmet, strict CORS allowlists, rate limiting, and Clerk's supported session/cookie or bearer-token integration. Configure CSRF protections appropriate to the selected cross-origin request model.
- Apply object-level authorization to prevent IDOR.
- Keep secrets in environment variables/secret manager.
- Restrict S3 IAM permissions to required bucket/actions.
- Use parameterized/ODM queries and avoid unsafe user-controlled MongoDB operators.
- Protect against XSS, CSRF, brute force, and upload abuse.
- Sanitize user-generated text before rendering where needed.

### Reliability
- Centralized error handling.
- Structured logs with request IDs.
- Health/readiness endpoints.
- Graceful shutdown.
- Retry external-service calls only where safe.
- Idempotency for retry-prone create/assignment operations where appropriate.

### Performance
- Server-side pagination and filtering.
- Index frequently filtered fields.
- Geospatial index for nearby complaints.
- Aggregation pipelines for analytics.
- Lazy-load maps and large dashboard modules.
- Avoid N+1 database query patterns.

### Accessibility and usability
- Responsive desktop, tablet, and mobile layouts.
- Keyboard navigation and visible focus states.
- Proper labels and error messages.
- WCAG-oriented color contrast.
- Do not communicate status by color alone.

## 8. Acceptance criteria for MVP

MVP is acceptable when:
1. Citizen can register/sign in through Clerk and create a complaint.
2. Complaint includes valid GeoJSON location and optional S3 evidence.
3. Citizen can see their complaint list and timeline.
4. Admin can verify/reject and assign a complaint.
5. Officer can update an assigned complaint through valid transitions.
6. Status changes are persisted and visible to authorized users.
7. In-app notifications work and Socket.io updates are permission-checked.
8. Admin dashboard shows server-computed complaint metrics.
9. API validation, authorization, and core workflow tests pass.
10. README documents setup, environment variables, seed users, and deployment.

## 9. Definition of done

A feature is done only when:
- UI states include loading, empty, success, and error.
- API input is validated.
- Authorization is enforced server-side.
- Relevant tests are added.
- Logs are useful but do not leak secrets.
- Documentation is updated.
- No hard-coded secrets or fake production integrations remain.


## 10. Environment configuration and repository layout

The canonical environment variable definitions and exact setup instructions are maintained in `06_ENVIRONMENT_SETUP.md`. Keep separate environment files for each deployable application:
- `apps/web/.env.local` (Next.js; never commit)
- `apps/server/.env` (Express; never commit)

Commit only `.env.example` templates with empty values or obvious placeholders. Do not commit real credentials. The root `.gitignore` must ignore `.env`, `.env.*`, `.env.local`, and equivalent secret files while explicitly allowing `.env.example`.

The canonical monorepo structure is documented in `05_PROJECT_STRUCTURE.md`. Keep browser-safe configuration separate from API secrets.
