# CivicTrack CI/CD Pipeline Documentation

CivicTrack uses a production-ready **Continuous Integration (CI)** and **Continuous Deployment (CD)** pipeline powered by **GitHub Actions** and **Docker**.

---

## 1. Pipeline Overview

```
                         +-----------------------------------+
                         |           git push / PR           |
                         +-----------------------------------+
                                           |
                                           v
               ==================== [ CI PIPELINE ] ====================
               |                                                       |
               |  1. Quality Gate      2. Backend Test Suites          |
               |     • Typechecks         • Dual Auth & Security       |
               |     • Linting            • Storage & Maps             |
               |                          • SLA & Realtime Sockets     |
               |                                                       |
               |  3. Build Gate        4. Docker Smoke Test            |
               |     • @contracts         • Server Dockerfile          |
               |     • @server            • Web Next.js Dockerfile     |
               |     • @web                                            |
               =========================================================
                                           |
                              (On push to main / release)
                                           |
                                           v
               ==================== [ CD PIPELINE ] ====================
               |                                                       |
               |  1. Publish Images (GitHub Container Registry - GHCR) |
               |     • ghcr.io/<org>/server:latest & :sha              |
               |     • ghcr.io/<org>/web:latest & :sha                 |
               |                                                       |
               |  2. Cloud Deployment                                  |
               |     • Backend Deploy Webhook (Render / Railway / etc) |
               |     • Frontend Deploy Webhook (Vercel / Netlify / etc)|
               |                                                       |
               |  3. Post-Deployment Verification                      |
               |     • Automated Live /health Check (200 OK)           |
               =========================================================
```

---

## 2. CI Pipeline (`.github/workflows/ci.yml`)

### Triggers
- Every `push` to `main`, `master`, and `develop`
- Every `pull_request` targeting `main`, `master`, or `develop`
- Manual trigger via **Actions → CivicTrack Continuous Integration (CI) → Run workflow**

### Jobs
1. **`quality-gate`**:
   - Executes `npm ci` with caching.
   - Runs `npm run typecheck` across `@civictrack/contracts`, `@civictrack/server`, and `@civictrack/web`.
   - Runs `npm run lint` across monorepo workspaces.
2. **`backend-tests`**:
   - Executes all 11 backend deterministic test suites in `@civictrack/server`.
   - Tests dual auth (Clerk + Staff JWT), rate limiting, CSRF protection, Ola Maps, SLA escalation, S3 storage verification, and Socket.io room authorization/deduplication.
3. **`build-gate`**:
   - Verifies monorepo production compilation (`npm run build`).
   - Uses Next.js build cache to accelerate page generation.
4. **`docker-smoke-test`**:
   - Builds both `apps/server/Dockerfile` and `apps/web/Dockerfile` to guarantee container builds never break before deployment.

---

## 3. CD Pipeline (`.github/workflows/cd.yml`)

### Triggers
- Automatic on `push` to `main` branch.
- Automatic on GitHub `release` publication.
- Manual trigger via **workflow_dispatch** with target environment selector (`production` / `staging`).

### Jobs
1. **`publish-images`**:
   - Authenticates to **GitHub Container Registry (`ghcr.io`)** using the native `${{ secrets.GITHUB_TOKEN }}` (no external accounts or billing required).
   - Tags container images with `latest`, `sha-<short>`, and semver tags.
   - Pushes multi-stage images to:
     - `ghcr.io/<username>/civictrack/server`
     - `ghcr.io/<username>/civictrack/web`
2. **`deploy-services`**:
   - Calls optional deployment webhooks if configured in repository secrets:
     - `SERVER_DEPLOY_HOOK_URL`: Triggers backend deployment (e.g., Render, Railway, DigitalOcean App Platform, or Coolify).
     - `WEB_DEPLOY_HOOK_URL`: Triggers frontend deployment (e.g., Vercel, Render, or Netlify).
   - Generates a **GitHub Actions Step Summary** with deployment commit, tags, and actor.
3. **`verify-health`**:
   - If `PRODUCTION_API_URL` is set, waits for warmup and queries `https://api.yourdomain.com/health` to confirm the production server is answering healthy (200 OK).

---

## 4. Configuring GitHub Secrets & Variables

To enable automated zero-downtime deployment, go to your GitHub repository:
**Settings → Secrets and variables → Actions**

### Secrets (`Repository secrets`)
| Secret Name | Purpose | Example |
| :--- | :--- | :--- |
| `SERVER_DEPLOY_HOOK_URL` | Webhook URL to trigger backend redeploy on your host | `https://api.render.com/deploy/srv-xxx?key=yyy` |
| `WEB_DEPLOY_HOOK_URL` | Webhook URL to trigger frontend redeploy on your host | `https://api.render.com/deploy/srv-zzz?key=www` |
| `PRODUCTION_API_URL` | Live API URL for post-deployment automated health check | `https://api.civictrack.org` |

*(Note: Docker image publishing uses GitHub's built-in `GITHUB_TOKEN`, so no Docker Hub credentials or tokens are needed unless you prefer Docker Hub).*

---

## 5. Local Docker Testing

You can spin up the full production stack locally with Docker Compose:

```bash
# Build and run all services (MongoDB, Server API, Web Frontend)
docker compose up --build -d

# Check running status and healthchecks
docker compose ps

# View logs
docker compose logs -f

# Stop all services
docker compose down
```

Services will be accessible at:
- **Web Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000/api/v1`
- **API Health**: `http://localhost:4000/health`
- **Swagger Documentation**: `http://localhost:4000/docs/`
