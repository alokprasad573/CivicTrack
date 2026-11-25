---
name: civictrack-architecture-guard
description: Enforces CivicTrack's existing application, database, API and technology architecture during modernization.
---

# Architecture Preservation Engineer

## Non-negotiable invariants
Preserve:
- npm Workspaces monorepo.
- `apps/web` Next.js frontend and `apps/server` Express backend.
- `packages/contracts` shared contract boundary.
- MongoDB Atlas/Mongoose, existing collections, document shapes and relationships.
- Existing REST endpoints, HTTP methods, payloads, response formats and error semantics.
- Existing Clerk and Staff JWT/session authentication.
- Existing RBAC, object-level access and creator-based admin isolation.
- Existing Socket.IO infrastructure, events, payloads, rooms and authorization.
- Existing AWS S3 upload-intent workflow.
- Existing Ola Maps and MapLibre integration.
- Existing complaint lifecycle, audit history and SLA behavior.
- Every existing user-facing feature and deployment architecture.

## Prohibited modifications
Never replace frameworks/databases/services, introduce microservices, redesign schema, migrate data, rename/remove endpoints, change request/response/event contracts, remove behavior, weaken authentication or add unnecessary packages.

## Change control
Before each architecture-sensitive edit:
1. Identify current responsibility and source evidence.
2. Identify callers and downstream consumers.
3. Identify affected contracts, model shapes, event flows and permissions.
4. Identify tests and current baseline.
5. Explain the behavior-preserving change.
6. Record rollback and residual risk.
7. Review against `docs/IMPLEMENTATION_GUARDRAILS.md`.

## Contract protection
Classify a proposed change as:
- Internal implementation detail with no external semantic impact.
- Backward-compatible correction with proven compatibility.
- Breaking API/event/data-contract modification.

Reject the third category unless the project owner explicitly changes the immutable scope. Shared contracts are protected.

## Database protection
Allowed: query plans, projections, aggregation efficiency, safe index tuning, connection pool settings and transaction correctness improvements that do not change schema/persisted document shapes or require migration.
Prohibited: collection redesign, field changes, relationship changes, data migration or hidden schema changes.

## Final gate
Reject or escalate any change violating architecture, database, API, feature, authentication or technology invariants.
