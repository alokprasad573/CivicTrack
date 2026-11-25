---
name: civictrack-repository-audit
description: Comprehensive file-level understanding, dependency tracing, and repository-wide technical auditing of CivicTrack.
---

# CivicTrack Repository Intelligence

## Objective
Build a complete understanding of the existing CivicTrack source code before implementation.

## Mandatory reading order
1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DATABASE_STUCTURE.md`
4. `docs/API_DOCUMENTATION.md`
5. `docs/FEATURES.md`
6. `docs/TECH_STACK.md`
7. `docs/CI_CD_PIPELINE.md`
8. All root and workspace package manifests and relevant lockfile metadata.
9. All TypeScript, TSX, JavaScript, MJS, CSS, Docker, YAML and configuration source files.
10. Existing tests and scripts.

## Audit requirements
- Enumerate every tracked file; distinguish source, test, docs, configuration, generated and assets.
- Record file path, responsibility, imports/exports, primary symbols and consumers.
- Trace frontend components to hooks, contexts and API clients.
- Trace API endpoints to middleware, controllers, services, models and database operations.
- Trace Socket.IO event producers, consumers, payloads and room authorization.
- Trace authentication, authorization and data isolation boundaries.
- Trace external integrations and failure behavior.
- Inspect tests and map them to production behavior.
- Identify dead/duplicate code, TODOs, swallowed errors, unbounded operations and unhandled failure paths.
- Reconcile documentation claims with actual implementation.

## Coverage tracking
Maintain:
- `docs/audit/FILE_INVENTORY.md`
- `docs/audit/DEPENDENCY_GRAPH.md`
- `docs/audit/FEATURE_TRACEABILITY.md`
- `docs/audit/ARCHITECTURE_GAP_ANALYSIS.md`
- `docs/audit/SECURITY_FINDINGS.md`
- `docs/audit/PERFORMANCE_FINDINGS.md`
- `docs/audit/TECHNICAL_DEBT.md`
- `docs/audit/BASELINE_METRICS.md`

Each file status: NOT_STARTED, REVIEWED, VERIFIED, NOT_VERIFIED. Do not mark VERIFIED without inspecting complete relevant contents. State exactly why anything remains NOT_VERIFIED.

## Rules
- Do not modify production source during initial audit.
- Do not infer behavior from filenames.
- Follow real imports, callers and execution paths.
- Treat code as evidence when docs differ; report contradictions.
- Cite file paths, symbols and line numbers.
- Keep secrets and personal data out of audit reports.

## Completion gate
Audit is complete only when all in-scope files have a review status, all existing features have traceable paths or documented gaps, major integrations are understood, boundaries are documented, and unknowns are explicit.
