# CivicTrack System Architecture Specification

CivicTrack is an enterprise-grade municipal civic complaint management and automated resolution system engineered with a high-throughput **Node.js 24/Express** backend, a **Next.js 16 (App Router)** client application, **MongoDB Atlas** with spatial indexing, **Socket.IO** real-time event streaming, and **AWS S3** pre-signed object storage.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Clients["Presentation Layer (Next.js 16 App Router)"]
        CP["Citizen Portal (Mobile/Desktop Web)"]
        FO["Field Officer PWA (Turn-by-Turn Navigation)"]
        AC["Municipal Admin Command Center"]
    end

    subgraph Edge["Gateway & Security Edge"]
        Nginx["Reverse Proxy / SSL Termination"]
        RateLimit["Rate Limiting & Helmet Guard"]
        CSRF["CSRF & Origin Protection"]
    end

    subgraph CoreServices["Backend Application Core (Express + TypeScript)"]
        API["REST API Router (/api/v1)"]
        SocketServer["Socket.IO Real-Time Server"]
        AuthMiddleware["Dual Auth Guard (Clerk + Staff JWT)"]
        WorkflowEngine["Complaint State Machine Engine"]
        SlaEngine["Automated SLA & Escalation Scheduler"]
        SpatialEngine["Geospatial & Proximity Query Engine"]
    end

    subgraph DataAndStorage["Persistent Storage Layer"]
        Mongo[("MongoDB Atlas (GeoJSON 2dsphere)")]
        S3[("Amazon S3 (Encrypted Evidence Bucket)")]
    end

    subgraph ExternalIntegrations["Third-Party Managed Services"]
        Clerk["Clerk Identity (Citizen OAuth & Session Management)"]
        OlaMaps["Ola Maps SDK / Directions API (Turn-by-Turn Routing)"]
        Svix["Svix Webhook Verification Engine"]
    end

    %% Client Interactions
    CP -->|HTTPS / REST| Edge
    FO -->|HTTPS / REST| Edge
    AC -->|HTTPS / REST| Edge
    CP -.->|WSS / Real-time| SocketServer
    FO -.->|WSS / Real-time| SocketServer
    AC -.->|WSS / Real-time| SocketServer

    %% Edge routing
    Edge --> AuthMiddleware
    AuthMiddleware --> API

    %% Backend workflows
    API --> WorkflowEngine
    API --> SpatialEngine
    WorkflowEngine --> Mongo
    SpatialEngine --> Mongo
    WorkflowEngine -.->|Persist-Before-Emit| SocketServer
    SlaEngine --> Mongo
    SlaEngine -.->|SLA Breach Event| SocketServer

    %% External APIs
    API -->|Pre-signed URLs| S3
    API -->|Routing Matrix| OlaMaps
    API -->|Session Validation| Clerk
    API -->|Webhook Signatures| Svix
```

---

## 2. Monorepo Architecture

CivicTrack is organized as an **npm workspaces monorepo** to maximize code reuse, establish strict compile-time boundaries, and guarantee type safety across frontend and backend tiers:

```text
CivicTrack/
├── packages/
│   ├── contracts/        # Shared Zod schemas, lifecycle enums, DTOs & event types
│   └── config/           # Standardized ESLint, Prettier, and TypeScript configurations
├── apps/
│   ├── server/           # Express REST API, Mongoose models, and Socket.IO server
│   └── web/              # Next.js 16 App Router frontend with Tailwind & MapLibre GL
└── docs/                 # Architectural specifications, ERD, and deployment guides
```

### Shared Contracts (`@civictrack/contracts`)
Both `apps/server` and `apps/web` import strict Zod schemas and TypeScript interfaces from `@civictrack/contracts`. This guarantees:
* Zero discrepancy between client form validation and backend input parsing.
* Single source of truth for the complaint state machine (`isValidStatusTransition`).
* Typed Socket.IO event payloads across WebSocket boundaries.

---

## 3. Dual Identity & Authentication Architecture

CivicTrack implements a **hybrid identity architecture** tailored to user roles:

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as Citizen
    actor Staff as Municipal Officer / Admin
    participant Client as Next.js Client
    participant Server as Express Server
    participant Clerk as Clerk Identity Provider
    participant DB as MongoDB Atlas

    %% Citizen Auth
    Note over Citizen,Clerk: Citizen Authentication Flow (Clerk OAuth2)
    Citizen->>Client: Sign in with Google / Email
    Client->>Clerk: Authenticate & issue session JWT
    Clerk-->>Client: Return Client Session Token
    Client->>Server: Request with Authorization: Bearer <clerk_token>
    Server->>Server: Verify Clerk session & extract user ID
    Server->>DB: Upsert user record (role: CITIZEN)

    %% Staff Auth
    Note over Staff,DB: Municipal Staff Authentication Flow (Custom JWT)
    Staff->>Client: Submit staff email & high-entropy password
    Client->>Server: POST /api/v1/staff/auth/login
    Server->>DB: Query User & verify bcrypt passwordHash
    Server->>DB: Create StaffSession record with SHA-256 refreshTokenHash
    Server-->>Client: Set HttpOnly, Secure, SameSite=Strict cookies (access_token, refresh_token)
    Client->>Server: Subsequent requests send HttpOnly Cookie with X-CSRF-Protection
```

---

## 4. Real-Time Event Architecture (Socket.IO)

CivicTrack uses **Socket.IO** with a strict **Persist-Before-Emit** pattern and isolated room taxonomies:

### 4.1 Room Taxonomy
* `user:{userId}`: Direct personal notifications (e.g. status changes on reported complaints).
* `role:{citizen|officer|admin}`: Role-wide broadcasts (e.g. administrative announcements).
* `department:{departmentId}`: Scoped dispatches (e.g. new complaint assigned to Roads & Bridges).
* `complaint:{complaintId}`: Targeted audit tracking (e.g. comments, live field updates).

### 4.2 Dual-Handshake Authentication
1. **Citizens:** Authenticated during handshake via Clerk bearer token verified through `@clerk/express`.
2. **Staff:** Authenticated via HttpOnly staff session cookie or handshake query token verified against `STAFF_JWT_ACCESS_SECRET`.

### 4.3 Resilience & Reconnection Recovery
* **Sliding-Window Event Deduplication:** Client-side event IDs are tracked in a 30-second TTL cache to eliminate duplicate UI renders during network flaps.
* **Stale-State Reconciliation:** Upon WebSocket reconnect, the client automatically triggers background REST synchronization to fetch changes that occurred during downtime.

---

## 5. Complaint Lifecycle State Machine

Complaints strictly progress according to the validated municipal lifecycle:

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Citizen Reports Issue

    SUBMITTED --> REVIEWED : Admin / Officer Reviews
    SUBMITTED --> REJECTED : Invalid / Non-Civic Issue
    SUBMITTED --> ASSIGNED : Directly Assigned to Dept

    REVIEWED --> ASSIGNED : Department & Officer Dispatched
    REVIEWED --> REJECTED : Out of Jurisdiction

    ASSIGNED --> IN_PROGRESS : Officer Starts Field Work
    ASSIGNED --> REJECTED : Deemed Infeasible

    IN_PROGRESS --> RESOLVED : Officer Uploads Resolution Proof
    IN_PROGRESS --> ASSIGNED : Reassigned to Different Officer

    RESOLVED --> CLOSED : Citizen Satisfied / Auto-Closed
    RESOLVED --> IN_PROGRESS : Work Rejected by Citizen / Admin

    CLOSED --> [*]
    REJECTED --> [*]
```

---

## 6. Geospatial Engine & Turn-by-Turn Navigation

```mermaid
flowchart LR
    A["GPS Coordinates\n[lng, lat]"] --> B["GeoJSON Point Schema\nValidation"]
    B --> C["MongoDB 2dsphere\nSpatial Index"]
    C --> D["$near / $geoWithin\nProximity Search"]
    D --> E["Ola Maps Web SDK v2\nVector Tile Visualizer"]
    E --> F["Ola Directions API\nTurn-by-Turn Routing"]
```

1. **GeoJSON Standard:** Coordinates are strictly stored as `[longitude, latitude]` following WGS 84 conventions.
2. **Spatial Deduplication:** When a complaint is filed, the backend searches within a 50m radius for complaints with matching categories to prevent duplicate reports.
3. **Field Navigation:** Officers receive turn-by-turn routing directly inside the progressive web app via Ola Maps Directions API.

---

## 7. Secure S3 Pre-Signed Upload Intent Flow

CivicTrack avoids routing multi-megabyte media uploads through the API server, eliminating bandwidth bottlenecks:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Citizen / Officer
    participant Server as Express Server
    participant DB as MongoDB Atlas
    participant S3 as Amazon S3

    Client->>Server: POST /api/v1/storage/upload-intent {contentType, size, filename}
    Server->>Server: Validate MIME type (JPEG/PNG/WebP/PDF) & Size (< 10MB)
    Server->>DB: Create UploadIntent (status: PENDING, expires: 2h)
    Server->>S3: Generate Pre-Signed S3 PUT URL (TTL: 15 mins)
    Server-->>Client: Return pre-signed PUT URL & objectKey
    Client->>S3: PUT binary file directly to S3 Bucket
    Client->>Server: POST /api/v1/complaints {..., evidence: [{objectKey}]}
    Server->>DB: Validate UploadIntent exists, belongs to user, and is PENDING
    Server->>DB: Create Complaint & update UploadIntent to ATTACHED
```

---

## 8. Automated SLA Escalation Engine

* **Deterministic Deadlines:** Based on priority (`CRITICAL`: 12h, `HIGH`: 24h, `MEDIUM`: 48h, `LOW`: 72h).
* **Automated Cron Scanner:** A background worker runs every 15 minutes checking for `status !== 'RESOLVED'` and `dueAt < now`.
* **Escalation Hierarchy:** Creates an `SlaEscalation` audit record, triggers emergency administrative notifications, and dispatches real-time alerts across `role:admin` and department rooms.
