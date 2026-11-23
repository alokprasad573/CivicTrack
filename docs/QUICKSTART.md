# CivicTrack Developer Quickstart & Onboarding Guide

This guide walks you through setting up a complete CivicTrack local development environment from scratch, including database configuration, environment variables, contract compilation, staff seeding, and verification.

---

## 1. Prerequisites & System Requirements

Before starting, ensure your local development machine has:
* **Node.js**: `v24.0.0` or higher (Current / LTS recommended)
* **npm**: `v10.0.0` or higher
* **MongoDB**: A local instance running on port 27017, Docker container, or a free [MongoDB Atlas](https://www.mongodb.com/) cluster URI.
* **Git**: Modern Git client.
* **Docker & Docker Compose** (Optional, for containerized local development).

---

## 2. Clone Repository & Install Dependencies

Clone the CivicTrack monorepo and install all workspace dependencies from the root:

```bash
git clone https://github.com/alokprasad573/CivicTrack.git
cd CivicTrack

# Install hoisted monorepo dependencies across all packages and apps
npm install
```

---

## 3. Environment Variable Configuration

CivicTrack uses separate environment files for the backend server and frontend web application. Template files are provided in each workspace.

### 3.1 Backend Server (`apps/server/.env`)
Copy the example environment file:
```bash
cp apps/server/.env.example apps/server/.env
```

Open `apps/server/.env` and configure:
```env
# Server Configuration
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# MongoDB Database Connection
DATABASE_URL=mongodb+srv://<username>:<password>@cluster0.mongodb.net/civictrack?retryWrites=true&w=majority

# Municipal Staff Authentication Secrets (Min 32 characters each)
STAFF_JWT_ACCESS_SECRET=your_super_secret_staff_access_jwt_key_32chars!
STAFF_JWT_REFRESH_SECRET=your_super_secret_staff_refresh_jwt_key_32chars!
STAFF_JWT_ACCESS_EXPIRES_IN=15m
STAFF_JWT_REFRESH_EXPIRES_IN=7d

# Clerk Citizen Authentication (Optional for offline staff development)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Amazon S3 Evidence Storage (Optional for offline testing)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=civictrack-evidence-bucket

# Ola Maps Integration (Optional for offline testing)
OLA_MAPS_API_KEY=your_ola_maps_api_key_here
```

### 3.2 Frontend Web App (`apps/web/.env.local`)
Copy the example environment file:
```bash
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` and configure:
```env
# Backend API Base Endpoint
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000

# Clerk Public Key for Citizen Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Ola Maps Client-Side API Key
NEXT_PUBLIC_OLA_MAPS_API_KEY=your_ola_maps_client_key_here
```

---

## 4. Compile Shared Contracts

Because the server and web applications rely on shared TypeScript types and Zod schemas from `@civictrack/contracts`, compile the contracts workspace before launching the apps:

```bash
npm run build --workspace=@civictrack/contracts
```

---

## 5. Seed Municipal Departments & Initial Administrator

CivicTrack includes deterministic seed scripts to populate default municipal departments (Roads, Sanitation, Electricity, Water) and create an initial superadmin:

```bash
# Seed initial municipal departments and test staff
npm run seed:staff --workspace=@civictrack/server
```

> 💡 **Tip:** To generate a new staff invitation token via CLI:
> ```bash
> npm run invite --workspace=@civictrack/server
> ```

---

## 6. Running the Application

### Option A: Local Bare-Metal (Recommended for Development)
Run the server and web application in two separate terminal windows:

```bash
# Terminal 1: Launch Backend API & Socket.IO server (Port 4000 with hot-reload)
npm run dev:server

# Terminal 2: Launch Next.js Web Application (Port 3000 with Turbopack/HMR)
npm run dev:web
```

### Option B: Docker Compose (Full Stack in Containers)
You can run the entire system (Server + Web + MongoDB) with a single command:

```bash
docker-compose up --build
```

---

## 7. Verify System Health

With the application running, test the backend endpoints:

| Endpoint | Target URL | Expected Result |
| :--- | :--- | :--- |
| **API Liveness** | `http://localhost:4000/api/v1/health` | `HTTP 200 {"status": "ok"}` |
| **Database Readiness** | `http://localhost:4000/api/v1/ready` | `HTTP 200 {"ready": true}` |
| **Swagger UI Docs** | `http://localhost:4000/api/v1/docs` | Interactive Swagger UI |
| **Web Portal** | `http://localhost:3000` | CivicTrack Landing & Portal |

---

## 8. Running Test Suites & Quality Gates

Run quality checks across all workspaces from the project root:

```bash
# Run TypeScript compilation checks across all workspaces
npm run typecheck

# Run ESLint linter across all workspaces
npm run lint

# Run full backend test suite
npm test --workspace=@civictrack/server
```

---

## 9. Common Troubleshooting

* **Q: MongoDB is disconnected or fails in offline mode.**
  * *Fix:* The backend includes an offline resilience mode for testing. Set `DATABASE_URL` in `apps/server/.env` to connect to a live MongoDB cluster.
* **Q: Windows EPERM Symlink Error during `npm install`.**
  * *Fix:* Run PowerShell as Administrator or enable Windows Developer Mode (`Settings > System > For developers > Developer Mode`).
* **Q: Evidence photo uploads fail in local development.**
  * *Fix:* In offline mode without AWS S3 credentials, the pre-signed intent returns a mock upload URL. To test live uploads, provide valid `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_BUCKET` in `apps/server/.env`.
