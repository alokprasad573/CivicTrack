# CivicTrack — Features & Capabilities Guide

> Verified against frontend pages/components in [`apps/web/src/`](../apps/web/src) and backend controllers/services in [`apps/server/src/modules/`](../apps/server/src/modules).

**Related Docs:** [README](../README.md) • [Architecture](ARCHITECTURE.md) • [Database Structure](DATABASE_STRUCTURE.md) • [API Documentation](API_DOCUMENTATION.md) • [Tech Stack](TECH_STACK.md) • [Quickstart](QUICKSTART.md) • [CI/CD Pipeline](CI_CD_PIPELINE.md)

---

## 1. Public & Spatial Discovery (`/`, `/map`)

- **Landing Page (`/`):** Entry portal linking to citizen sign-in/sign-up, public issue map, officer login/onboarding, and administrator login/registration.
- **Public Spatial Map Explorer (`/map`):**
  - Powered by Ola Maps Web SDK (`olamaps-web-sdk`) + MapLibre GL and backed by `GET /api/v1/complaints/nearby` (sanitized allowlist DTOs protecting citizen PII).
  - Includes a **Location Finder** tab, adjustable scan radius (**2 km – 100 km**), status and category filters, a **Show/Hide Closed** toggle, and distance-based sorting.

---

## 2. Citizen Portal (`/citizen/*`)

Authenticated via Clerk (`@clerk/nextjs`) at `/sign-in` and `/sign-up`:

- **4-Step Issue Reporting Wizard (`/citizen/report`):**
  - Captures title (5–150 chars), description (20–2000 chars), complaint category (`ROADS_POTHOLES`, `WATER_SUPPLY`, `GARBAGE_SANITATION`, `DRAINAGE_SEWAGE`, `STREETLIGHTS`, `ELECTRICITY`, `GENERAL`), street address, optional landmark, and map coordinates using an interactive Ola Maps `LocationPicker`.
  - Attaches up to **5 images** (`image/jpeg`, `image/png`, `image/webp`, max `10MB` each) via direct multipart upload (`POST /api/v1/complaints`).
  - Automatically calculates an SLA deadline (`dueAt`) on submission.
- **Citizen Dashboard (`/citizen`):**
  - Personal complaint counts/KPIs, live complaint list updated via Socket.IO, and an embedded `SpatialMapPreview` map.
- **Complaint Tracking & Detail (`/citizen/complaints/[id]`):**
  - Displays `ComplaintStatusTracker`, chronological `ComplaintStatusHistory` audit timeline, assigned department/officer info (when assigned), and resolution evidence.
  - **Evidence Lightbox (`evidence-lightbox.tsx`):** Zoomable viewer displaying image preview, MIME type, file size, and upload timestamp.
  - **Citizen Feedback (`POST /api/v1/complaints/:id/feedback`):** Available once a complaint reaches `RESOLVED` or `CLOSED` (1–5 star rating + optional comment). Submitting feedback on a `RESOLVED` complaint transitions its status to `CLOSED`.
- **Notifications (`/notifications` & `NotificationBell`):** Real-time toast/badge alerts via Socket.IO (`notification:new`) and persistent notification inbox with single/bulk read actions.

---

## 3. Field Officer Portal (`/officer/*`)

Authenticated via staff invitation onboarding and HTTP-only JWT cookies:

- **Invite-Only Onboarding (`/officer/register`) & Login (`/officer/login`):**
  - Officers join using a verified invitation token (`GET /api/v1/staff/invitations/verify`, `POST /api/v1/staff/invitations/accept` or `/api/v1/officer/auth/register`) bound to a department.
- **Officer Operations Queue (`/officer`):**
  - Dedicated **"Assigned Directly to Me"** vs **"Department Queue"** tabs (`assignedToMe` query parameter), filtering, and live Socket.IO synchronization.
- **Field Execution & Resolution (`/officer/complaints/[id]`):**
  - Transition assigned work to active work (`Start Work`: `ASSIGNED -> IN_PROGRESS`).
  - Resolve complaints (`Resolve` modal: `IN_PROGRESS -> RESOLVED`) with `resolutionRemarks` and up to 5 resolution photos (requests S3 pre-signed PUT upload intents via `POST /api/v1/storage/upload-intent` with automatic multipart upload fallback).
  - Inspect nearby duplicate candidates (`GET /api/v1/duplicates/:id/candidates`) within the officer's department.
- **Turn-by-Turn In-App Navigation (`OfficerNavigation`):**
  - Embedded routing HUD backed by `POST /api/v1/maps/directions`, rendering route polylines, step-by-step instruction drawer, optional **Web Speech API** voice announcement toggle, and external Google Maps deep link.

---

## 4. Administrator Portal (`/admin/*`)

Authenticated via HTTP-only admin JWT cookies with self-service registration (`/admin/register`) and login (`/admin/login`):

- **Triage & Spatial Operations Dashboard (`/admin`):**
  - Creator-scoped operational dashboard pairing filtered complaint queues with an interactive map (`MapMarkerLayer` clustering markers when zoom `< 14` and count `> 5`, plus Show/Hide Closed toggle).
- **Workflow Orchestration & Duplicate Linking (`/admin/complaints/[id]`):**
  - Review incoming complaints (`POST /:id/review`), verify (`POST /:id/verify`), reject with reason (`POST /:id/reject`), assign or reassign departments and officers (`POST /:id/assign`), and close complaints (`POST /:id/close`).
  - Inspect geospatial/textual duplicate candidates within **`250m`** (`GET /api/v1/duplicates/:id/candidates`) and create non-destructive duplicate links (`POST /api/v1/duplicates/:id/link`).
- **Department Management (`/admin/departments`):**
  - Create, inspect, edit, and soft-deactivate (`isActive: false`) municipal departments isolated per creating administrator (`createdByAdminId`).
- **Officer & Invitation Management (`/admin/officers`):**
  - Filter active officers by department, generate and revoke time-limited invitation links/tokens (`/api/v1/admin/invitations`), and remove officer accounts (`DELETE /api/v1/users/officers/:id`).
- **Analytics & SLA Oversight (`/admin/analytics`):**
  - Visualizes complaint volume, status/category distributions, resolution timing, and SLA breach metrics (`GET /api/v1/analytics/summary`), with optional date range & department filters plus manual SLA scan execution (`POST /api/v1/sla/scan`).

---

## 5. Cross-Cutting Platform Capabilities

- **Automated SLA Monitoring:** Background scanner runs every `15` minutes across overdue open complaints (up to `500` per scan), logging idempotent `SlaEscalation` rows and dispatching `SLA_BREACH` notifications to active admins and assigned officers.
- **Media Validation & Short-Lived Access:** Magic-byte verification enforcing JPEG/PNG/WebP images (`<=10MB`, `<=5` files), pre-signed S3 PUT URLs (`900s` TTL), pre-signed GET view URLs (`3600s` TTL), and admin orphan cleanup (`POST /api/v1/storage/cleanup`).
- **Interactive API Docs & Health Probes:** Built-in Swagger UI (`/docs`, `/api/v1/docs`) and liveness/readiness probes (`/health`, `/ready`).
