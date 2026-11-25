# CivicTrack — Agent Working Model

## 1. Purpose

This document defines which Antigravity agent owns which engineering responsibility and repository area during the production modernization. The canonical hierarchy is in `.agents/AGENT_HIERARCHY.md`; global constraints are in `.agents/AGENTS.md`.

## 2. Agent working matrix

| Agent | Primary responsibility | Repository areas | Outputs / ownership |
|---|---|---|---|
| Master Orchestrator | Principal architecture/engineering coordination; sequencing, assignment, gates, integration, final status | Entire repository (coordination); `Update/`, progress/report orchestration | Approved task plan, ownership, integration decisions, production readiness decision |
| 1. Repository Intelligence | Read and understand all relevant code; inventory files; trace imports, symbols, execution paths and feature flows | Entire repository, read-only initially; `docs/audit/` | File inventory, dependency graph, feature traceability, baseline gaps |
| 2. Architecture Guardian | Protect architecture, DB, API, contract, auth, events and feature invariants; reconcile docs with source | `docs/`, `packages/contracts/`, review of sensitive changes | `docs/IMPLEMENTATION_GUARDRAILS.md`, impact assessments, rejection/escalation of breaking changes |
| Implementation Planner | Convert audit into prioritized, dependency-aware work with acceptance criteria and clear file ownership | `Update/IMPLEMENTATION_PLAN.md`, planning docs | Sequenced tasks, risk/dependency matrix, test/rollback criteria |
| 3. UI Modernization | Create shared minimalist visual language; redesign all existing pages without changing behavior | `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/app/globals.css`, existing Tailwind config | Design tokens, shared component styles, route-by-route visual updates |
| 4. Workflow Engineer | Ensure every current feature works end-to-end; repair broken links/validation/state/error handling | `apps/web/`, `apps/server/src/modules/`, relevant existing tests | Feature execution matrix, backward-compatible workflow fixes, regression cases |
| 5. Backend Optimizer | Profile API/server/db and improve query, aggregation, middleware, serialization and realtime performance | `apps/server/src/`, backend tests | Baseline/after metrics, query evidence, targeted optimizations |
| 6. Frontend Optimizer | Optimize Next rendering, hydration, route loading, requests, bundles, SEO and public/private crawl boundary | `apps/web/`, Next config | Web vitals/bundle evidence, loading/SEO fixes |
| 7. Security Engineer | Audit and remediate auth, access control, injection, CSRF/CORS, storage, sockets, secrets and infrastructure | Entire repository; focused security tests | Prioritized findings, minimal fixes, exploit regression tests, residual risks |
| 8. Dependency Engineer | Safely upgrade existing dependencies and runtimes with compatibility checks | Root/workspace manifests, lockfile, Dockerfiles, CI workflows | Version matrix, upgrade commits, clean-install/build/test evidence |
| Integration Coordinator | Coordinate cross-agent integration and shared-file handoffs | Only assigned cross-cutting files | Conflict-free integrated changes and integration test results |
| 9. QA Engineer | Regression, integration, responsive/accessibility, performance and release validation | Existing tests, CI, `docs/qa/` | PASS/FAIL/NOT VERIFIED reports with run evidence |
| 10. Independent Reviewer | Review all changed files independently against plan, invariants, quality and security | Entire changed codebase; read-only by default | Findings, approval/rejection and verification gaps |

## 3. Execution order and prerequisites

| Order | Agent(s) | May start when | May finish when |
|---|---|---|---|
| 0 | Repository Intelligence | Task starts | All in-scope files have a review status and evidence-backed traceability |
| 1 | Architecture Guardian | Initial inventory/docs available | Architecture and compatibility guardrails approved |
| 2 | Implementation Planner | Audit + guardrails available | Every phase has tasks, owners, tests, dependencies, risk and rollback |
| 3 | UI Modernization | Phase plan approved; affected UI ownership reserved | All existing UI routes redesigned and behavior checked |
| 3 | Workflow Engineer | Phase plan approved; route/service owners reserved | Existing features have verified full paths and regressions |
| 3 | Backend Optimizer | Baseline captured and backend files assigned | Before/after latency/query evidence and tests |
| 3 | Frontend Optimizer | Baseline captured and frontend files assigned | Before/after loading/web-vitals/bundle evidence |
| 3 | Security Engineer | Baseline and security scopes assigned | Findings remediated or formally blocked with evidence |
| 3 | Dependency Engineer | Baseline tests/builds available | Compatible upgrade groups validated |
| 4 | Integration Coordinator | Scoped work ready to integrate | No unresolved conflicts; integrated checks completed |
| 5 | QA Engineer | Candidate work integrated | Required test matrix run and results published |
| 6 | Independent Reviewer | Diffs and reports ready | Findings dispositioned; invariants and acceptance reviewed |
| 7 | Master Orchestrator | All reports ready | Production readiness decision recorded |

The UI, workflow, backend, frontend, security and dependency agents may execute in parallel only where file ownership and technical dependencies do not overlap. Their implementation is prohibited before the audit and architecture gate.

## 4. Required agent output format

Every assigned task must report:
1. Task ID and objective.
2. Files inspected and files modified.
3. Evidence of current behavior (file/symbol/line).
4. Root cause or design rationale.
5. Proposed and actual change.
6. Explicit architecture, API, DB, feature and tech-stack impact.
7. Tests/commands actually executed and their exit/result.
8. Remaining risks, unknowns and rollback.
9. Status: NOT_STARTED, IN_PROGRESS, BLOCKED, REVIEW_REQUIRED or COMPLETED.

## 5. Shared-file ownership

- `apps/web/src/app/globals.css`, root layout and Tailwind config: UI Modernization owns writes.
- Root/workspace package manifests and `package-lock.json`: Dependency Engineer owns writes.
- `packages/contracts/**`: Architecture Guardian reviews; no write without explicit orchestrator approval and proof that contracts remain semantically unchanged.
- Complaint workflow/service/controller files: Workflow Engineer owns business-flow changes; Security/Backend agents submit findings and coordinate handoffs.
- Auth/RBAC/middleware/socket authorization files: Security Engineer owns security changes; Workflow Engineer must verify behavior.
- Docker and GitHub workflow changes: Dependency/QA owner designated per task; no simultaneous writes.
- Any shared file transfers only through an explicit owner handoff recorded in `docs/IMPLEMENTATION_PROGRESS.md`.

## 6. Escalation and stop conditions

Immediately escalate:
- A proposed schema, API contract, socket event or feature change.
- A required new dependency or external service.
- Major-version migration uncertainty.
- Conflicting documentation and actual code behavior.
- Unreproducible tests or unavailable secrets/services.
- Potential critical data integrity, security or privacy issue.

Provide evidence, impact, safe alternatives and exact approval required. Do not resolve by silently relaxing invariants.
