# CivicTrack — Smart Civic Complaint Management System

CivicTrack is a production-minded full-stack civic complaint management platform that bridges citizens, municipal departments, and municipal administrators with transparent, location-aware complaint tracking, photo evidence uploads, and real-time operational analytics.

---

## 1. Monorepo Architecture

This project is organized as a strict TypeScript monorepo using **npm workspaces**:

```text
civictrack/
├── apps/
│   ├── web/                     # Next.js 15 App Router frontend (Tailwind CSS, shadcn/ui tokens)
│   └── server/                  # Express.js REST API + Socket.io backend
├── packages/
│   ├── contracts/               # Shared Zod schemas, canonical enums, DTOs & API envelopes
│   └── config/                  # Shared TypeScript and tooling configuration
├── docs/                        # Architecture, PRD, and design system documentation
├── IMPLEMENTATION_PLAN.md       # Phased implementation plan
├── IMPLEMENTATION_STATUS.md     # Single source of truth execution tracker
├── package.json                 # npm workspaces root configuration
├── tsconfig.base.json           # Base TypeScript configuration (strict mode)
└── .gitignore
```

---

## 2. Locked Technology Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui design tokens, Lucide React, Zod
- **Backend:** Node.js, Express.js, TypeScript, Zod, Helmet, CORS
- **Authentication:** Clerk (official Next.js SDK + official backend SDK token verification)
- **Database:** MongoDB Atlas + Mongoose with GeoJSON `2dsphere` spatial indexing
- **File Storage:** AWS S3 private bucket with short-lived pre-signed URLs
- **Maps:** Ola Maps API & Web SDK (with non-map manual fallback)
- **Real-Time:** Socket.io with server-authorized rooms
- **Validation:** Zod schemas shared via `@civictrack/contracts`

---

## 3. UI/UX Design System

- **Aesthetic:** Dark graphite and charcoal base with restrained teal/cyan primary accents.
- **Semantic Accents:** Amber (pending/under review), Green (resolved/success), Red (rejected/error).
- **Prohibited:** Purple, violet, lavender, magenta, indigo, neon gradients, and decorative mock charts.
- **Typography:** Geist / Inter sans-serif with tabular numerals.

---

## 4. Getting Started

### Prerequisites

- Node.js `>= 20.x` (tested on Node `v26.13.0`)
- npm `>= 10.x` (tested on npm `11.20.0`)

### Installation

Clone the repository and install dependencies using npm:

```bash
npm install
```

### Environment Configuration

Copy the example environment templates:

```bash
# Backend Express API
cp apps/server/.env.example apps/server/.env

# Frontend Next.js Web App
cp apps/web/.env.example apps/web/.env.local
```

Configure your respective keys in `apps/server/.env` and `apps/web/.env.local`. **Never commit populated environment files.**

---

## 5. Development and Build Commands

```bash
# Build all workspaces (contracts, server, web)
npm run build

# Run TypeScript typecheck across all workspaces
npm run typecheck

# Start development servers
npm run dev:server      # Starts Express API at http://localhost:4000
npm run dev:web         # Starts Next.js Web App at http://localhost:3000
```

---

## 6. Health & Diagnostic Endpoints

When the API server is running:

- `GET http://localhost:4000/api/v1/health` — API liveness & uptime probe
- `GET http://localhost:4000/api/v1/ready` — API dependency readiness probe
