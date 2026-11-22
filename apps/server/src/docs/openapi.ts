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
        description: "Clerk-issued authenticated session JWT bearer token.",
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
          "POTHOLE",
          "STREETLIGHT",
          "GARBAGE",
          "WATER_LEAKAGE",
          "DRAINAGE",
          "ILLEGAL_PARKING",
          "TREE_FALLEN",
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
        description: "Geospatial $near spherical query for reports within radius.",
        parameters: [
          { name: "lng", in: "query", required: true, schema: { type: "number" } },
          { name: "lat", in: "query", required: true, schema: { type: "number" } },
          { name: "maxDistance", in: "query", schema: { type: "number", default: 5000 } },
        ],
        responses: {
          "200": { description: "List of nearby complaints" },
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
        security: [{ BearerAuth: [] }],
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
                      required: ["fileName", "fileType", "fileSize"],
                      properties: {
                        fileName: { type: "string" },
                        fileType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
                        fileSize: { type: "integer", maximum: 10485760 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Pre-signed PUT URLs and object keys" },
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
        security: [{ BearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["originalComplaintId"],
                properties: {
                  originalComplaintId: { type: "string" },
                  reason: { type: "string" },
                  notes: { type: "string" },
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
  },
};
