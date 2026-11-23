# CivicTrack Comprehensive Features Specification

CivicTrack bridges the communication gap between citizens and municipal authorities by transforming civic grievance management into a high-visibility, data-driven, and real-time operational workflow.

---

## 1. Citizen Portal Features

### 📍 1.1 Precision Geospatial Reporting
* **Interactive Map Pinning:** Citizens can drop a pin on vector maps using the Ola Maps SDK / MapLibre GL engine or use device GPS geolocation to report exact incident coordinates.
* **Reverse Geocoding:** Automatically translates GPS coordinates into standardized street names, postal codes, and municipal wards.
* **Landmark Tagging:** Allows citizens to provide contextual landmarks (e.g. "Opposite Metro Pillar 140") to assist field workers.

### 📸 1.2 Multi-Media Direct Evidence Upload
* **Bandwidth-Optimized Uploads:** Evidence photos are uploaded directly to Amazon S3 via time-limited pre-signed PUT URLs, preventing file upload bottlenecks on the backend server.
* **Integrity & Type Validation:** Enforces strict client and server validation on file formats (JPEG, PNG, WebP) and restricts sizes to under 10MB.
* **Evidence Lightbox Viewer:** Integrated zoomable image lightbox viewer with EXIF metadata, timestamp, and MIME type inspection.

### 🔄 1.3 Real-Time Status Tracking & Audit Logs
* **Live Step-Tracker UI:** Visual step-progress bar representing every lifecycle stage: `Submitted` ➔ `Reviewed` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved` ➔ `Closed`.
* **Instantaneous Socket Updates:** When a status changes or an officer is assigned, the citizen’s UI updates immediately without needing to refresh the page.
* **Chronological Audit History:** Displays timestamped transition history, remarks by municipal staff, and photographic proof of resolution.

### ⭐ 1.4 Citizen Resolution Feedback
* Once an incident is marked `RESOLVED`, the citizen can submit a 1 to 5-star rating and satisfaction review.
* If unsatisfied, the citizen can reject the resolution with feedback, automatically returning the status to `IN_PROGRESS`.

### 🔍 1.5 Community Proximity Map
* Explores nearby civic issues on an interactive public map.
* **Privacy Allowlist DTO:** All citizen PII (name, phone, email, internal officer assignments, and raw evidence keys) is strictly stripped from the public feed.

---

## 2. Field Officer Experience

### 📋 2.1 Dedicated Task Management Queue
* **Role-Scoped Task Feed:** Field officers view only the complaints explicitly assigned to them or their department.
* **Urgency Indicators:** Color-coded priority badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) and visual warning indicators for complaints approaching SLA deadlines.

### 🧭 2.2 Turn-by-Turn Field Navigation
* **Live GPS Directions:** Directly integrated with Ola Maps Directions API, generating turn-by-turn navigation routes and distance estimates from the officer's current location to the incident site.
* **Maneuver Instructions:** Displays step-by-step driving directions inside a mobile-friendly slide-over panel.

### 🛠️ 2.3 Field Action Execution & Work Proof
* **One-Tap "Start Work":** Changes status to `IN_PROGRESS` and notifies the citizen and supervisory dashboard in real time.
* **Resolution Proof Upload:** Officers upload "after" photos directly from the field site to prove resolution before marking the ticket `RESOLVED`.
* **Reassignment Requests:** Officers can request department reassignment if an issue belongs to a different utility (e.g. water leakage under an electric pole).

---

## 3. Municipal Command Center (Admin)

### 📊 3.1 Real-Time Analytics & Operational Intelligence
* **Key Performance Indicators (KPIs):** Instant metrics for Total Complaints, Resolution Rate (%), Active SLA Compliance (%), and Overdue Tickets.
* **14-Day Inflow vs. Resolution Trend:** Visual daily bar charts comparing complaints submitted against complaints closed.
* **Department Performance Breakdown:** Tracks complaint volume, resolution rate, and overdue tickets across all municipal departments.
* **Category & Severity Breakdown:** Donut and distribution matrices showing top reported civic issues.

### 🏢 3.2 Department & Category Routing
* Create and manage municipal departments (e.g., Roads & Infrastructure, Water & Sewage, Electrical, Public Health).
* Map departments to specific civic categories with automatic routing rules.
* View and manage roster of field officers assigned to each department.

### 👮 3.3 Staff Governance & Invitations
* **Cryptographic Invitations:** Admins generate secure invitation tokens with assigned departments and roles.
* **Direct Staff Management:** Activate/deactivate officer accounts, update role permissions, and reassign departmental jurisdictions.

### ⏱️ 3.4 SLA Monitoring & Auto-Escalation Engine
* Automated background workers periodically evaluate open complaints against severity-based SLA deadlines.
* Overdue tickets trigger automated escalation records, audit notifications, and priority badges in administrative queues.
* Manual SLA scan button allows immediate on-demand audits.

---

## 4. Platform & Engineering Capabilities

* **Monorepo Architecture:** npm workspaces with shared contracts package (`@civictrack/contracts`).
* **Dual Authentication:** Clerk OAuth2 for public citizens + Secure Custom JWT with HttpOnly cookies for municipal staff.
* **Socket.IO Real-time Engine:** Room taxonomy (`user:*`, `role:*`, `department:*`, `complaint:*`) with deduplication and reconnect reconciliation.
* **Geospatial 2dsphere Indexing:** Sub-millisecond geographic proximity queries and duplicate suppression within a 50m radius.
* **Cloud-Native Storage:** Direct S3 pre-signed upload flow with temporary access keys.
* **Automated CI/CD:** GitHub Actions test, lint, typecheck gates, and multi-stage Docker container publishing to GHCR.
