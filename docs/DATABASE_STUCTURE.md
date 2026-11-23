# CivicTrack Database Architecture & Schema Specification

CivicTrack utilizes **MongoDB Atlas** as its primary persistent operational datastore, engineered through **Mongoose** with strict TypeScript schemas, atomic sequence counters, compound querying indexes, TTL auto-expirations, and a dedicated GeoJSON `2dsphere` spatial indexing engine.

---

## 1. High-Level Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    User ||--o{ Complaint : "files (citizen)"
    User ||--o{ Complaint : "assigned to (officer)"
    User ||--o{ StaffSession : "authenticates (staff)"
    User ||--o{ Notification : "receives"
    User ||--o{ UploadIntent : "creates"
    Department ||--o{ User : "employs (officers)"
    Department ||--o{ Complaint : "routed to"
    Complaint ||--o{ ComplaintStatusHistory : "audit logs"
    Complaint ||--o{ SlaEscalation : "breaches triggers"
    Complaint ||--o{ Assignment : "dispatches"
    Complaint ||--o{ UploadIntent : "attaches evidence"
    Counter ||--|| Complaint : "atomically generates CT-YYYY-NNNNNN"

    User {
        ObjectId _id PK
        string clerkUserId UK "Sparse index for citizen OAuth"
        string email UK "Indexed, unique, lowercase"
        string passwordHash "Omitted from default queries"
        string name "Max 120 chars"
        string role "CITIZEN | OFFICER | ADMIN"
        ObjectId departmentId FK "Nullable for citizens/superadmins"
        boolean isActive "Default true"
        Date createdAt
        Date updatedAt
    }

    Department {
        ObjectId _id PK
        string name "Max 120 chars"
        string code UK "Uppercase, 2-20 chars"
        string description "Max 500 chars"
        string[] categories "Handled complaint categories"
        ObjectId headOfficerId FK "Nullable"
        boolean isActive "Default true"
        Date createdAt
        Date updatedAt
    }

    Complaint {
        ObjectId _id PK
        string referenceNumber UK "Format: CT-YYYY-NNNNNN"
        ObjectId citizenId FK "Indexed"
        string title "5-150 chars"
        string description "20-2000 chars"
        string category "Indexed"
        string status "SUBMITTED..CLOSED"
        string priority "LOW | MEDIUM | HIGH | CRITICAL"
        GeoJSON location "2dsphere indexed [lng, lat]"
        string address "Max 300 chars"
        string landmark "Max 150 chars"
        EvidenceItem[] evidence "Array of uploaded objects"
        ObjectId departmentId FK "Indexed"
        ObjectId assignedOfficerId FK "Indexed"
        Date dueAt "SLA resolution deadline"
        Date resolvedAt "Nullable"
        Date closedAt "Nullable"
        string rejectionReason "Max 500 chars"
        string resolutionRemarks "Max 1000 chars"
        EvidenceItem[] resolutionEvidence "Proof photos"
        number feedbackRating "1 to 5"
        string feedbackComment "Max 1000 chars"
        Date feedbackSubmittedAt
        ObjectId duplicateOf FK "Nullable"
        boolean isDuplicate "Default false"
        Date createdAt
        Date updatedAt
    }

    ComplaintStatusHistory {
        ObjectId _id PK
        ObjectId complaintId FK "Indexed"
        string fromStatus "Nullable for initial"
        string toStatus "Strict enum"
        ObjectId actorId FK "User who triggered"
        string remarks "Audit transition notes"
        EvidenceItem[] evidence "Photos attached to state"
        Date createdAt
    }

    Assignment {
        ObjectId _id PK
        ObjectId complaintId FK "Indexed"
        ObjectId departmentId FK
        ObjectId assignedOfficerId FK
        ObjectId assignedById FK "Admin user"
        string notes "Dispatch remarks"
        Date assignedAt
        Date completedAt "Nullable"
    }

    StaffSession {
        ObjectId _id PK
        ObjectId userId FK "Indexed"
        string role "ADMIN | OFFICER"
        string refreshTokenHash "SHA-256 indexed hash"
        string userAgent "Device fingerprint"
        string ipAddress "Audit IP"
        Date expiresAt "TTL Indexed (expires: 0)"
        boolean isRevoked "Default false"
        Date revokedAt
        Date createdAt
        Date updatedAt
    }

    StaffInvitation {
        ObjectId _id PK
        string email UK "Lowercase, indexed"
        string role "ADMIN | OFFICER"
        ObjectId departmentId FK "Nullable for admins"
        string tokenHash UK "Cryptographic invite token"
        Date expiresAt "TTL Indexed (expires: 0)"
        ObjectId invitedBy FK "Admin user"
        boolean isAccepted "Default false"
        Date acceptedAt
        Date createdAt
    }

    UploadIntent {
        ObjectId _id PK
        string objectKey UK "S3 Object Key"
        ObjectId userId FK "Uploader"
        string contentType "Allowed MIME types"
        number size "Bytes max 10MB"
        string checksum "Optional integrity hash"
        string status "PENDING | ATTACHED | EXPIRED"
        ObjectId complaintId FK "Nullable until attached"
        Date expiresAt "TTL Indexed (expires: 0)"
        Date createdAt
        Date updatedAt
    }

    SlaEscalation {
        ObjectId _id PK
        ObjectId complaintId FK "Indexed"
        Date dueAt "Original resolution deadline"
        Date escalatedAt "Timestamp of breach scan"
        number delayHours "Elapsed overdue duration"
        boolean isResolved "Default false, indexed"
        Date resolvedAt "Nullable"
        number notifiedAdminsCount "Notification dispatch counter"
        Date createdAt
        Date updatedAt
    }

    Notification {
        ObjectId _id PK
        ObjectId recipientId FK "Indexed"
        string type "STATUS_CHANGE | ASSIGNMENT | SLA_BREACH"
        string title "Max 200 chars"
        string message "Max 1000 chars"
        string resourceType "COMPLAINT | ASSIGNMENT | SYSTEM"
        string resourceId "Target entity ID"
        Date readAt "Nullable"
        Date createdAt
        Date updatedAt
    }

    Counter {
        string _id PK "e.g. complaint_seq_2026"
        number seq "Atomic sequence value"
    }
```

---

## 2. Detailed Collection Specifications

### 2.1 `complaints` Collection
The core operational document representing a civic issue reported by a citizen.

* **Primary Key:** `_id` (ObjectId)
* **Spatial System:** GeoJSON Point `[longitude, latitude]` obeying WGS 84 conventions.
* **Indexes:**
  ```javascript
  // 1. Geospatial 2dsphere index for proximity lookup & duplicate detection
  { location: "2dsphere" }

  // 2. Citizen complaint history timeline (descending)
  { citizenId: 1, createdAt: -1 }

  // 3. Workflow stage and global dashboard ordering
  { status: 1, createdAt: -1 }

  // 4. Department routing and prioritization
  { departmentId: 1, status: 1, priority: 1 }

  // 5. Field officer task workload
  { assignedOfficerId: 1, status: 1 }

  // 6. Unique reference number lookup
  { referenceNumber: 1 }, { unique: true }
  ```

---

### 2.2 `users` Collection
Manages identities for both public citizens (authenticated via Clerk OAuth) and municipal municipal employees (officers, supervisors, admins).

* **Indexes:**
  ```javascript
  // Unique email index
  { email: 1 }, { unique: true }

  // Sparse index for external Clerk identity
  { clerkUserId: 1 }, { unique: true, sparse: true }

  // Role & Department assignment filter
  { role: 1, departmentId: 1 }
  ```

---

### 2.3 `upload_intents` Collection
Enforces **Pre-Signed Upload Security**. No evidence photo can be attached to a complaint unless a pre-signed intent was generated, verified for MIME type and file size, and attached before expiration.

* **TTL Expiration:** Automatically garbage-collected if unused within 2 hours.
* **Indexes:**
  ```javascript
  { objectKey: 1 }, { unique: true }
  { userId: 1, status: 1 }
  { expiresAt: 1 }, { expireAfterSeconds: 0 } // MongoDB TTL Index
  ```

---

### 2.4 `staff_sessions` Collection
Manages long-lived refresh tokens and active hardware sessions for municipal officers and administrators.

* **Security:** Refresh tokens are never stored plaintext; they are hashed with SHA-256 before insertion.
* **TTL Expiration:** Automatically purged upon session expiration.
* **Indexes:**
  ```javascript
  { refreshTokenHash: 1 }, { unique: true }
  { userId: 1, isRevoked: 1 }
  { expiresAt: 1 }, { expireAfterSeconds: 0 } // MongoDB TTL Index
  ```

---

### 2.5 `sla_escalations` Collection
Tracks automated SLA breach records identified by the background cron worker.

* **Indexes:**
  ```javascript
  { complaintId: 1 }
  { isResolved: 1, delayHours: -1 }
  ```

---

### 2.6 `counters` Collection
Provides **Atomic Reference Number Generation** via MongoDB's native `$inc` and `findOneAndUpdate(..., { upsert: true })`.

* **Document Structure:**
  ```json
  {
    "_id": "complaint_seq_2026",
    "seq": 1042
  }
  ```
* **Format Generated:** `CT-YYYY-NNNNNN` (e.g., `CT-2026-001042`).

---

## 3. Data Integrity & Concurrency Controls

1. **Atomic Lifecycle Transitions:** State updates are validated against `isValidStatusTransition()` in `@civictrack/contracts` before executing atomic Mongoose operations.
2. **Persist-Before-Emit Pattern:** In real-time events, the MongoDB transaction or update is committed **before** emitting events across Socket.IO rooms. If the write fails, no ghost events are dispatched.
3. **Optimistic Locking & Duplicate Suppression:** Spatial queries leverage spherical distance calculations (`$maxDistance` in meters) paired with category matching to prevent accidental double-reporting within a 50-meter radius.
