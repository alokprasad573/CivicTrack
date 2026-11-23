# CivicTrack REST API Specification (v1)

Base URL: `http://localhost:4000/api/v1` (Development) | `https://api.civictrack.gov/api/v1` (Production)

All API responses follow a uniform envelope format:
```json
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "total": 42 } // Optional pagination
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title must be at least 5 characters",
    "details": [ ... ]
  },
  "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
}
```

---

## 1. Authentication & Security Edge

CivicTrack uses a **Dual Authentication Model**:
1. **Citizens:** Authenticated via `Authorization: Bearer <clerk_session_jwt>`.
2. **Municipal Staff:** Authenticated via HttpOnly cookies (`access_token`, `refresh_token`) or `Authorization: Bearer <staff_jwt_token>`.

### Common Error Codes:
* `400 VALIDATION_ERROR`: Invalid payload (Zod parsing error).
* `401 UNAUTHORIZED`: Missing, expired, or invalid session token.
* `403 FORBIDDEN`: Insufficient role permissions (`UserRole`).
* `404 NOT_FOUND`: Resource does not exist.
* `409 CONFLICT`: Duplicate resource (e.g. email or department code already registered).
* `429 RATE_LIMIT_EXCEEDED`: Too many requests (Standard: 100 req/15m; Strict Auth: 5 req/15m).

---

## 2. Complaint Management (`/complaints`)

### 2.1 File a Complaint
* **Endpoint:** `POST /api/v1/complaints`
* **Auth:** Citizen (`CITIZEN`, `ADMIN`)
* **Request Body:**
```json
{
  "title": "Severe Pothole causing traffic backup",
  "description": "Deep waterlogged pothole near the bus terminus causing accidents.",
  "category": "ROADS_AND_BRIDGES",
  "location": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "address": "12th Cross Road, Indira Nagar, Bengaluru",
  "landmark": "Near Metro Pillar 42",
  "evidence": [
    {
      "objectKey": "evidence/complaints/1740300000-pothole.jpg",
      "contentType": "image/jpeg",
      "size": 2451000
    }
  ]
}
```
* **Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "_id": "65e0a123456789abcdef0001",
    "referenceNumber": "CT-2026-000142",
    "status": "SUBMITTED",
    "priority": "MEDIUM",
    "title": "Severe Pothole causing traffic backup",
    "createdAt": "2026-11-23T12:00:00.000Z"
  }
}
```

### 2.2 List Complaints (Filtered & Paginated)
* **Endpoint:** `GET /api/v1/complaints`
* **Auth:** Authenticated User
* **Query Parameters:**
  * `page` (default `1`): Page number.
  * `limit` (default `20`, max `100`): Results per page.
  * `status` (optional): `SUBMITTED`, `REVIEWED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`, `REJECTED`.
  * `category` (optional): `ROADS_AND_BRIDGES`, `WATER_SUPPLY`, `ELECTRICITY`, `SANITATION`, etc.
  * `priority` (optional): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
  * `departmentId` (optional): Target municipal department.
  * `search` (optional): Text search across title, reference number, or address.
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": { "total": 85, "page": 1, "limit": 20, "totalPages": 5 }
}
```

### 2.3 Discover Nearby Complaints (Public Map Discovery)
* **Endpoint:** `GET /api/v1/complaints/nearby`
* **Auth:** Public / Unauthenticated (PII Stripped)
* **Query Parameters:**
  * `lng` (required): Longitude (-180 to 180).
  * `lat` (required): Latitude (-90 to 90).
  * `radius` (optional, default `10000`): Search radius in meters (max 100km).
  * `category` (optional): Filter by category.
  * `includeClosed` (optional, default `false`): Include closed complaints.
* **Response (`200 OK`):** Strips citizen identity, internal officer assignments, and private evidence keys.
```json
{
  "success": true,
  "data": [
    {
      "id": "65e0a123456789abcdef0001",
      "referenceNumber": "CT-2026-000142",
      "title": "Severe Pothole causing traffic backup",
      "category": "ROADS_AND_BRIDGES",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "location": { "type": "Point", "coordinates": [77.5946, 12.9716] },
      "address": "12th Cross Road, Bengaluru",
      "createdAt": "2026-11-23T12:00:00.000Z"
    }
  ]
}
```

### 2.4 Get Complaint Details
* **Endpoint:** `GET /api/v1/complaints/:id`
* **Auth:** Authenticated User
* **Response (`200 OK`):** Returns complete complaint document, populated department and officer, full status audit history, and pre-signed view URLs for evidence photos.

### 2.5 Workflow Transitions
All transitions enforce the `isValidStatusTransition()` municipal state machine:

| Method | Endpoint | Allowed Roles | Request Payload | Target Status |
| :--- | :--- | :--- | :--- | :--- |
| `PATCH` | `/complaints/:id/review` | `ADMIN`, `OFFICER` | `{ "remarks": "Reviewed by supervisor" }` | `REVIEWED` |
| `PATCH` | `/complaints/:id/verify` | `ADMIN` | `{ "priority": "HIGH", "remarks": "Valid emergency" }` | `REVIEWED` |
| `POST` | `/complaints/:id/assign` | `ADMIN` | `{ "departmentId": "...", "assignedOfficerId": "...", "priority": "HIGH", "dueAt": "..." }` | `ASSIGNED` |
| `PATCH` | `/complaints/:id/start-work` | `OFFICER` | `{ "remarks": "Team dispatched with repair asphalt" }` | `IN_PROGRESS` |
| `PATCH` | `/complaints/:id/resolve` | `OFFICER` | `{ "remarks": "Pothole filled and sealed", "evidence": [{ "objectKey": "..." }] }` | `RESOLVED` |
| `PATCH` | `/complaints/:id/close` | `CITIZEN`, `ADMIN` | `{ "remarks": "Confirmed resolved on site" }` | `CLOSED` |
| `PATCH` | `/complaints/:id/reject` | `ADMIN`, `OFFICER` | `{ "reason": "Private road, out of municipal jurisdiction" }` | `REJECTED` |

### 2.6 Submit Citizen Feedback
* **Endpoint:** `POST /api/v1/complaints/:id/feedback`
* **Auth:** Complaint Owner (`CITIZEN`)
* **Request Body:**
```json
{
  "rating": 5,
  "comment": "Repaired within 24 hours. Excellent response!"
}
```

---

## 3. Storage & Evidence Uploads (`/storage`)

CivicTrack uses the **Pre-Signed Upload Intent Flow** to prevent large media uploads from blocking API server threads.

### 3.1 Request Pre-Signed Upload Intent
* **Endpoint:** `POST /api/v1/storage/upload-intent`
* **Auth:** Authenticated User
* **Request Body:**
```json
{
  "contentType": "image/jpeg",
  "size": 3145728,
  "filename": "site_photo.jpg"
}
```
* **Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://civictrack-bucket.s3.ap-south-1.amazonaws.com/evidence/65e...jpg?AWSAccessKeyId=...",
    "objectKey": "evidence/complaints/65e0a123-site_photo.jpg",
    "expiresAt": "2026-11-23T12:15:00.000Z"
  }
}
```

### 3.2 Get Pre-Signed Read URL
* **Endpoint:** `GET /api/v1/storage/view-url?objectKey=evidence/...`
* **Auth:** Authenticated User
* **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "viewUrl": "https://civictrack-bucket.s3.ap-south-1.amazonaws.com/evidence/...?signature=...",
    "expiresIn": 900
  }
}
```

---

## 4. Municipal Staff Authentication & Session Management (`/staff/auth`)

### 4.1 Staff Login
* **Endpoint:** `POST /api/v1/staff/auth/login`
* **Request Body:**
```json
{
  "email": "officer.sharma@bbmp.gov.in",
  "password": "SecurePassword123!"
}
```
* **Response (`200 OK`):** Sets `access_token` (15m) and `refresh_token` (7d) as `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Returns user object and accessToken.

### 4.2 Refresh Access Token
* **Endpoint:** `POST /api/v1/staff/auth/refresh`
* **Auth:** HttpOnly `refresh_token` Cookie
* **Response (`200 OK`):** Issues new `access_token` and rotates `refresh_token`.

### 4.3 Staff Logout
* **Endpoint:** `POST /api/v1/staff/auth/logout`
* **Response (`200 OK`):** Marks `StaffSession` revoked in database and clears all authentication cookies.

### 4.4 Staff Invitation Management (Admin)
* `POST /api/v1/staff/invitations`: Generate officer invite with department mapping and cryptographic token.
* `GET /api/v1/staff/invitations/verify?token=...`: Verify invitation token before displaying signup form.
* `POST /api/v1/staff/invitations/accept`: Accept invite, create staff user, and set initial password.

---

## 5. Municipal Departments (`/departments`)

* `GET /api/v1/departments`: Public list of all active municipal departments and supported categories.
* `POST /api/v1/departments` (`ADMIN`): Register a new department (`name`, `code`, `categories`).
* `GET /api/v1/departments/:id`: Fetch department details.
* `GET /api/v1/departments/:id/officers` (`ADMIN`, `OFFICER`): Fetch list of active officers assigned to a department.

---

## 6. Geospatial & Navigation (`/maps`)

* `GET /api/v1/maps/status`: Health and configuration check for Ola Maps SDK integration.
* `GET /api/v1/maps/geocode?query=Indiranagar`: Search coordinates for an address query.
* `GET /api/v1/maps/reverse-geocode?lat=12.9716&lng=77.5946`: Convert coordinates to formatted civic street address.
* `GET /api/v1/maps/directions?originLat=12.97&originLng=77.59&destLat=12.98&destLng=77.61`: Return turn-by-turn route geometry and maneuver steps via Ola Directions API.

---

## 7. Duplicate Detection (`/duplicates`)

* **Endpoint:** `POST /api/v1/duplicates/check`
* **Auth:** Authenticated User
* **Request Body:**
```json
{
  "location": { "type": "Point", "coordinates": [77.5946, 12.9716] },
  "category": "ROADS_AND_BRIDGES",
  "radiusMeters": 50
}
```
* **Response (`200 OK`):** Returns existing open complaints within the 50m radius that match the category.

---

## 8. SLA Monitoring & Escalations (`/sla`)

* `GET /api/v1/sla/config`: Return configured SLA duration thresholds per priority level.
* `GET /api/v1/sla/escalations` (`ADMIN`): List all active SLA breach records.
* `POST /api/v1/sla/scan` (`ADMIN`): Trigger immediate scan of all open complaints for SLA overdue breaches.

---

## 9. Real-Time Analytics (`/analytics`)

* `GET /api/v1/analytics/summary` (`ADMIN`): Aggregates total complaints, resolution percentage, active SLA compliance, 14-day trends, category distribution, and department rankings.
* `GET /api/v1/analytics/sla-standing` (`ADMIN`): Department-specific breakdown of overdue vs compliant issues.

---

## 10. Real-Time Notifications (`/notifications`)

* `GET /api/v1/notifications`: List personal notifications for the authenticated user.
* `PATCH /api/v1/notifications/:id/read`: Mark an individual notification as read.
* `PATCH /api/v1/notifications/read-all`: Mark all unread notifications as read.

---

## 11. System Health & Documentation

* `GET /api/v1/health`: Liveness probe (HTTP 200).
* `GET /api/v1/ready`: Readiness probe verifying MongoDB database connection.
* `GET /api/v1/docs`: Interactive Swagger UI OpenAPI 3.0 documentation.
* `GET /api/v1/docs/openapi.json`: Raw OpenAPI 3.0 specification.
