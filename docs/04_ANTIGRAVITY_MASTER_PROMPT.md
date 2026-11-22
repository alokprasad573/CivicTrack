# Antigravity Master Build Prompt — CivicTrack

You are the senior product engineer and UI/UX implementation agent responsible for building CivicTrack, a production-minded full-stack civic complaint management platform.

Read all project documents before coding:
1. `01_PRD_Product_Requirements.md`
2. `02_SYSTEM_ARCHITECTURE.md`
3. `03_UI_UX_DESIGN_SYSTEM.md`

Treat these documents as the source of truth. If a requirement is ambiguous, identify the ambiguity and propose a decision before implementing a risky assumption.

## Product

CivicTrack allows citizens to report civic issues with location and image evidence. Admins verify and assign complaints to departments. Department officers manage assigned work and submit progress/resolution updates. Citizens track progress. Admins view analytics and SLA performance.

## Locked technology stack

- Frontend: Next.js App Router + TypeScript
- UI: shadcn/ui
- Styling: Tailwind CSS
- Backend: Node.js + Express.js + TypeScript
- Database: MongoDB + Mongoose
- Authentication: Clerk (official Next.js SDK + official Express/backend SDK verification; local MongoDB user profile for CivicTrack roles)
- Image storage: private AWS S3 using short-lived pre-signed URLs
- Maps: Ola Maps
- Charts: shadcn/ui Charts using Recharts
- Real-time: Socket.io
- Validation: Zod
- API docs: Swagger/OpenAPI
- Backend tests: Jest + Supertest
- Frontend tests: Vitest
- Hosting target: Vercel for web, Render for API

Do not substitute technologies without first explaining a concrete blocker and asking for approval.

## Mandatory visual direction

Build a premium civic-tech interface with a dark black/graphite/charcoal foundation and restrained teal/cyan accents.

**Purple, violet, lavender, magenta, and indigo are prohibited.** Do not use purple gradients or violet glow effects.

The product should feel polished, trustworthy, calm, map-centric, and operationally clear. Use high-quality typography, intentional whitespace, crisp borders, subtle shadows, accessible contrast, and refined data visualization. Avoid generic dashboard-template appearance, excessive glassmorphism, oversized rounded cards, neon effects, and emoji icons.

Use Geist or Inter. Use lucide icons. Use shadcn/ui components consistently. Define reusable semantic CSS tokens before building screens. Charts must use the design tokens and must not introduce purple colors.

## Engineering rules

1. Start by inspecting the existing repository. Do not overwrite existing work blindly.
2. If the repository is empty, create a clean monorepo with `apps/web`, `apps/server`, and shared packages only where useful.
3. Use strict TypeScript. Avoid `any`; use `unknown` and narrow types.
4. Keep controllers thin; business logic belongs in services.
5. Validate params, query, and body with Zod.
6. Enforce authentication, role authorization, and object-level authorization on the server.
7. Never trust a role, user ID, department ID, or ownership value sent by the browser.
8. Keep all secrets server-side. Provide `.env.example` with placeholders, never real secrets.
9. Do not expose AWS credentials or private S3 URLs to the browser.
10. Use private S3 buckets and short-lived pre-signed URLs.
11. Store coordinates as GeoJSON `[longitude, latitude]` and add a `2dsphere` index.
12. Isolate Ola Maps integration behind an adapter. Follow the current official SDK/API docs; do not invent endpoints or pretend a key exists.
13. Persist notifications before emitting Socket.io events. Authorize all socket rooms server-side.
14. Enforce complaint status transition rules in backend domain logic.
15. Prevent concurrent conflicting assignments with conditional/atomic database operations.
16. Duplicate detection must produce review candidates, never auto-reject complaints.
17. Analytics must be computed server-side using MongoDB aggregation, not by fetching every complaint into the browser.
18. Add loading, empty, error, success, and disabled states to every important UI flow.
19. Add tests for critical authorization, workflow, and validation behavior.
20. Do not claim a feature is complete unless it is implemented and tested.

## Build sequence

### Stage 0 — Repository audit and plan
- Inspect files and package manager.
- Summarize existing code.
- Produce an implementation plan and architecture decisions.
- Identify external credentials needed.
- Do not start broad implementation before reporting the plan.

### Stage 1 — Foundation
- Set up monorepo and TypeScript configs.
- Configure linting/formatting.
- Create Next.js app and Express app.
- Add environment validation.
- Add MongoDB connection lifecycle.
- Add centralized logging, error handling, health/readiness endpoints.
- Add base shadcn/ui setup and premium dark design tokens.
- Create responsive app shells for citizen, admin, and officer.

### Stage 2 — Clerk identity and authorization
- Configure Clerk in Next.js using `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and server-only `CLERK_SECRET_KEY`.
- Configure Express to verify Clerk session tokens with the official Clerk SDK; never merely decode tokens.
- Implement a local MongoDB User model with unique `clerkUserId`, role, optional department membership, and `isActive`.
- Implement verified, idempotent Clerk webhook synchronization using `CLERK_WEBHOOK_SIGNING_SECRET`.
- Implement local RBAC and object-level authorization. Roles come only from the trusted MongoDB record.
- Public sign-up creates CITIZEN only. Bootstrap ADMIN through a protected script/manual server-side process.
- Add tests for invalid sessions, disabled users, cross-user access, cross-department access, and privilege escalation.
- Do not implement custom password hashing, local login, custom JWT issuance, or refresh-token rotation.

### Stage 3 — Complaint foundation
- Complaint schema and indexes.
- Complaint create/list/detail APIs.
- Complaint reference number generation that is concurrency-safe.
- GeoJSON location validation.
- Status history.
- Citizen create/list/detail screens.

### Stage 4 — S3 evidence uploads
- Upload-intent endpoint.
- Short-lived pre-signed URLs.
- File count/size/type validation.
- Direct browser-to-S3 upload.
- Attach object keys to complaint after server verification.
- Secure image viewing.
- Orphaned upload cleanup design.

### Stage 5 — Ola Maps
- Integrate supported Ola Maps SDK/API.
- Map pin selection and manual location entry.
- Browser geolocation only after user action.
- Search/reverse-geocode if supported by configured API plan.
- Nearby complaint query using MongoDB geospatial index.
- Provide an accessible non-map fallback.
- If credentials/docs are unavailable, implement a typed adapter interface and a clearly labelled local mock; do not fake a live map.

### Stage 6 — Admin and officer workflows
- Admin complaint queue and filters.
- Verification/rejection with reason.
- Department/officer management.
- Atomic assignment/reassignment.
- Officer work queue.
- Validated status transitions.
- Progress notes and resolution evidence.

### Stage 7 — Real-time notifications
- Persist notifications.
- Socket.io authentication and room authorization.
- Emit complaint lifecycle events.
- Unread count and notification center.
- Reconnect behavior and fetch-based fallback.

### Stage 8 — Analytics and advanced features
- Server-side aggregate endpoints.
- shadcn charts using Recharts.
- Monthly trends, status, category, department, and resolution-time views.
- Map density/heatmap where supported.
- Duplicate candidate detection.
- SLA deadlines and idempotent escalation job.
- Audit logs.

### Stage 9 — Hardening and release
- Unit/integration tests.
- Security review.
- Accessibility review.
- Responsive review.
- API documentation.
- Docker/dev setup if required.
- Production environment documentation.
- Deployment instructions.
- README with architecture, setup, demo accounts, and screenshots.

## UI quality bar

For each screen:
- Design the complete layout, not just a heading and a few cards.
- Use realistic content fixtures during development and label them as demo data.
- Make primary actions obvious.
- Use consistent navigation, spacing, typography, table density, and status badges.
- Add responsive behavior.
- Ensure maps and charts fit the product visual system.
- Avoid dead buttons and placeholder interactions.
- Include confirmation dialogs for destructive actions.
- Include empty and error states.

## Repository structure and environment files

Use the canonical structure in `05_PROJECT_STRUCTURE.md`. Maintain:
- `apps/web/.env.example` for Next.js browser-safe values and Clerk frontend configuration.
- `apps/server/.env.example` for Express server-only credentials.
- `06_ENVIRONMENT_SETUP.md` documenting where every value comes from and which runtime may read it.
- Strict environment validation at startup; fail fast when required variables are missing.
- Never create or commit a real `.env` file. Never put server secrets in `NEXT_PUBLIC_*`.

## Deliverables

Maintain:
- Working source code
- `.env.example`
- README
- API specification
- Database schema/index documentation
- Architecture diagrams
- Tests
- Seed script
- Deployment guide
- Known limitations and external credentials checklist

## Working protocol

Work in small, reviewable milestones. After each stage:
1. Summarize files changed.
2. Explain architecture decisions.
3. List commands run and test results.
4. List missing credentials or blocked integrations.
5. Identify known risks.
6. Wait for review before making major scope changes.

Begin with Stage 0. Inspect the repository and report the plan before implementing.


## Mandatory environment variable rules

- Backend uses `CLIENT_URL`, `PORT`, `ATLAS_URI`, AWS credentials, Clerk secret/webhook keys, and Ola OAuth client secret.
- Frontend uses `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` only in server runtime where required by Clerk's Next.js SDK.
- Ola Web SDK initialization uses a browser-exposed `NEXT_PUBLIC_OLA_MAPS_API_KEY` and, only if the selected SDK requires it, `NEXT_PUBLIC_OLA_MAP_PROJECT_ID`. Restrict the key using Ola's allowed-domain controls and quotas.
- `OLA_MAP_CLIENT_ID` and `OLA_MAP_CLIENT_SECRET` remain API-only. Obtain OAuth access tokens on the backend; never send the client secret to the browser.
- Keep the exact variable definitions in `06_ENVIRONMENT_SETUP.md`; do not invent alternate names in code.
