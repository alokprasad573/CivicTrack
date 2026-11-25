---
name: civictrack-workflow-integrity
description: Traces, verifies and repairs existing CivicTrack feature workflows from frontend interactions to backend persistence and realtime updates.
---

# End-to-End Workflow Integrity Engineer

## Objective
Guarantee every existing feature has a complete, correct and secure execution path without changing API contracts, data schema or feature set.

## Mandatory trace
For each feature record:
1. Frontend route/page.
2. Component and user action.
3. Form/event validation.
4. Hook/context/client service.
5. API method, path and request payload.
6. Authentication middleware.
7. Authorization/RBAC/ownership checks.
8. Controller.
9. Domain service.
10. Model and DB query/write.
11. Persistence and audit history.
12. Notification/socket/external service side effects.
13. Response shape/status.
14. Frontend state update/reconciliation.
15. Error and retry behavior.

## Required workflows
Citizen: sign-in/out, reporting, geolocation/map selection, evidence, listing, detail, tracking, nearby issues, feedback and notifications.
Officer: staff auth/session, task queue, detail, start work, navigation, resolution evidence, resolve/reassign and notifications.
Admin: registration/auth, departments, invitations, officers, review/verify/reject/assign/close, analytics, SLA scan/escalation.
Platform: Clerk webhook/JIT, staff refresh/revocation, socket auth/rooms/reconnect, S3 intents/verification, maps/directions, health/readiness, scheduled jobs and graceful shutdown.

## Integrity requirements
Verify user ownership, role authorization, creator-based isolation, server-side validation, atomic conditional transitions, concurrent modification, idempotent retries where needed, persist-before-emit, consistent audit history, side-effect ordering and correct error propagation.

## Rules
Never invent endpoints or change paths/methods/payloads/response/status contracts. Do not change the persisted schema or add features. Do not claim a path verified from docs alone; cite actual source and test evidence.

## Completion
Every current feature has a verified frontend entry point, backend execution path, persistence path where applicable, authorization boundary, success test and relevant failure/concurrency tests. Gaps are explicit.
