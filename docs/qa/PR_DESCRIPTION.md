# Pull Request: CivicTrack Production Modernization

**Base:** `main`  
**Head:** `feature/civictrack-production-modernization`

## Executive Summary

This PR executes a substantial portion of the CivicTrack production modernization roadmap. It delivers frontend SEO/private-crawl boundaries, frontend and backend security hardening, backend query/API performance improvements, dependency/infrastructure governance, and Apple-minimal UI design-system foundations — while preserving all existing architecture, APIs, database shapes, and feature semantics.

## Changed Areas

### Frontend (apps/web)
- SEO: `robots.ts`, `sitemap.ts` (public routes only), `metadataBase` + title template, OG/Twitter metadata, dynamic `icon.tsx`, `error.tsx`/`global-error.tsx`, noindex layouts for private/auth/notification routes, public map layout.
- Security: removed hardcoded Ola Maps key fallback; HTML-escaped map popup fields + removed inline `onmouseover` (XSS); removed `ipapi.co` IP leak; added security response headers (CSP, X-Frame-Options, etc.).
- Architecture: converted client-only layouts to server components wrapping client portal-gate components.

### Backend (apps/server)
- Performance: removed up-to-1000 S3 presigning loop in complaint list; lean queries + consolidated department query; added `{ departmentId, createdAt }` index; `AbortSignal.timeout(5000)` on Ola Maps; SLA lean + parallelized notifications + bounded; clerk middleware lean; single-write staff sessions.
- Security: CSRF cookie names fixed; CORS typo fixed; `adminRegister` account-takeover closed; `syncFromClerk` blocked from staff accounts; request-id validation; strict logout socket disconnect; `verifyViewAuthorization` creator isolation; `validateUploadIntents` hardened; department `GET /:id` blocks citizens; maps rate-limited; socket fail-closed + revocation + creator scoping.
- Correctness: MulterError handling; cleanupOrphans NaN guard; swagger import fix; officer fail-closed without department.

### Infra/Dependencies
- Moved `@types/multer`/`@types/swagger-ui-express` to devDeps; docker-compose ATLAS_URI + AWS bucket + Ola key; web Dockerfile `npm prune --omit=dev`; ci.yml `permissions: contents: read`.

## Test Results

| Check | Result |
| :--- | :--- |
| `npm run typecheck` (all workspaces) | PASS |
| `npm run lint` | PASS |
| `npm run build --workspace=@civictrack/web` | PASS |
| `tsx tests/security-hardening.test.ts` | PASS |
| `npm run typecheck --workspace=@civictrack/server` | PASS |

## Known Limitations / Remaining Work
- Full visual redesign of operational routes (citizen/officer/admin dashboards) partially complete; design tokens in place.
- Workflow backend fixes (persist-before-emit, resolve findOneAndUpdate, assign $unset+dueAt, SLA escalation on resolve/close) not yet applied.
- Analytics `$facet` consolidation not applied.
- Frontend search-input debouncing (300ms) not applied.
- Full server test suite not re-run after backend changes (only security suite).
- Performance baseline/after metrics: NOT_VERIFIED.

## Rollback Considerations
- All changes are additive or scoped; revert the feature branch commits to restore prior state.
- New DB index `{ departmentId: 1, createdAt: -1 }` is additive and safe to leave.
- No schema/data migrations performed.