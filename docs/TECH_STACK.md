# CivicTrack Technology Stack & Architectural Decision Records (ADR)

This document details the complete technology matrix used across CivicTrack, along with the engineering rationale behind every architectural selection.

---

## 1. Technology Matrix Overview

| Tier | Technology | Version | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router) | `16.x` | Server-rendered UI, nested layouts, streaming, and client routing |
| **UI Library** | React | `19.x` | Declarative component model and modern concurrent features |
| **Styling & Icons** | Tailwind CSS / Lucide | `3.4 / 0.475` | Utility-first styling tokens, dark/light mode, and lightweight SVG icons |
| **Backend Runtime** | Node.js (Current / LTS) | `24.x` | High-throughput asynchronous event-driven server runtime |
| **REST Server** | Express.js | `4.21.x` | Lightweight, un-opinionated routing, middleware chaining, and API endpoints |
| **Shared Contracts** | TypeScript / Zod | `5.7 / 3.24` | Single source of truth for runtime validation and static type safety |
| **Database & ODM** | MongoDB Atlas / Mongoose | `8.10.x` | Flexible document store with native GeoJSON `2dsphere` spatial indexing |
| **Real-time Bus** | Socket.IO | `4.8.x` | Bi-directional low-latency event streaming with room-based pub/sub |
| **Geospatial & Maps** | Ola Maps SDK v2 / MapLibre | `1.4 / 5.12` | Vector tile rendering, marker clustering, and turn-by-turn routing |
| **Media Storage** | Amazon Web Services (AWS) S3 | SDK `v3` | Encrypted cloud object storage with time-limited pre-signed PUT/GET URLs |
| **Public Identity** | Clerk | SDK `v2/v7` | Managed citizen OAuth2, multi-factor auth, and session validation |
| **Staff Identity** | Custom JWT / bcryptjs | `9.0 / 3.0` | High-entropy HMAC tokens in HttpOnly, SameSite=Strict cookies |
| **Containerization** | Docker / Compose | Multi-stage | Lightweight OCI container images for server and web services |
| **CI/CD** | GitHub Actions | Workflows | Automated quality gates, typechecking, deterministic tests, and GHCR publishing |

---

## 2. Architectural Decision Records (ADRs)

### ADR-01: npm Workspaces Monorepo with Shared `@civictrack/contracts`
* **Context:** A distributed civic platform requires identical validations on frontend form inputs, backend Express routes, and real-time WebSocket payloads.
* **Decision:** Group packages into an npm workspaces monorepo containing `apps/web`, `apps/server`, `packages/contracts`, and `packages/config`.
* **Rationale:**
  * **Elimination of Schema Drift:** A single Zod definition (e.g. `CreateComplaintSchema`) validates the Next.js form and Express payload. Changing a field updates types across the entire project at compile time.
  * **Single Source for State Machine:** The complaint lifecycle validator `isValidStatusTransition()` is defined once and executed consistently on both client buttons and backend controllers.

---

### ADR-02: Dual Authentication Architecture (Clerk + Custom Staff JWT)
* **Context:** Civic applications serve two fundamentally different user categories: the general public (citizens) who expect seamless social logins (Google, Apple, Phone OTP), and municipal staff (officers, supervisors, administrators) who operate under strict enterprise governance, departmental hierarchies, and auditing requirements.
* **Decision:**
  * **Citizens:** Authenticated via **Clerk** (managed OAuth2, passwordless sign-ins, session rotation, and Svix webhook sync).
  * **Municipal Staff:** Authenticated via a **Custom JWT System** backed by bcrypt password hashes, SHA-256 refresh token tables, device fingerprints, and `HttpOnly`, `SameSite=Strict` cookies.
* **Rationale:**
  * Avoids paying high per-seat SaaS costs for municipal workers while providing high security.
  * Eliminates the risk of municipal staff authenticating with personal social logins.
  * Ensures zero cookie exposure to client-side JavaScript, mitigating XSS and token exfiltration.

---

### ADR-03: MongoDB Atlas with Native GeoJSON `2dsphere` Spatial Indexing
* **Context:** Civic complaints are inherently geographic. The database must support rapid nearest-neighbor searches, coordinate bounding boxes, and duplicate radius detection.
* **Decision:** Store coordinates as standardized **WGS 84 GeoJSON Points** (`{ type: "Point", coordinates: [lng, lat] }`) with a **`2dsphere` index**.
* **Rationale:**
  * Enables native `$near` and `$geoWithin` spherical calculations taking Earth's curvature into account.
  * Out-of-the-box support for spatial deduplication (e.g. `$maxDistance: 50` meters) directly in query plans without external GIS database extensions.

---

### ADR-04: Socket.IO with "Persist-Before-Emit" Pattern
* **Context:** Real-time updates are critical for field operations, but network failures or server restarts can cause phantom state updates if events are dispatched before persistence.
* **Decision:** Implement **Socket.IO** with a strict **Persist-Before-Emit** pattern and isolated room taxonomies (`user:*`, `role:*`, `department:*`, `complaint:*`).
* **Rationale:**
  * Guarantee: An event is emitted *only after* MongoDB transaction or update operation succeeds.
  * Multi-Room Isolation: Officers receive departmental updates without listening to unrelated complaints; citizens receive updates exclusively for their own complaints.
  * Auto-Recovery: Implemented client-side sliding-window deduplication and automated REST reconciliation on reconnect.

---

### ADR-05: Direct-to-S3 Pre-Signed Upload Intent Flow
* **Context:** Multi-megabyte camera photos taken by citizens and officers can easily overwhelm backend API memory and bandwidth if uploaded as multipart form-data.
* **Decision:** Implement a **Pre-Signed S3 Upload Intent** pattern where the client uploads files directly to Amazon S3.
* **Rationale:**
  * **Zero Server Bandwidth Consumption:** Binary media flows directly from the user's browser/mobile client to AWS S3.
  * **Validation Before Persistence:** The server issues pre-signed URLs only after verifying that the file type, size, and user permissions meet municipal criteria.
  * **Private Bucket Security:** The S3 bucket remains completely private; authenticated users view evidence via short-lived pre-signed GET URLs (TTL 15 mins).

---

### ADR-06: Ola Maps Web SDK v2 & Directions API
* **Context:** The application requires high-detail local street data, reverse geocoding, and routing across municipal jurisdictions.
* **Decision:** Integrate **Ola Maps Web SDK v2** layered on **MapLibre GL** for vector map rendering and the **Ola Directions API** for turn-by-turn routing.
* **Rationale:**
  * Highly optimized street-level data for Indian municipal zones and landmarks.
  * Full programmatic control over vector layers, custom markers, clustering, and dynamic polylines without heavy per-tile licensing overhead.
