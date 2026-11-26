# CivicTrack — Local Quickstart & Operations Guide

> Setup steps, environment variables, database scripts, and verification commands derived directly from workspace `package.json` files, `.env.example` files, `docker-compose.yml`, and server configuration.

**Related Docs:** [README](../README.md) • [Architecture](ARCHITECTURE.md) • [Database Structure](DATABASE_STRUCTURE.md) • [API Documentation](API_DOCUMENTATION.md) • [Features](FEATURES.md) • [Tech Stack](TECH_STACK.md) • [CI/CD Pipeline](CI_CD_PIPELINE.md)

---

## 1. Prerequisites

- **Node.js `>=24.0.0`** (declared in root [`package.json`](../package.json) `"engines"`) and `npm`
- **MongoDB** (MongoDB Atlas connection string or local MongoDB via Docker `mongo:7-jammy`)
- **Optional external credentials** (needed only for the corresponding integrations in full workflows):
  - **Clerk** keys for Citizen portal authentication and webhook sync
  - **AWS S3** bucket and IAM keys for evidence storage in production
  - **Ola Maps** project/client keys for map rendering, geocoding, and production turn-by-turn directions

---

## 2. Clone, Install & Build Shared Contracts

```bash
git clone <repository-url>
cd CivicTrack
npm install
npm run build --workspace=@civictrack/contracts
```

> **Important:** `@civictrack/contracts` compiles to `dist/`, which `@civictrack/server` and `@civictrack/web` import. Always build `@civictrack/contracts` before running workspace typechecks, builds, or tests.

---

## 3. Environment Variables

Copy the tracked examples and supply local values:

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3.1 Server Environment (`apps/server/.env`)

Defined in `apps/server/.env.example` and validated by `apps/server/src/config/env.ts`:

| Variable | Default / Requirement | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` (`development` \| `production` \| `test`) | Runtime environment mode |
| `PORT` | `4000` | Express + Socket.IO listen port |
| `CLIENT_URL` | `http://localhost:3000` | CORS / Socket.IO allowed frontend origin and CSRF origin check |
| `ATLAS_URI` | Required in production | MongoDB connection string |
| `STAFF_JWT_ACCESS_SECRET` | Dev fallback (`>=32`-char non-default required in prod) | Access token HMAC secret for Admin & Officer cookies |
| `STAFF_JWT_REFRESH_SECRET` | Dev fallback (must differ from access secret in prod) | Refresh token HMAC secret for `StaffSession` |
| `STAFF_JWT_ACCESS_EXPIRY` | `15m` | Access JWT expiration |
| `STAFF_JWT_REFRESH_EXPIRY` | `7d` | Refresh JWT expiration |
| `CLERK_PUBLISHABLE_KEY` | Optional in offline/staff-only mode | Clerk publishable key |
| `CLERK_SECRET_KEY` | Optional in offline/staff-only mode | Clerk backend SDK verification key |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Optional in offline/staff-only mode | Svix webhook signature secret for `POST /api/v1/webhooks/clerk` |
| `AWS_ACCESS_KEY_ID` | Optional in local dev without S3 | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Optional in local dev without S3 | AWS IAM secret key |
| `AWS_REGION` | `ap-south-2` | AWS S3 region |
| `AWS_S3_BUCKET_NAME` | Required non-placeholder in production | S3 bucket storing complaint/resolution evidence |
| `OLA_MAP_PROJECT_ID` | Optional | Ola Maps project identifier |
| `OLA_MAPS_API_KEY` | Optional | Ola Maps API key |
| `OLA_MAP_CLIENT_ID` | Optional | Ola Maps OAuth client ID (directions/geocoding) |
| `OLA_MAP_CLIENT_SECRET` | Optional | Ola Maps OAuth client secret |
| `ENABLE_DEV_ROLE_SWITCH` | `"false"` | Enables `POST /api/v1/users/me/switch-role` outside production |
| `ALLOW_TEST_TOKEN_AUTH` | `"false"` | Enables test bearer tokens outside production |
| `ENABLE_TEST_RATE_LIMIT` | Optional | Keeps rate limiters active when `NODE_ENV=test` |
| `LOG_FORMAT` | Optional (`"json"`) | Emits structured JSON logs when set to `"json"` |

### 3.2 Frontend Environment (`apps/web/.env.local`)

Defined in `apps/web/.env.example` and consumed by `apps/web/next.config.mjs`, `src/lib/api-client.ts`, and `src/hooks/use-socket.ts`:

| Variable | Notes |
| :--- | :--- |
| `NODE_ENV` | `development` / `production` |
| `NEXT_PUBLIC_APP_URL` | Frontend public app URL |
| `NEXT_PUBLIC_SITE_URL` | Site base URL (e.g., for metadata/robots/sitemap) |
| `NEXT_PUBLIC_API_URL` | API base URL (defaults to `http://localhost:4000/api/v1`; `use-socket.ts` derives Socket.IO host by stripping `/api/v1`) |
| `INTERNAL_API_URL` | Target for Next.js rewrites (`/api/v1/:path*` & `/docs/:path*`). `.env.example` sets `http://localhost:10000`, Docker Compose sets `http://server:4000`, and if unset it falls back to `http://127.0.0.1:4000`. **Set to `http://localhost:4000` when running `apps/server` locally on port `4000`.** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk Next.js middleware & UI keys |
| `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED`, `CLERK_TELEMETRY_DISABLED` | Clerk telemetry opt-out flags |
| `NEXT_PUBLIC_OLA_MAPS_API_KEY`, `NEXT_PUBLIC_OLA_MAP_PROJECT_ID` | Client-side Ola Maps Web SDK keys |

---

## 4. Database Setup & Seeding Commands

Run operational commands from the repository root targeting `@civictrack/server`:

```bash
# 1. Sync Mongoose schema indexes (including 2dsphere and TTL indexes)
npm run sync:indexes --workspace=@civictrack/server

# 2. Seed sample departments (TRANS, SWM) and initial Admin/Officer users
npm run seed:staff --workspace=@civictrack/server
```

- `seed-staff.ts` supports overriding initial staff credentials via `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, `INITIAL_OFFICER_EMAIL`, and `INITIAL_OFFICER_PASSWORD`.
- Generate a staff onboarding invitation via CLI:
  ```bash
  npm run invite --workspace=@civictrack/server
  ```
- Additional standalone maintenance scripts live in `apps/server/src/scripts/`:
  - `bootstrap-admin.ts`
  - `backfill-department-creators.ts`

---

## 5. Running the Application

### Option A: Local Development (Two Terminals)

```bash
# Terminal 1 — Express API + Socket.IO (http://localhost:4000)
npm run dev:server

# Terminal 2 — Next.js App Router (http://localhost:3000)
npm run dev:web
```

*(Root `npm run dev` aliases `npm run dev:server`.)*

### Option B: Docker Compose

```bash
docker compose up --build
```

Services defined in [`docker-compose.yml`](../docker-compose.yml):
- `mongodb`: `mongo:7-jammy` on port `27017`
- `server`: Express API on port `4000`
- `web`: Next.js frontend on port `3000` (`INTERNAL_API_URL=http://server:4000`)

> **Docker Note:** [`docker-compose.yml`](../docker-compose.yml) does not pass Clerk environment variables to the `web` service by default; Clerk citizen flows require supplying those environment variables if exercised in containers.

---

## 6. Available Workspace Scripts & Endpoints

### Local Endpoints (Default Ports)
- Frontend UI: `http://localhost:3000`
- Server Liveness: `http://localhost:4000/health` (and `/api/v1/health`)
- Server Readiness: `http://localhost:4000/ready` (and `/api/v1/ready`)
- Swagger UI: `http://localhost:4000/docs` (and `/api/v1/docs`)
- Live smoke check against running server on `127.0.0.1:4000`:
  ```bash
  node scripts/test-endpoints.mjs
  ```

### Workspace Build, Typecheck, Lint & Test Scripts

| Command | Behavior |
| :--- | :--- |
| `npm run build` | Builds workspaces |
| `npm run typecheck` | Typechecks TypeScript across workspaces (build `@civictrack/contracts` first) |
| `npm run lint` | Runs `npm run lint --workspaces --if-present` (`@civictrack/web` runs `tsc --noEmit`; `@civictrack/config` exits `0`) |
| `npm test` | Runs workspace test scripts (`@civictrack/server` runs 15 deterministic suites via `tsx`; `@civictrack/contracts` prints `"Contracts validated via tsc"`; `@civictrack/web` prints `"No frontend tests in Phase 1"`) |
| `npm run test --workspace=@civictrack/server` | Runs all 15 deterministic server test suites (`server.test.ts` plus `test:auth`, `test:staff-auth`, `test:admin-register`, `test:complaints`, `test:storage`, `test:maps`, `test:notifications`, `test:analytics-sla`, `test:security`, `test:socket`, `test:auth-privacy`, `test:officers`, `test:admin-scoped-data`, `test:jit-concurrency`) |
| `npm run test:integration:db --workspace=@civictrack/server` | Runs DB integration suite (`REQUIRE_TEST_DB=true`) |
| `npm run test:storage:integration --workspace=@civictrack/server` | Runs S3 integration suite (`CIVICTRACK_S3_INTEGRATION_TESTS=true`) |
