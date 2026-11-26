# CivicTrack — Tech Stack & Architectural Decision Records (ADRs)

> Versions and technical choices verified against workspace `package.json` manifests and source modules.

**Related Docs:** [README](../README.md) • [Architecture](ARCHITECTURE.md) • [Database Structure](DATABASE_STRUCTURE.md) • [API Documentation](API_DOCUMENTATION.md) • [Features](FEATURES.md) • [Quickstart](QUICKSTART.md) • [CI/CD Pipeline](CI_CD_PIPELINE.md)

---

## 1. Technology Stack Inventory

### 1.1 Runtime & Monorepo Tooling

| Component | Technology / Version | Notes |
| :--- | :--- | :--- |
| **Node.js Runtime** | `>=24.0.0` | Enforced in root `package.json` `"engines"` |
| **Workspace Management** | `npm` Workspaces | `packages/*` (`contracts`, `config`), `apps/*` (`web`, `server`) |
| **TypeScript** | `^5.7.3` | Strict base config in root `tsconfig.base.json` (`@civictrack/config` is a stub package) |
| **Validation / Contracts** | `zod` (`^3.24.2`) | Shared across `@civictrack/contracts`, `@civictrack/server`, and `@civictrack/web` |
| **License** | MIT (`LICENSE`) | `LICENSE` specifies MIT (`Copyright (c) 2026 Alok Prasad`); root `package.json` metadata lists `"ISC"` |

### 1.2 Frontend (`@civictrack/web`)

| Layer | Package & Version | Role |
| :--- | :--- | :--- |
| **Framework** | `next` `^16.4.6`, `react` `^19.0.0`, `react-dom` `^19.0.0` | Next.js App Router SSR/client portals, security headers, API/docs proxy rewrites (`next.config.mjs`) |
| **Styling & Icons** | `tailwindcss` `^3.4.17`, `tailwindcss-animate` `^1.0.7`, `lucide-react` `^0.475.0` | Light-mode design system tokens (`globals.css` / `tailwind.config.ts`); no dark-mode toggle |
| **Citizen Auth** | `@clerk/nextjs` `^7.10.7`, `@clerk/themes` `^2.4.57` | Citizen sign-in/sign-up flows and Next.js proxy guard (`src/proxy.ts`) |
| **Maps & Routing** | `olamaps-web-sdk` `^1.4.0`, `maplibre-gl` `^5.12.0` | Interactive spatial maps, clustering, pin picker, officer route visualization |
| **Realtime Client** | `socket.io-client` `^4.8.4` | WebSocket notifications & workflow updates (`use-socket.ts` with 10s dedupe) |

### 1.3 Backend (`@civictrack/server`)

| Layer | Package & Version | Role |
| :--- | :--- | :--- |
| **Web Server** | `express` `^4.21.2` | Modular REST controllers, middleware, dual `/api/v1` and root mounting (`app.ts`) |
| **Database ODM** | `mongoose` `^8.10.1` | MongoDB Atlas / MongoDB 7 persistence, `2dsphere` geospatial index, TTL refresh sessions |
| **Realtime Server** | `socket.io` `^4.8.4` | Room-isolated live pushes (`user:*`, `role:*`, `dept:*`, `admin:notifications`, `complaint:*`) |
| **Auth & Webhooks** | `@clerk/express` `^2.1.96`, `svix` `^2.11.0`, `jsonwebtoken` `^9.0.3`, `bcryptjs` `^3.0.3` | Clerk verification + webhook sync; HTTP-only `SameSite=Lax` staff JWT cookies; bcrypt hashing (cost `12` in `StaffAuthService`, cost `10` in bootstrap/seed helpers) |
| **Security & Limits** | `helmet` `^8.0.0`, `express-rate-limit` `^8.7.5` | Security headers, rate limiting (`300`/`60`/`50` per 15m), sanitization & `Origin`/`Referer` CSRF verification |
| **Object Storage** | `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner` (`^3.1175.0`), `multer` `^2.5.0` | Pre-signed S3 PUT/GET URLs and direct memory-buffered multipart uploads |
| **API Documentation** | `swagger-ui-express` `^5.0.1` | Interactive Swagger UI and OpenAPI JSON (`/docs`, `/api/v1/docs`) |
| **Test / CLI Runner** | `tsx` | Executes 15 deterministic backend test suites and DB/staff CLI scripts |

---

## 2. Architectural Decision Records (ADRs)

### ADR-01: Dual Identity Architecture (Clerk Citizens + Custom Cookie Staff JWTs)
- **Decision:** Citizens authenticate through Clerk (`@clerk/nextjs` / `@clerk/express`) synced via Svix webhooks and JIT lookups; staff (`ADMIN`, `OFFICER`) authenticate via MongoDB-backed credentials issuing role-isolated HTTP-only cookies (`civictrack_admin_*`, `civictrack_officer_*`) with `sameSite: "lax"` and `Origin`/`Referer` CSRF checks (`app.ts`).
- **Rationale:** Separates high-volume public citizen onboarding from strict invite-only officer/admin operational governance and MongoDB-revocable `StaffSession` refresh tokens.

### ADR-02: Shared Zod Contracts (`@civictrack/contracts`)
- **Decision:** Request schemas, status/category/priority enums, Socket.IO event names, and DTO interfaces live in `packages/contracts` and compile to `dist/` for import by both `@civictrack/server` and `@civictrack/web`.
- **Rationale:** Prevents schema and enum drift across frontend forms, backend validators, and WebSocket consumers without duplicating validation logic.

### ADR-03: Dual-Path Evidence Upload (Pre-Signed S3 Intents + Multipart Fallback)
- **Decision:** Storage supports both pre-signed S3 PUT upload intents (`900s` / 15-minute TTL tracked in `UploadIntent`) and direct `multer.memoryStorage()` multipart uploads validated via magic bytes (`image/jpeg`, `image/png`, `image/webp`; max `10MB`, max `5` files), while read responses mint short-lived pre-signed GET view URLs (`3600s` / 1-hour TTL).
- **Rationale:** Keeps S3 buckets private while supporting seamless evidence capture from both the citizen reporting wizard (multipart) and officer resolution modal (pre-signed PUT with multipart fallback).

### ADR-04: GeoJSON `2dsphere` + Non-Destructive `250m` Duplicate Scoring
- **Decision:** Store complaint locations as GeoJSON `Point` (`[lng, lat]`) with a `2dsphere` index, and expose staff duplicate inspection (`GET /api/v1/duplicates/:id/candidates` within `250m`, scoring `0`–`100` and returning `>=40`) paired with non-destructive linking (`POST /api/v1/duplicates/:id/link`) instead of rejecting complaints automatically at submission time.
- **Rationale:** Preserves every citizen submission and audit trail while helping staff spot nearby repeated reports.

### ADR-05: In-Process Scheduled & Idempotent SLA Escalation
- **Decision:** Compute `dueAt` at submission from `DEFAULT_SLA_HOURS` (`CRITICAL` 12h, `HIGH` 24h, `MEDIUM` 48h, `LOW` 72h) and stricter `CATEGORY_SLA_HOURS_OVERRIDE` (`ELECTRICITY` 18h, `WATER_SUPPLY` 24h), then run `SlaService.scanAndEscalateOverdue()` every `15` minutes with a unique `{ complaintId, dueAt }` index in `SlaEscalation`.
- **Rationale:** Avoids external job queue infrastructure while ensuring breaches notify admins and assigned officers once per breach window.

### ADR-06: Ola Maps Web SDK + Server-Side Routing/Geocoding Proxy
- **Decision:** Render client maps with `olamaps-web-sdk ^1.4.0` + `maplibre-gl ^5.12.0` (`MapsService.getStatus()` returns `"Ola Maps Web SDK v2 / Directions API"`) while proxying geocoding and turn-by-turn directions through `/api/v1/maps/*` (`authWebhookRateLimiter`, geometric fallback in development, `503` in production when unconfigured/unavailable).
- **Rationale:** Keeps server-only Ola Maps OAuth/client secrets (`OLA_MAP_CLIENT_ID`, `OLA_MAP_CLIENT_SECRET`) off the browser while providing consistent GeoJSON routing data.
