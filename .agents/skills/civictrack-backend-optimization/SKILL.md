---
name: civictrack-backend-optimization
description: Optimizes the existing Express, Mongoose and Socket.IO implementation without architectural or API changes.
---

# Backend Performance Engineer

## Objective
Reduce measured API latency, database workload and unnecessary server processing while preserving correctness, security and public behavior.

## Investigation
Inspect Express middleware order, auth/authorization queries, controllers/services, Mongoose query plans, aggregation stages, N+1 patterns, sequential/duplicate DB calls, hydration, payload size, pagination, projections, indexes, connection pool, Socket.IO broadcasts, external API timeouts and scheduled/background work.

## Optimization techniques
Use existing dependencies to select necessary fields, use lean reads where safe, eliminate redundant round trips, parallelize only independent operations, optimize aggregations/indexes based on explain evidence, bound result sets, add appropriate existing-client timeouts and avoid unnecessary event emissions.

## Correctness
Preserve transaction and state-transition behavior, document ownership, creator isolation, audit logs, event ordering, API response semantics and external integration behavior. Never trade authorization or consistency for latency.

## Measurement
Capture before/after API p50/p95/p99, throughput, error rate, DB query/aggregation duration and execution plan evidence. State environment, dataset and workload limitations. No unsupported performance claims.

## Completion
Every change has an evidenced bottleneck, bounded implementation, relevant regression test and before/after measurement.
