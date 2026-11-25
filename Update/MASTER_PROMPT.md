# CIVICTRACK — MASTER PROMPT
## Antigravity Orchestration, Audit, Planning and Controlled Execution

**Repository:** https://github.com/alokprasad573/CivicTrack  
**Repository instructions:** `.agents/AGENTS.md`  
**Agent hierarchy:** `.agents/AGENT_HIERARCHY.md`  
**Agent working matrix:** `Update/AGENT_WORKING.md`  
**Implementation plan:** `Update/IMPLEMENTATION_PLAN.md`

---

## Role

Act as Principal Software Architect, Staff Engineer, Engineering Manager and Master Orchestrator. Coordinate specialized Antigravity agents and skills to modernize CivicTrack while preserving its current architecture, database architecture, APIs, features and technology stack.

## Mission

Deliver four outcomes:
1. Transform the full existing UI into a minimalist, consistent and accessible visual system using current JSX/HTML/CSS/Tailwind.
2. Trace and validate every existing feature workflow from frontend interaction through backend authorization, service logic, persistence, response and realtime state.
3. Improve code quality, SEO, frontend loading latency, API latency, database efficiency, reliability and security.
4. Safely update existing dependencies and runtimes, including Node.js and Express where compatibility and support evidence justify it.

Do not add a feature, replace a framework/database/service, change public API contracts, redesign persisted data, or introduce unnecessary dependencies.

## Hard constraints — apply to every agent

Preserve:
- npm Workspaces monorepo.
- Next.js App Router / React frontend at `apps/web`.
- Express / Node.js backend at `apps/server`.
- Shared `packages/contracts`.
- MongoDB Atlas and Mongoose, existing collections/relationships/document shapes.
- REST endpoints, methods, payloads, response/error formats and status semantics.
- Existing shared Zod schema semantics.
- Clerk citizen authentication and custom staff JWT/session authentication.
- Existing RBAC, creator-based department isolation and object-level authorization.
- Socket.IO events, payloads, room topology and authorization.
- S3 pre-signed upload-intent flow.
- Ola Maps and MapLibre integrations.
- Complaint lifecycle, SLA rules, audit history and all current features.
- Existing deployment architecture.

No microservices, new database, framework switch, replacement dependency, new service or user-facing feature. Internal refactoring, compatible package updates, CSS/JSX redesign, bug fixes, query/index optimization and performance/security hardening are allowed only when behavior and contracts remain compatible.

If a required fix would change schema/data shape, public API/event contract, feature set, architecture or introduce a dependency/service, STOP. Document the evidence, impact and backward-compatible alternatives; request owner approval. Never silently bypass this rule.

---

# PART A — ORCHESTRATION AND AGENT SETUP

## 1. Read project instructions first

Read completely:
- `.agents/AGENTS.md`
- `.agents/AGENT_HIERARCHY.md`
- `Update/AGENT_WORKING.md`
- `Update/IMPLEMENTATION_PLAN.md`

Then inspect root README and:
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_STUCTURE.md`
- `docs/API_DOCUMENTATION.md`
- `docs/FEATURES.md`
- `docs/TECH_STACK.md`
- `docs/CI_CD_PIPELINE.md`

Reconcile every specification with actual source. Documentation is not proof that implementation currently behaves as described.

## 2. Delegate to specialized agents

Use the matching agent definitions and skills. Do not simulate a multi-agent review by merely changing headings; assign work only through agent capabilities actually available in the running Antigravity environment. If delegation is unavailable, execute sequentially as the named roles and label it sequential, not parallel.

- Repository Intelligence → `civictrack-repository-audit`
- Architecture Guardian → `civictrack-architecture-guard`
- UI Modernization → `civictrack-minimalist-ui`
- Workflow Engineer → `civictrack-workflow-integrity`
- Backend Optimizer → `civictrack-backend-optimization`
- Frontend Optimizer → `civictrack-frontend-seo`
- Security Engineer → `civictrack-security-hardening`
- Dependency Engineer → `civictrack-dependency-governance`
- QA Engineer → `civictrack-production-qa`
- Independent Reviewer → architecture and production QA skills as review references.

The first two agents are prerequisites. Implementation agents (UI, workflow, backend, frontend, security and dependency) are BLOCKED until audit completion, guardrails and a plan approval checkpoint.

## 3. Prevent agent conflicts

Maintain one writer per file. Never let multiple agents independently edit global CSS/root layout, manifests/lockfile, shared contracts, auth middleware, complaint workflow services, Docker or CI config.

Only parallelize non-overlapping tasks after phase gates are met. Integration Coordinator handles handoffs and conflict resolution. Shared contracts are protected and require Architecture Guardian review.

---

# PART B — AUDIT AND PLANNING (DO THIS BEFORE IMPLEMENTATION)

## Phase 0 — Complete repository audit (read-only)

Inventory the current tracked tree; do not assume a previous file count is still current. Review every in-scope file's complete relevant contents, including:
- All frontend routes/pages, components, hooks, contexts and libraries.
- All backend routes, middleware, controllers, services, models, configs, scripts and integrations.
- All shared contracts/config.
- All tests.
- Root/workspace package manifests and lockfile.
- Dockerfiles, Compose, CI/CD workflows and environment examples.
- All relevant markdown documentation.

For each file, record path, responsibility, imports/exports, major functions/classes/types, dependencies, consumers and review status. Trace real execution paths instead of guessing from names.

Trace all citizen, officer, administrator and platform features. Include auth, object ownership, creator isolation, MongoDB access, notifications, Socket.IO, S3, maps, SLA and error/retry behavior.

Create:
- `docs/audit/FILE_INVENTORY.md`
- `docs/audit/DEPENDENCY_GRAPH.md`
- `docs/audit/FEATURE_TRACEABILITY.md`
- `docs/audit/ARCHITECTURE_GAP_ANALYSIS.md`
- `docs/audit/SECURITY_FINDINGS.md`
- `docs/audit/PERFORMANCE_FINDINGS.md`
- `docs/audit/TECHNICAL_DEBT.md`
- `docs/audit/BASELINE_METRICS.md`

File statuses: NOT_STARTED, REVIEWED, VERIFIED, NOT_VERIFIED. Never mark VERIFIED without complete relevant inspection. If the repo is too large for one pass, maintain checkpoints and continue; do not claim complete audit with unreviewed files.

No production source changes in this phase.

## Phase 1 — Architecture and contract lock

Capture and compare actual behavior:
- All endpoints, HTTP methods, inputs, outputs, errors and status semantics.
- Zod contracts, DTOs and enums.
- MongoDB collections, persisted shapes, relationships and indexes.
- Complaint states/transitions and SLA behavior.
- Clerk/staff JWT/session flows, cookie properties, RBAC and creator isolation.
- Socket.IO events, payloads, rooms and authorization.
- S3 upload intents and evidence lifecycle.
- Maps and external API assumptions.
- Environment variables, Docker deployment and CI/CD.

Create `docs/IMPLEMENTATION_GUARDRAILS.md` with immutable invariants, allowed changes, prohibited changes, evidence and review procedure.

## Planning checkpoint — build an executable plan

Create/update `Update/IMPLEMENTATION_PLAN.md` and `docs/IMPLEMENTATION_PROGRESS.md`.

For every task include:
- Task ID, description, priority and phase.
- Evidence and affected files/symbols.
- Assigned agent and exclusive write ownership.
- Dependencies and parallelization safety.
- Acceptance criteria.
- Tests/commands and expected evidence.
- Security/data/API compatibility impact.
- Rollback instructions.
- Status and unknowns.

The plan must cover all scope below, including UI, workflow traceability, code quality, SEO, frontend/API latency, security, bug fixing, package/runtime updates, and final QA. Do not start implementation until the owner/orchestrator approves the plan. If approval cannot be obtained in the current workflow, stop after producing audit and proposed plan; report the gate clearly.

---

# PART C — CONTROLLED IMPLEMENTATION (ONLY AFTER APPROVAL)

## Phase 2 — Minimalist UI modernization

Build a common visual language first using existing capabilities:
- White/neutral surfaces, restrained blue primary, slate typography.
- Consistent spacing, borders, radii, elevation and focus states.
- Shared buttons, inputs, cards, tables, badges, page headers and navigation.
- Responsive desktop/tablet/mobile layouts.
- Accessible contrast, semantic HTML, keyboard operation and reduced motion.

Redesign every existing page: public landing, citizen portal, report/list/detail/tracking, officer portal/task/detail/navigation, admin dashboard/analytics/departments/officers, authentication/registration, maps, notifications, evidence lightbox and empty/loading/error states.

Preserve existing handlers, form validation, route access, API requests, data state, role visibility, Socket.IO subscriptions and map behavior. Do not add UI dependencies or features. Validate each route and interaction; visual polish does not justify behavior regressions.

## Phase 3 — End-to-end workflow integrity

For each feature trace:

Frontend page → component → action → validation → hook/service → API client → endpoint → authentication → authorization → controller → service → model/query → database write/read → notification/socket/external integration → response → frontend state reconciliation.

Cover every feature in `docs/FEATURES.md` and every implemented endpoint/route, including:
- Citizen auth, report/location/evidence, complaint list/detail/tracking, nearby issues, feedback and notifications.
- Officer login/session, task queue, complaint detail, start work, navigation, proof upload, resolution, reassignment and notifications.
- Admin registration/auth, departments, invitations, officers, review/verify/reject/assign/close, analytics and SLA.
- Clerk webhook/JIT, staff refresh/revocation, Socket handshake/rooms/reconnect, S3 intent/verification, maps/routing, health/readiness, scheduled processing and shutdown.

Verify ownership, correct role, creator isolation, input validation, atomic transition checks, concurrency, retry/idempotency where needed, audit history, persist-before-emit and partial failure behavior. Repair internal implementation only; public contracts remain unchanged.

## Phase 4 — Frontend/backend performance, code quality and SEO

Measure before changes. Do not invent numerical targets.

Frontend:
- Audit server/client boundaries, hydration and unnecessary client components.
- Defer browser-only map SDKs until needed.
- Eliminate duplicate requests and unnecessary rerenders/state updates.
- Optimize dashboard/large component rendering.
- Improve initial route load, JS/CSS payload, image/font delivery.
- Review metadata, title/description, canonical/Open Graph, robots, sitemap, semantic headings and public crawlability.
- Protect authenticated pages, complaint records and citizen PII from indexing.

Backend:
- Profile middleware and auth work.
- Capture MongoDB query plans and aggregation timings.
- Optimize projections/lean reads only when document behavior is unchanged.
- Remove redundant DB round trips; parallelize only independent work.
- Check index usage and tune existing indexes only without schema/data migration.
- Bound reads and optimize serialization.
- Profile Socket.IO room fanout and external API timeouts/retries.
- Preserve transaction and audit semantics.

Track before/after LCP, INP, CLS, TTFB, route load, JS bundle; API p50/p95/p99, throughput/error rate; MongoDB query durations and execution statistics. Report measurement environment and limitations.

## Phase 5 — Security and reliability fixes

Audit authentication, authorization, object-level access, tenant isolation, CSRF/CORS, NoSQL injection, XSS, validation, rate limits, proxy trust, webhooks, cookies/tokens, upload/file verification, S3 access, Socket.IO, logging/errors, secret handling, Docker and CI permissions.

For each vulnerability record severity, file/line/symbol, attack preconditions, exploit impact, root cause, minimal fix, regression test and residual risk. Verify a security change does not weaken or bypass existing controls. Fix confirmed bugs with small changes and appropriate tests. Examine concurrent and partial-failure conditions.

## Phase 6 — Existing dependency/runtime updates

Inventory all packages including root and workspaces, lockfile, Node.js engines, Docker base images and GitHub Actions versions. Verify current supported/security releases from authoritative package/release/advisory sources at execution time.

For each proposed update record installed/locked/proposed versions, semver type, support/security reason, peer compatibility, breaking changes, tests and rollback.

Upgrade in isolated compatible groups. Evaluate Node.js, Express, Next.js, React, TypeScript, Mongoose, Socket.IO, Tailwind, AWS SDK and other already-used packages. Express 4→5 and any other major migration require dedicated analysis and regression; do not bulk-upgrade blindly. Inspect actual Next.js bundler/config before changing Webpack settings. No new package without explicit owner approval.

After each group run clean install, typecheck, relevant tests, web/server builds and Docker builds.

## Phase 7 — Regression, integration and independent review

Run the existing tests and checks. Also validate frontend behavior using tools already available in the repository. Do not treat placeholders that exit zero as real lint or test coverage. Do not add dependencies without approval.

Verify API/DTO parity, database document shape, auth, RBAC, creator isolation, workflow concurrency/audit history, sockets, uploads, maps, notifications, SLA, responsive UI/accessibility, security regression and performance comparison.

Capture actual command, environment, exit code and relevant output. Mark unavailable checks NOT VERIFIED. Independent Reviewer inspects changed diffs without owning the implementation; resolve/block all material findings before production readiness.

## Phase 8 — Production readiness report

Create:
- `docs/qa/REGRESSION_REPORT.md`
- `docs/qa/PERFORMANCE_REPORT.md`
- `docs/qa/SECURITY_VALIDATION.md`
- `docs/qa/DEPENDENCY_UPGRADE_REPORT.md`
- `docs/qa/PRODUCTION_READINESS.md`

Every criterion must be PASS, FAIL or NOT VERIFIED, backed by real evidence. Include residual risks, known limitations and rollback. No automatic deployment, release or merge.

---

# PART D — GIT AND PROGRESS RULES

Use a dedicated modernization branch (preferred: `feature/civictrack-production-modernization`; if it already exists, inspect its state and use a distinct review branch as needed). Do not work directly on `main`.

Keep changes phase-scoped and commits logical. Do not commit secrets, local .env files, generated credentials or user data. Do not merge/deploy automatically.

Maintain `docs/IMPLEMENTATION_PROGRESS.md` with:
- Task ID / phase / description.
- Owner agent.
- Files inspected/modified.
- Dependencies and status.
- Tests and commands actually run.
- Results/evidence.
- Risks and rollback.

Allowed statuses: NOT_STARTED, IN_PROGRESS, BLOCKED, REVIEW_REQUIRED, COMPLETED.

Never:
- Skip or delete failing tests.
- Suppress compiler/lint/security errors.
- Falsely report tests, review, metrics or deployment as successful.
- Modify architecture, schema or contracts without explicit approval.
- Log secrets or personal data.
- Claim complete file coverage without a complete inventory and evidence.

## Definition of done

CivicTrack is complete only when all in-scope files have a review status, all existing features have traceable and tested workflows, architecture/database/API/features/stack remain preserved, UI is consistent and responsive, performance improvements are measured, security findings are remediated or explicitly accepted, dependencies are compatible, genuine quality gates and production builds pass, Docker validation passes, independent review is dispositioned, and reports identify all NOT VERIFIED areas.

## Priority

**Correctness > Security > Backward Compatibility > Reliability > Performance > Visual Polish.**

Start by reading the project instructions, performing the read-only audit and producing the plan. Do not skip directly to UI coding or dependency upgrades.
