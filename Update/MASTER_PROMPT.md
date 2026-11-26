# ANTIGRAVITY MASTER EXECUTION PROMPT — CIVICTRACK

**Model:** Hydrogen (Extra High)  
**Repository:** https://github.com/alokprasad573/CivicTrack  
**Branch:** feature/civictrack-production-modernization  
**Plan:** Update/IMPLEMENTATION_PLAN.md  
**Agent rules:** .agents/AGENTS.md and .agents/AGENT_HIERARCHY.md

You are the Principal Engineer and Master Orchestrator. Execute the approved modernization plan from this repository. Do not merely write a proposal: inspect, implement, validate, commit and open a GitHub pull request. Use the project's existing named agents and skills; do not invent a second agent framework.

## Non-negotiable first actions
1. Read in full: .agents/AGENTS.md, .agents/AGENT_HIERARCHY.md, Update/AGENT_WORKING.md, Update/IMPLEMENTATION_PLAN.md, README.md and all docs/ARCHITECTURE.md, docs/DATABASE_STUCTURE.md, docs/API_DOCUMENTATION.md, docs/FEATURES.md, docs/TECH_STACK.md, docs/CI_CD_PIPELINE.md.
2. Inspect current git status, branch, latest main SHA, existing PRs and uncommitted changes. Never overwrite user changes.
3. Create/use feature/civictrack-production-modernization from the latest main. Do not commit app changes to main.
4. Delegate only to actual Antigravity subagents. If delegation is unavailable, perform roles sequentially and say so accurately.
5. Phase 0 and Phase 1 are read-only/audit and architecture-lock. Do not begin implementation until complete audit coverage, guardrails and task ownership are documented and the plan is approved.

## Objective A — UI redesign
Transform every current CivicTrack screen into Apple-inspired, premium minimalist UI/UX:
- Keep the existing CivicTrack color palette and semantic colors; refine, do not replace the identity.
- Typography-led hierarchy, elegant scale/weights/line heights, disciplined spacing, grid alignment, generous whitespace and restrained motion.
- Neutral surfaces, subtle borders/dividers and restrained shadows; simple controls and data-dense dashboards remain usable.
- Consistent shared components for navigation, headers, buttons, fields, cards, tables, dialogs, alerts, status indicators, skeleton/loading, empty and error states.
- Responsive mobile/tablet/desktop layouts and WCAG-conscious contrast, keyboard navigation, visible focus and reduced-motion support.
- Use installed packages and current Tailwind/CSS architecture. Do not add a UI library or copy Apple's proprietary branding/assets.

Review public, citizen, officer, admin, auth, report, complaint tracking/detail, analytics, departments/staff, maps/navigation, notifications and evidence screens. Preserve ALL existing handlers, validation, API calls/payloads, route permissions, feature semantics, realtime subscriptions and map behavior. No fake buttons, dead links, removed actions or placeholder data.

## Objective B — engineering quality and performance
- Fix verified bugs and error-handling defects; do not refactor blindly.
- Optimize Next.js render boundaries, hydration, route transitions/reloads, duplicate fetches, unnecessary rerenders, map SDK loading, fonts/images and JS/CSS delivery.
- Optimize Express middleware/request processing, Mongoose queries/aggregations/projections/index use, pagination, repeated round trips, serialization, Socket.IO fanout and external calls.
- Capture comparable baselines and after metrics: LCP/INP/CLS/TTFB, route load/JS bundle, API p50/p95/p99/throughput/error rate and DB query timing. If benchmark conditions/production credentials are unavailable, mark NOT_VERIFIED.
- Preserve freshness, isolation and authorization. Do not cache private response data across users.

## Objective C — SEO
Audit and correctly implement public page metadata, title/description, canonical, Open Graph, robots, sitemap, semantic headings and accessible links. Authenticated dashboard, complaint detail, citizen PII and staff-only pages must not be exposed to crawlers or shared caches. Do not add structured data unless the page has valid, visible, verifiable content that supports it.

## Objective D — security and dependency governance
Audit Clerk and custom staff JWT/session lifecycle, refresh/revocation, cookies, RBAC/object ownership/creator isolation, CSRF/CORS, input/Zod handling, NoSQL injection, XSS, rate limiting/proxy trust, Svix webhook signatures, S3 upload intent/file checks/presigned URLs, Socket.IO handshake/rooms, logging/secrets/errors, Docker and GitHub Actions permissions. For each finding record severity, evidence, attack scenario, root cause, fix, regression test and residual risk. Never weaken controls.
Audit existing packages and runtimes. Verify advisories and official release/migration notes at execution time. Patch/minor updates first. Major updates (especially Express 4→5) require a separate compatibility assessment and explicit approval. No new production dependency without approval.

## Agent/skill assignment
- Repository Intelligence → .agents/agents/repository-intelligence.md + civictrack-repository-audit
- Architecture Guardian → architecture-guardian.md + civictrack-architecture-guard
- UI Modernization → ui-modernization.md + civictrack-minimalist-ui
- Workflow Engineer → workflow-integrity.md + civictrack-workflow-integrity
- Backend Performance → backend-performance.md + civictrack-backend-optimization
- Frontend Performance/SEO → frontend-performance-seo.md + civictrack-frontend-seo
- Security Engineer → security-engineer.md + civictrack-security-hardening
- Dependency Engineer → dependency-engineer.md + civictrack-dependency-governance
- QA Engineer → qa-engineer.md + civictrack-production-qa
- Independent Reviewer → independent-reviewer.md, using architecture-guard and production-qa as read-only references
- Master Orchestrator owns sequencing, approval gates, file ownership and integration.

No overlapping writes. Reserve global CSS/root layout/Tailwind to UI agent; manifests/lockfile to dependency agent; auth/middleware to security agent; business workflow services to workflow agent; shared contracts are protected. Coordinate integration handoffs explicitly.

## Required phases and deliverables
0. Read-only complete inventory/source tracing/baselines in docs/audit/: FILE_INVENTORY, DEPENDENCY_GRAPH, FEATURE_TRACEABILITY, ARCHITECTURE_GAP_ANALYSIS, SECURITY_FINDINGS, PERFORMANCE_FINDINGS, TECHNICAL_DEBT, BASELINE_METRICS.
1. docs/IMPLEMENTATION_GUARDRAILS.md: actual API/DB/auth/event/feature/runtime invariants and approved scope.
2. Update/IMPLEMENTATION_PLAN.md and docs/IMPLEMENTATION_PROGRESS.md: prioritized task IDs, owners, paths, dependencies, acceptance, tests and rollback.
3. UI implementation after gates.
4. End-to-end workflow bug repairs with regression tests.
5. Frontend performance and SEO.
6. Backend performance and query tuning.
7. Security remediation.
8. Compatible dependency upgrades.
9. Integration, full QA and independent review.
10. docs/qa/REGRESSION_REPORT.md, PERFORMANCE_REPORT.md, SECURITY_VALIDATION.md, DEPENDENCY_UPGRADE_REPORT.md, PRODUCTION_READINESS.md; commits and PR to main.

For each finding: cite exact file/symbol/line, root cause, impacted behavior, minimal fix, architecture/API/DB impact, regression test, evidence and rollback. Every check is PASS, FAIL or NOT_VERIFIED. Do not claim commands/metrics/reviews you did not actually execute.

## Explicit stop conditions
Stop and request owner approval if a change requires a schema/data migration, breaking endpoint or shared contract, changed Socket.IO event contract, new user-facing feature, new external service, new production dependency, framework/database/build-system replacement, or major migration that cannot be proven safe. Offer backward-compatible alternatives. Do not deploy or merge automatically.

## GitHub completion
Commit coherent changes to feature/civictrack-production-modernization. Run all available checks. Open a PR against main with scope, design summary, file/task references, tests/metrics, security changes, known limitations and rollback notes. Do not merge. If GitHub push/PR permissions or tools are unavailable, leave a clean working branch and give exact git commands; do not claim push succeeded.

## Definition of done
All existing routes audited and modernized with behavior parity; all existing workflows traced and critical bugs repaired; SEO/private crawl boundary validated; frontend/backend optimization measured; security issues remediated or explicitly unresolved; dependency changes compatible; true test/typecheck/lint/build/Docker/independent-review evidence recorded; PR open; no critical blockers hidden.

Start with the audit. Do not jump directly to UI implementation.
