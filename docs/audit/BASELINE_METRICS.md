# CivicTrack Phase 0 — Baseline Metrics & Validation Status

**Captured:** 2026-11-26 on branch `feature/civictrack-production-modernization` (base `58d251a`, prior to any source changes).

## 1. Repository Size & Composition

| Metric | Value | Source |
| :--- | :---: | :--- |
| Total Git-tracked files | 230 | `git ls-files` |
| Backend source (`apps/server/src/**`, 73 files) | 11,022 LOC | Node LOC scan across `.ts` |
| Backend tests (`apps/server/tests/**`, 17 files) | 4,464 LOC | Node LOC scan across `.ts` |
| Frontend source (`apps/web/src/**`, 67 files) | 17,917 LOC | Node LOC scan across `.ts/.tsx/.css` |
| Shared packages (`packages/**`) | 866 LOC | Node LOC scan |
| Other JS/MJS (`next.config.mjs`, `postcss`, `test-endpoints.mjs`) | 171 LOC | Node LOC scan |
| **Total Codebase LOC** | **34,440 LOC** | Tracked source/test files |

---

## 2. Build, Typecheck, Lint & Offline Test Baseline

Executed command:
```powershell
$env:NODE_ENV='test'; $env:ATLAS_URI=''; $env:STAFF_JWT_ACCESS_SECRET='test_jwt_access_secret_deterministic_testing_32char_key!'; $env:STAFF_JWT_REFRESH_SECRET='test_jwt_refresh_secret_deterministic_testing_32char_key!'; $env:ENABLE_TEST_RATE_LIMIT='false';
npm run build --workspace=@civictrack/contracts && npm run typecheck && npm run lint && npm test --workspace=@civictrack/server && npm run build
```

| Gate | Status | Observed Result / Caveat |
| :--- | :---: | :--- |
| `@civictrack/contracts` build (`tsc`) | PASS | Clean compilation |
| Workspace `typecheck` | PASS | Exited 0; **gap:** `apps/server/tsconfig.json` excludes `apps/server/tests/**` |
| Workspace `lint` | PASS (MISLEADING) | `@civictrack/web` runs `tsc --noEmit` (no ESLint); `@civictrack/config` runs `exit 0` |
| `@civictrack/server` `npm test` (15 files) | PASS (OFFLINE ONLY) | All 15 scripts exited 0 with `ATLAS_URI=''`; DB-backed & S3 live assertions skipped |
| `@civictrack/web` `next build` | PASS (WITH WARNING) | Next.js `16.4.6` (Turbopack): compiled in `2.3s`, TS in `6.3s`, 17 static pages in `424ms`. Emits deprecation warning: `The "middleware" file convention is deprecated. Please use "proxy" instead.` |

---

## 3. Next.js Production Build Route & Bundle Baseline

### Route Rendering Classification (`next build`)
- **Static (`○`, 17 routes):** `/_not-found`, `/admin`, `/admin/analytics`, `/admin/departments`, `/admin/login`, `/admin/officers`, `/admin/register`, `/citizen`, `/citizen/complaints`, `/citizen/report`, `/map`, `/notifications`, `/officer`, `/officer/login`, `/officer/register` (+ internal static targets counted by Next 16)
- **Dynamic SSR (`ƒ`, 6 routes):**
  - `/` (**regression**: forced dynamic because `app/page.tsx:19` calls `await auth()`)
  - `/admin/complaints/[id]`, `/citizen/complaints/[id]`, `/officer/complaints/[id]`
  - `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]`
- **Middleware:** `ƒ Proxy (Middleware)`

### Client Static Output (`apps/web/.next/static`)
| Metric | Baseline Value |
| :--- | :---: |
| Total emitted static chunk/CSS files | 58 files |
| Combined `.next/static` size | `4,539.2 KB` |
| Total JavaScript chunks (`.js`) | `4,415.1 KB` |
| Total Stylesheets (`.css`) | `124.2 KB` |
| Largest static JS chunks | `968.0 KB`, `967.0 KB`, `733.2 KB`, `202.4 KB`, `129.3 KB` |
| Global CSS baseline chunk | `67.6 KB` (includes full `maplibre-gl/dist/maplibre-gl.css` on every page) |

---

## 4. Explicitly `NOT_VERIFIED` Runtime Targets (Offline Environment)

The following live runtime behaviors cannot be verified in this offline workspace without live service credentials and running browser/Docker daemons:
- Live MongoDB Atlas query execution (`npm run test:integration:db` — static inspection found broken assertions in `authorization-privacy.test.ts`, `staff-auth.test.ts`, `socket-auth.test.ts`)
- Live AWS S3 object upload/head/presign/cleanup (`npm run test:storage:integration`)
- Live Ola Maps upstream API latency & response shapes (`api.olamaps.io`)
- Live Clerk OAuth flow and live JWT verification
- Live browser Core Web Vitals (LCP, INP, CLS), Lighthouse scores, and Docker Engine image builds (untested at baseline)
