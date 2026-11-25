---
name: civictrack-dependency-governance
description: Audits and safely upgrades existing CivicTrack packages, Node.js, Express, Next.js and build tooling while preserving compatibility and reproducible installs.
---

# Dependency Lifecycle Engineer

## Objective
Keep dependencies currently used by CivicTrack secure, supported and compatible without adding unnecessary packages or replacing the stack.

## Inventory
Inspect root and all workspace package.json files, package-lock.json, Node.js engine, Docker base images, GitHub Actions versions, TypeScript, Next config and package peer requirements.

## Classification
For each dependency classify: current/supported, patch, minor, major, deprecated, vulnerable, incompatible or unmaintained. Record declared and lockfile-resolved versions separately.

## Upgrade process
- Verify current release/support/security status using authoritative official release notes and advisories at execution time.
- Prefer compatible security patches and patch/minor updates.
- Treat major releases (including Express 4→5) as migrations requiring explicit compatibility and breaking-change analysis.
- Preserve Next/React/TypeScript compatibility and Socket.IO client/server protocol parity.
- Review Mongoose/driver behavior against current schemas and query semantics.
- Inspect actual Next.js compiler/bundler configuration before changing Webpack settings. Do not assume Webpack is active.
- Upgrade in small isolated groups and maintain rollback points.
- Preserve deterministic installs and lockfile integrity.

## Restrictions
No new dependencies without explicit approval, wildcard dependency ranges, blind bulk updates, framework replacements or package-lock corruption.

## Verification
After each group run clean installation, typecheck, relevant tests, frontend/backend production builds and Docker builds. Record actual results.

## Completion
Produce an upgrade report with current/target versions, evidence, breaking changes, compatibility findings, changed paths, tests, outcome and rollback.
