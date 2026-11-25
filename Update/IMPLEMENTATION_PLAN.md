# CivicTrack — Implementation Plan

**Repository:** [alokprasad573/CivicTrack](https://github.com/alokprasad573/CivicTrack)  
**Execution model:** Master Orchestrator with specialized agents and an independent reviewer  
**Plan status:** Proposed — audit and guardrail approval required before implementation

## 1. Mission and scope

Modernize the existing CivicTrack application into a production-grade application through:
1. Application-wide minimalist UI modernization using the current frontend and styling stack.
2. Complete frontend-to-backend traceability and repair of existing feature workflows.
3. Code quality, SEO, frontend loading, API and database performance improvements.
4. Security and bug remediation.
5. Safe upgrades to existing runtimes and dependencies.

### 1.1 Immutable constraints

Preserve the current:
- npm Workspaces monorepo and division between `apps/web`, `apps/server` and `packages/contracts`.
- Next.js/React frontend and Express/Node.js backend.
- MongoDB Atlas/Mongoose database architecture, existing collections, persisted document shapes, relationships and data semantics.
- REST API endpoint paths, methods, request/response formats and status semantics.
- Shared Zod contracts, Socket.IO event contracts and room authorization semantics.
- Clerk citizen auth, custom staff JWT/session auth, RBAC and creator-based admin isolation.
- S3 pre-signed upload-intent flow, Ola Maps and MapLibre.
- Complaint workflow, SLA behavior, all current roles and all existing features.
- Existing deployment architecture and package ecosystem.

No feature additions, architecture replacement, database schema redesign/migration, breaking API/contract change, new external service or unnecessary dependency. Any change requiring one of these is a blocker for owner approval, not an implied permission.

## 2. Repository baseline

The reviewed public `main` tree had 204 tracked files at the time of inspection. Confirm the current branch/tree before execution because repository state may have changed.

Documented/declared baseline includes npm Workspaces, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3, Node.js 24, Express 4, MongoDB Atlas/Mongoose, Clerk + custom JWT, Socket.IO, AWS S3, Ola Maps/MapLibre, shared Zod contracts, Docker/Compose and GitHub Actions.

The source review surfaced items to verify, not automatically fix:
- `apps/web/package.json` uses `tsc --noEmit` as its lint script; this is typechecking, not linting.
- The web test script is a placeholder that exits successfully without frontend tests.
- `apps/server/src/app.ts` includes a suspicious CORS origin `http://127.0.0.1/3000`; confirm intended origin/port before changing.
- The complaint workflow review path writes complaint status, then history, notification and realtime event; inspect failure consistency and existing transaction/recovery guarantees.
- Express in-memory rate limiting and configured proxy trust need to be reviewed against actual deployment topology.
- Next.js bundler behavior must be derived from the actual project configuration, not assumptions about Webpack.

## 3. Agent hierarchy and responsibility

Full hierarchy: `../.agents/AGENT_HIERARCHY.md`.

| Agent | Primary responsibility | Repository areas |
|---|---|---|
| Master Orchestrator | Overall sequencing, task assignment, gates, integration and reporting | Entire repository; owns this plan |
| 1. Repository Intelligence | File-level audit, import/dependency graph, feature execution trace | Entire repository; `docs/audit/` |
| 2. Architecture Guardian | Protect architecture, DB and API contracts; reconcile docs/code | `docs/`, `packages/contracts/`, architecture-sensitive changes |
| Implementation Planner | Convert evidence into sequenced tasks/acceptance criteria | `Update/IMPLEMENTATION_PLAN.md`, planning docs |
| 3. UI Modernization | Minimalist UI transformation | `apps/web/src/app/`, `apps/web/src/components/`, CSS/Tailwind |
| 4. Workflow Engineer | Frontend-to-backend integrity for all features | `apps/web/`, `apps/server/src/modules/` |
| 5. Backend Optimizer | API, Express, Mongoose and Socket.IO profiling/optimization | `apps/server/src/`, backend tests |
| 6. Frontend Optimizer | Next rendering, loading, SEO, hydration and bundle performance | `apps/web/`, web config |
| 7. Security Engineer | Authentication, authorization, privacy, API, upload, socket and infra security | Entire repository |
| 8. Dependency Engineer | Safe updates to current dependencies/runtime/build tooling | Manifests, lockfile, Docker, workflows |
| Integration Coordinator | Integrate agents and coordinate shared-file handoffs | Cross-cutting modified files |
| 9. QA Engineer | Regression, integration, security/performance test verification | Tests, CI, `docs/qa/` |
| 10. Independent Reviewer | Independent diff and invariant review | Entire changed codebase; read-only by default |

**Gating:** Agents 3–8 are blocked from implementation until Agents 1–2 complete the baseline/guardrails and the orchestrator accepts the plan. One writer per shared file. No overlapping edits without an explicit handoff.

## 4. Phased roadmap

### Phase 0 — Complete repository audit (read-only)

**Lead:** Repository Intelligence  
**Support:** Architecture Guardian

Tasks:
- Read README and all core docs: architecture, database, API, features, tech stack and CI/CD.
- Inventory all tracked source/config/test/docs files.
- Review complete relevant contents; record file path, responsibility, exports/imports and symbols.
- Trace page/component → hook/API client → endpoint → middleware → controller → service → model/query → persistence → response/state.
- Trace auth, RBAC, object ownership, admin creator isolation, Socket.IO events/rooms and external integrations.
- Review Docker, environment examples, scripts, tests and CI/CD workflows.
- Compare documentation claims with current code; record disagreements separately.
- Establish reproducible quality/performance baselines where possible.

Deliverables:
- `docs/audit/FILE_INVENTORY.md`
- `docs/audit/DEPENDENCY_GRAPH.md`
- `docs/audit/FEATURE_TRACEABILITY.md`
- `docs/audit/ARCHITECTURE_GAP_ANALYSIS.md`
- `docs/audit/SECURITY_FINDINGS.md`
- `docs/audit/PERFORMANCE_FINDINGS.md`
- `docs/audit/TECHNICAL_DEBT.md`
- `docs/audit/BASELINE_METRICS.md`

**Acceptance:** Each in-scope tracked file is REVIEWED/VERIFIED or explicitly NOT VERIFIED with a reason. Each existing feature has an evidenced path or a documented gap. No production source edits in this phase.

### Phase 1 — Architecture and contract lock

**Lead:** Architecture Guardian  
**Support:** Independent Reviewer

Capture:
- API paths/methods/request/response/error contracts.
- Shared Zod DTOs and enums.
- MongoDB collections, persisted fields, relationships and current indexes.
- Complaint states/transitions, SLA policies and audit semantics.
- Auth providers, cookies, token lifecycle, RBAC and isolation boundaries.
- Socket.IO event names/payloads/rooms and authorization.
- S3 upload-intent flow, Ola Maps integration and environment assumptions.
- Docker/deployment topology and CI/CD behavior.

Deliverable: `docs/IMPLEMENTATION_GUARDRAILS.md`.

**Acceptance:** Guardrails are evidence-backed and approved. No implementation before approval.

### Planning checkpoint — Task decomposition

**Lead:** Implementation Planner  
**Owner:** Master Orchestrator

Write task IDs, priority, risk, exact file ownership, dependencies, success criteria, tests, rollback steps and parallelization boundaries into this plan. Separate verified findings from hypotheses. Mark environment-dependent work NOT VERIFIED until reproducible.

**Acceptance:** Project owner/orchestrator approves task plan before Phase 2 changes.

### Phase 2 — Minimalist UI transformation

**Lead:** UI Modernization  
**Support:** Workflow Engineer (behavior parity), QA

Order:
1. Global CSS, tokens and typography.
2. Shared page headers, buttons, fields, tables, cards and status components.
3. Public landing page.
4. Citizen dashboard, complaint list/detail/reporting/tracking.
5. Officer dashboard, complaint detail and task flows.
6. Admin dashboard, analytics, departments and officer management.
7. Auth/registration screens.
8. Maps, navigation, notifications, lightbox and empty/loading/error states.

Use existing JSX/HTML, CSS and Tailwind conventions. Restrained neutral/white surfaces, consistent blue primary, slate typography, subtle borders, measured spacing and accessible focus/contrast. No new UI library.

**Acceptance:** Every route is covered; responsive layouts and keyboard accessibility are checked; every previous handler, form, validation, API call, map interaction, role visibility and Socket.IO subscription still works.

### Phase 3 — Existing feature workflow integrity

**Lead:** Workflow Engineer  
**Support:** Security Engineer, QA

Create a complete matrix for citizen, officer, admin and platform features. For every workflow capture:
- Page and component/user action.
- Client-side validation and hook/service.
- API method/path and payload.
- Authentication and authorization middleware.
- Controller and domain service.
- Model/query and persisted effect.
- Notification/socket event and room.
- Response and frontend reconciliation.
- Success, validation, forbidden/not-found/conflict, transient failure and retry cases.

Verify ownership, creator-based department isolation, atomic conditional updates, concurrency handling, idempotency where applicable, persist-before-emit, audit history and error propagation.

**Acceptance:** Every existing feature has a verified path and success/failure test evidence. No endpoint or contract changes.

### Phase 4 — Performance and SEO

**Leads:** Backend Optimizer + Frontend Optimizer  
**Support:** QA

Frontend:
- Audit server/client component boundaries and hydration.
- Defer browser-only map SDK work until needed.
- Remove duplicate requests and unnecessary state updates/rerenders.
- Optimize expensive dashboard rendering and route loading.
- Reduce initial JS/CSS and optimize images/fonts.
- Verify title/description, canonical metadata, Open Graph, robots, sitemap, semantic HTML and heading hierarchy.
- Keep private/authenticated screens and complaint PII out of indexing.

Backend:
- Profile middleware/auth/API processing.
- Inspect query plans and aggregation execution.
- Use projections/lean queries only where behavior is compatible.
- Eliminate redundant round trips; parallelize only independent operations.
- Review indexes without changing document schema or data semantics.
- Bound large result sets; review pagination and serialization.
- Profile Socket.IO fan-out and external API timeout/retry behavior.

Measure before/after:
- Web LCP, INP, CLS, TTFB, route load and initial JS payload.
- API p50/p95/p99, throughput and error rate.
- MongoDB query/aggregation duration and query execution statistics.
- Relevant event processing latency.

**Acceptance:** Improvement is supported by comparable measurements and no functional/security regression. Numerical targets are set only after baseline capture.

### Phase 5 — Security and bug hardening

**Lead:** Security Engineer  
**Support:** Workflow Engineer, QA

Inspect Clerk/staff JWT, refresh rotation/revocation, cookie attributes, object-level auth, creator isolation, CSRF, CORS, NoSQL injection, input validation, XSS, raw-body webhook signature verification, rate limit/proxy assumptions, S3 file/type/size/intent ownership, presigned URL lifetime, socket handshake/room membership, error/log data leakage, environment secrets, Docker and CI permissions.

For every finding record severity, exact path/line/symbol, exploit scenario, root cause, minimal backwards-compatible remediation, regression test and residual risk.

Reliability bugs must include failure ordering, concurrent requests, retries and partial side-effect analysis. Do not change database architecture to solve consistency without approval.

**Acceptance:** Critical/high findings are fixed with regression proof or blocked with explicit owner decision. No security check is weakened.

### Phase 6 — Dependency modernization

**Lead:** Dependency Engineer  
**Support:** Architecture Guardian, QA

Audit all workspace manifests, lockfile, Node engine, Docker base images, GitHub Actions versions, Next.js build config and direct/transitive dependency advisories.

For each existing dependency record current locked version, proposed version, support/security evidence, semver class, compatibility notes, breaking changes, test matrix and rollback.

Upgrade in small compatible groups:
- First security and compatible patch/minor releases.
- Then major versions only with migration/release-note review and explicit compatibility plan.
- Evaluate Express 5 separately from Express 4.
- Maintain matching Socket.IO client/server compatibility.
- Preserve Next.js/React/TypeScript compatibility.
- Inspect whether Webpack is active before changing bundler config.

No package added solely to make the plan convenient. No blind bulk update.

**Acceptance:** Reproducible clean install; typecheck/tests/build/Docker succeed; upgrade report is complete.

### Phase 7 — Full integration and regression

**Lead:** QA Engineer  
**Support:** Independent Reviewer

Run:
- `npm ci`
- Shared contracts build.
- Workspace typecheck.
- Actual lint.
- All existing backend suites.
- Frontend behavior/regression coverage supported by installed tooling.
- Production monorepo build.
- Docker image builds.
- API contract comparison.
- DB document/index compatibility checks.
- Auth/RBAC/tenant isolation tests.
- Complaint lifecycle/concurrency/audit tests.
- S3, maps, Socket.IO, notifications and SLA checks.
- Responsive UI/accessibility checks.
- Performance before/after comparison.

Known baseline caveat: a web script that only executes `tsc --noEmit` is not an ESLint run; a test placeholder that echoes a message and exits zero is not a frontend test suite. Do not report either as a passing lint/test coverage gate. First inspect installed tools and existing CI capabilities; no new dependency without approval.

**Acceptance:** All required checks have actual captured results. Unrun or environment-dependent checks remain NOT VERIFIED.

### Phase 8 — Production readiness

**Lead:** Master Orchestrator  
**Support:** QA + Independent Reviewer

Reports:
- `docs/qa/REGRESSION_REPORT.md`
- `docs/qa/PERFORMANCE_REPORT.md`
- `docs/qa/SECURITY_VALIDATION.md`
- `docs/qa/DEPENDENCY_UPGRADE_REPORT.md`
- `docs/qa/PRODUCTION_READINESS.md`

Decision: PASS / FAIL / NOT VERIFIED, with evidence and residual risks.

Do not merge or deploy automatically. Final release decision remains with the project owner.

## 5. Global acceptance criteria

- All existing routes and features remain available to their intended roles.
- Architecture, persisted schema, API contracts and feature set remain unchanged.
- UI is consistently minimalist and responsive.
- End-to-end workflows have traceability and regression coverage.
- No known critical/high security issue remains silently unresolved.
- Performance claims include reproducible before/after measurements.
- Runtime/dependency updates are compatible and documented.
- Typecheck, genuine lint, backend tests, frontend checks, production build and Docker build have actual results.
- Final reports distinguish PASS, FAIL and NOT VERIFIED.

## 6. Progress tracking

Maintain `docs/IMPLEMENTATION_PROGRESS.md` with task ID, phase, owner, files, status, dependencies, tests/output, evidence, risks and rollback.

Allowed statuses: NOT_STARTED, IN_PROGRESS, BLOCKED, REVIEW_REQUIRED, COMPLETED.

## 7. Priority order

**Correctness > Security > Backward Compatibility > Reliability > Performance > Visual Polish.**

This is a controlled modernization, not a rewrite.
