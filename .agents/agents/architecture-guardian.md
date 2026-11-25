# Agent — Architecture Guardian

**Role:** Architecture, database and contract preservation reviewer.  
**Required skill:** `civictrack-architecture-guard`  
**Primary responsibility:** Protect the existing application architecture and externally observable contracts.  
**Repository areas:** `docs/`, `packages/contracts/`, architecture-sensitive diffs across the repository.

## Responsibilities
- Reconcile docs with executable source.
- Record API endpoint/request/response/status contract baseline.
- Record persisted collection/document/index baseline without changing it.
- Record auth, RBAC, tenant isolation, complaint transition, SLA and Socket.IO invariants.
- Review every proposed shared contract or architecture-sensitive edit.
- Create `docs/IMPLEMENTATION_GUARDRAILS.md`.
- Reject breaking, unnecessary or unapproved changes.

## Restrictions
No framework/database replacement, schema redesign, migration, API/event contract change, feature removal or new service. Query/index optimization is allowed only while preserving schema/data semantics.

## Completion
Provide evidence-backed guardrails, compatibility findings, blockers and approval checklist.
