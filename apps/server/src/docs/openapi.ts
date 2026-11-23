export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "CivicTrack Municipal Operations & Complaint Management API",
    version: "1.0.0",
    description:
      "Enterprise backend REST API for CivicTrack. Powering smart civic complaint triage, GeoJSON spatial discovery, Ola Maps navigation, private S3 evidence pipelines, real-time notification dispatch, and SLA escalation tracking.",
    contact: {
      name: "CivicTrack Development Team",
      url: "https://github.com/civictrack",
    },
    license: {
      name: "MIT",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "Primary Production & Staging v1 API Endpoint",
    },
    {
      url: "http://localhost:4000/api/v1",
      description: "Local Development Server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Clerk-issued authenticated session JWT bearer token for citizen endpoints.",
      },
      StaffCookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "civictrack_staff_access",
        description: "HttpOnly JWT session cookie for Admin and Field Officer staff authentication.",
      },
      StaffBearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Staff JWT bearer token for Admin and Officer operations.",
      },
      SvixAuth: {
        type: "apiKey",
        in: "header",
        name: "svix-signature",
        description: "Svix cryptographic signature for Clerk webhook verification.",
      },
    },
    schemas: {
      ApiResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
          meta: { type: "object" },
        },
        required: ["success", "data"],
      },
      ApiErrorResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Invalid request payload" },
              details: { type: "array", items: { type: "object" } },
            },
            required: ["code", "message"],
          },
          requestId: { type: "string", example: "609da833-68d3-41c9-a474-0176781c51ec" },
        },
        required: ["success", "error", "requestId"],
      },
      Coordinates: {
        type: "array",
        items: { type: "number" },
        minItems: 2,
        maxItems: 2,
        description: "[longitude, latitude] in WGS84 format",
        example: [77.5946, 12.9716],
      },
      ComplaintStatus: {
        type: "string",
        enum: [
          "SUBMITTED",
          "UNDER_REVIEW",
          "VERIFIED",
          "REJECTED",
          "ASSIGNED",
          "IN_PROGRESS",
          "RESOLVED",
          "CLOSED",
        ],
      },
      ComplaintCategory: {
        type: "string",
        enum: [
          "ROADS_POTHOLES",
          "WATER_SUPPLY",
          "GARBAGE_SANITATION",
          "DRAINAGE_SEWAGE",
          "STREETLIGHTS",
          "ELECTRICITY",
          "OTHER",
        ],
      },
      ComplaintPriority: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Liveness probe",
        description: "Returns process uptime and basic service health.",
        responses: {
          "200": {
            description: "Service is live",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiResponse" } } },
          },
        },
      },
    },
    "/ready": {
      get: {
        summary: "Readiness probe",
        description: "Validates MongoDB connectivity and readiness to receive operational traffic.",
        responses: {
          "200": { description: "Service and database connected and ready" },
          "503": { description: "Database is degraded or disconnected" },
        },
      },
    },
    "/users/me": {
      get: {
        summary: "Get current authenticated profile",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Current user profile" },
          "401": { description: "Authentication required" },
        },
      },
    },
    "/complaints": {
      get: {
        summary: "List complaints queue",
        description: "Paginated and role-scoped query of civic complaints.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
          { name: "status", in: "query", schema: { $ref: "#/components/schemas/ComplaintStatus" } },
          { name: "category", in: "query", schema: { $ref: "#/components/schemas/ComplaintCategory" } },
          { name: "priority", in: "query", schema: { $ref: "#/components/schemas/ComplaintPriority" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Paginated complaints list" },
          "401": { description: "Unauthorized" },
        },
      },
      post: {
        summary: "Submit new civic complaint",
        description: "Citizen submission with title, description, category, GeoJSON coordinates, and S3 evidence keys.",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description", "category", "location", "address"],
                properties: {
                  title: { type: "string", minLength: 5, maxLength: 120 },
                  description: { type: "string", minLength: 10, maxLength: 2000 },
                  category: { $ref: "#/components/schemas/ComplaintCategory" },
                  location: {
                    type: "object",
                    required: ["type", "coordinates"],
                    properties: {
                      type: { type: "string", enum: ["Point"] },
                      coordinates: { $ref: "#/components/schemas/Coordinates" },
                    },
                  },
                  address: { type: "string" },
                  evidenceObjectKeys: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Complaint created successfully with CT-YYYY-NNNNNN reference" },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/complaints/nearby": {
      get: {
        summary: "Find nearby complaints",
        description: "Geospatial $near spherical query for reports within radius. Returns strict public allowlist DTO.",
        parameters: [
          { name: "lng", in: "query", required: true, schema: { type: "number" } },
          { name: "lat", in: "query", required: true, schema: { type: "number" } },
          { name: "radius", in: "query", schema: { type: "number", default: 10000 } },
          { name: "category", in: "query", schema: { $ref: "#/components/schemas/ComplaintCategory" } },
        ],
        responses: {
          "200": { description: "List of nearby complaints (public allowlist fields only)" },
        },
      },
    },
    "/complaints/{id}": {
      get: {
        summary: "Get complaint details by ID",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Detailed complaint record with chronological audit history" },
          "404": { description: "Complaint not found" },
        },
      },
    },
    "/storage/upload-intent": {
      post: {
        summary: "Request AWS S3 pre-signed upload intents",
        description: "Generates secure pre-signed PUT URLs for JPEG/PNG/WebP attachments.",
        security: [{ BearerAuth: [] }, { StaffCookieAuth: [] }, { StaffBearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["files"],
                properties: {
                  files: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["filename", "contentType", "size"],
                      properties: {
                        filename: { type: "string" },
                        contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
                        size: { type: "integer", maximum: 10485760 },
                        checksum: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Pre-signed PUT URLs, headers, and object keys" },
          "400": { description: "Validation error or invalid file type" },
        },
      },
    },
    "/maps/status": {
      get: {
        summary: "Check Ola Maps SDK & Directions API status",
        responses: {
          "200": { description: "Configuration status of Ola Maps services" },
        },
      },
    },
    "/maps/directions": {
      post: {
        summary: "Calculate driving route with turn-by-turn maneuvers",
        description: "Queries Ola Maps Directions API with fallback routing engine.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["origin", "destination"],
                properties: {
                  origin: { $ref: "#/components/schemas/Coordinates" },
                  destination: { $ref: "#/components/schemas/Coordinates" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Route geometry, distance, duration, and turn maneuvers" },
        },
      },
    },
    "/analytics/summary": {
      get: {
        summary: "Municipal operations KPI & trend analytics",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "departmentId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Aggregated operational metrics, department breakdowns, and 14-day trend" },
          "401": { description: "Unauthorized" },
          "403": { description: "Requires Admin or Officer role" },
        },
      },
    },
    "/duplicates/{id}/candidates": {
      get: {
        summary: "Discover duplicate candidate reports",
        description: "250m geospatial and tokenized semantic text similarity inspection.",
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "List of candidates with similarity scores and explainable signal chips" },
          "401": { description: "Unauthorized" },
          "403": { description: "Requires Admin role" },
        },
      },
    },
    "/duplicates/{id}/link": {
      post: {
        summary: "Link complaint as duplicate of parent incident",
        description: "Advisory administrative linking preserving citizen records.",
        security: [{ BearerAuth: [] }, { StaffCookieAuth: [] }, { StaffBearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["duplicateOfId"],
                properties: {
                  duplicateOfId: { type: "string" },
                  remarks: { type: "string", maxLength: 500 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Complaint linked successfully" },
        },
      },
    },
    "/sla/scan": {
      post: {
        summary: "Execute on-demand SLA breach scanner",
        description: "Scans active unresolved incidents, detects breaches past dueAt, and idempotently logs escalations.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Audit summary of scanned and escalated complaints" },
          "401": { description: "Unauthorized" },
          "403": { description: "Requires Admin role" },
        },
      },
    },
    "/admin/invitations": {
      post: {
        summary: "Create a new staff invitation",
        description: "Admin creates a single-use cryptographically secure invitation for an Officer or Admin.",
        security: [{ StaffCookieAuth: [] }, { StaffBearerAuth: [] }],
        responses: {
          "201": { description: "Invitation created with secure single-use token" },
          "400": { description: "Validation error" },
          "403": { description: "Requires Admin role" },
        },
      },
      get: {
        summary: "List staff invitations",
        description: "Admin lists pending, accepted, or revoked staff invitations.",
        security: [{ StaffCookieAuth: [] }, { StaffBearerAuth: [] }],
        responses: {
          "200": { description: "List of invitations" },
          "403": { description: "Requires Admin role" },
        },
      },
    },
    "/admin/invitations/{id}/revoke": {
      post: {
        summary: "Revoke a staff invitation",
        description: "Admin revokes a pending staff invitation.",
        security: [{ StaffCookieAuth: [] }, { StaffBearerAuth: [] }],
        responses: {
          "200": { description: "Invitation revoked successfully" },
          "404": { description: "Invitation not found" },
        },
      },
    },
    "/staff/invitations/verify": {
      get: {
        summary: "Verify invitation token",
        description: "Public endpoint to preview role and department details for a valid invitation token.",
        responses: {
          "200": { description: "Token is valid and returns preview details" },
          "400": { description: "Invalid, expired, or already-used token" },
        },
      },
    },
    "/staff/invitations/accept": {
      post: {
        summary: "Accept invitation and register staff account",
        description: "Public onboarding endpoint. Consumes single-use token atomically and provisions staff account with server-derived role and department.",
        responses: {
          "201": { description: "Staff account created and session established" },
          "400": { description: "Validation or password requirements failed" },
          "409": { description: "Token already consumed or email conflict" },
        },
      },
    },
  },
};
