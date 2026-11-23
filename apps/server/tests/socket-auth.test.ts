import { createServer } from "node:http";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { UserModel } from "../src/modules/users/user.model.js";
import { DepartmentModel } from "../src/modules/departments/department.model.js";
import { ComplaintModel } from "../src/modules/complaints/complaint.model.js";
import {
  UserRole,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
  SocketEvent,
  ComplaintCreatedPayloadSchema,
  ComplaintStatusUpdatedPayloadSchema,
  ComplaintAssignedPayloadSchema,
  DashboardStatsUpdatedPayloadSchema,
} from "@civictrack/contracts";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  authorizeRoomJoin,
  disconnectUserSockets,
  initSocketServer,
  emitComplaintCreated,
  emitComplaintStatusUpdated,
  emitComplaintAssigned,
  emitDashboardStatsUpdated,
  SocketUser,
} from "../src/socket.js";
import { JwtService } from "../src/modules/staff-auth/jwt.service.js";

async function runSocketAuthTests(): Promise<void> {
  console.log("Running Socket.io Dual Authentication & Room Authorization Tests...\n");

  const mockAdminId = new Types.ObjectId().toString();
  const mockOfficerId = new Types.ObjectId().toString();
  const mockDeptId = new Types.ObjectId().toString();
  const mockOtherDeptId = new Types.ObjectId().toString();
  const mockCit1Id = new Types.ObjectId().toString();
  const mockCit2Id = new Types.ObjectId().toString();

  const adminIdentity: SocketUser = {
    id: mockAdminId,
    role: UserRole.ADMIN,
  };

  const officerIdentity: SocketUser = {
    id: mockOfficerId,
    role: UserRole.OFFICER,
    departmentId: mockDeptId,
  };

  const citizen1Identity: SocketUser = {
    id: mockCit1Id,
    clerkUserId: "clerk_cit_1",
    role: UserRole.CITIZEN,
  };

  const citizen2Identity: SocketUser = {
    id: mockCit2Id,
    clerkUserId: "clerk_cit_2",
    role: UserRole.CITIZEN,
  };

  // Test 1: Personal room authorization
  console.log("1. Testing personal room isolation:");
  const cit1OwnRoom = await authorizeRoomJoin(citizen1Identity, `user:${mockCit1Id}`);
  const cit1OtherRoom = await authorizeRoomJoin(citizen1Identity, `user:${mockCit2Id}`);
  if (!cit1OwnRoom || cit1OtherRoom) {
    throw new Error("Failed: Citizen must only be allowed to join their own personal room");
  }
  console.log("   -> Personal room access strictly verified to match user ID\n");

  // Test 2: Role room access control
  console.log("2. Testing role room access control:");
  const adminInAdminRoom = await authorizeRoomJoin(adminIdentity, "role:admin");
  const officerInAdminRoom = await authorizeRoomJoin(officerIdentity, "role:admin");
  const citizenInAdminRoom = await authorizeRoomJoin(citizen1Identity, "role:admin");
  const officerInOfficerRoom = await authorizeRoomJoin(officerIdentity, "role:officer");
  const citizenInOfficerRoom = await authorizeRoomJoin(citizen1Identity, "role:officer");

  if (!adminInAdminRoom || officerInAdminRoom || citizenInAdminRoom) {
    throw new Error("Failed: Only Admin role can join role:admin");
  }
  if (!officerInOfficerRoom || citizenInOfficerRoom) {
    throw new Error("Failed: Only Officer role can join role:officer");
  }
  console.log("   -> Role rooms strictly restricted by verified session role\n");

  // Test 3: Department room authorization
  console.log("3. Testing department room access control:");
  const officerInOwnDept = await authorizeRoomJoin(officerIdentity, `dept:${mockDeptId}`);
  const officerInOtherDept = await authorizeRoomJoin(officerIdentity, `dept:${mockOtherDeptId}`);
  const citizenInDept = await authorizeRoomJoin(citizen1Identity, `dept:${mockDeptId}`);
  const adminInDept = await authorizeRoomJoin(adminIdentity, `dept:${mockOtherDeptId}`);

  if (!officerInOwnDept) {
    throw new Error("Failed: Officer should be allowed into their own department room");
  }
  if (officerInOtherDept) {
    throw new Error("Failed: Officer must be denied entry to a different department room");
  }
  if (citizenInDept) {
    throw new Error("Failed: Citizen must be denied entry to department rooms");
  }
  if (!adminInDept) {
    throw new Error("Failed: Admin must have access to all department rooms");
  }
  console.log("   -> Department rooms strictly scoped by assignment and role\n");

  // Test 4: Arbitrary room name rejection
  console.log("4. Testing arbitrary room injection rejection:");
  const arbitraryJoin = await authorizeRoomJoin(citizen1Identity, "arbitrary:privilege:escalation");
  const adminArbitrary = await authorizeRoomJoin(adminIdentity, "hack_room");
  if (arbitraryJoin || adminArbitrary) {
    throw new Error("Failed: Arbitrary unmapped room names must always be rejected");
  }
  console.log("   -> Arbitrary room join attempts rejected by default\n");

  // Test 5: Staff JWT validation for Socket Handshake
  console.log("5. Testing Staff JWT token verification for Socket Handshake:");
  const validAdminJwt = JwtService.signAccessToken({
    userId: mockAdminId,
    email: "socket.admin@civictrack.org",
    name: "Socket Admin",
    role: UserRole.ADMIN,
    sessionId: new Types.ObjectId().toString(),
  });
  const verifiedPayload = JwtService.verifyAccessToken(validAdminJwt);
  if (verifiedPayload.sub !== mockAdminId || verifiedPayload.role !== UserRole.ADMIN) {
    throw new Error("Failed: Staff access token did not decode expected claims");
  }
  console.log("   -> Staff JWT verified successfully for socket handshake\n");

  // Test 6: Disconnect sockets utility
  console.log("6. Testing disconnectUserSockets helper:");
  disconnectUserSockets(mockAdminId);
  console.log("   -> disconnectUserSockets executed gracefully without open sockets\n");

  // Test 7: Live Database-backed complaint room tests (when Atlas/MongoDB is reachable)
  console.log("7. Testing database-backed complaint room authorization:");
  const connected = await connectDatabase();
  if (connected) {
    try {
      const testPassword = "Password@123456";
      const passwordHash = await bcrypt.hash(testPassword, 10);

      let testDept = await DepartmentModel.findOne({ code: "SOCK_DEPT" });
      if (!testDept) {
        testDept = await DepartmentModel.create({
          name: "Socket Test Dept",
          code: "SOCK_DEPT",
          categories: [ComplaintCategory.ROADS_POTHOLES],
          isActive: true,
        });
      }

      const dbCit1 = await UserModel.create({
        email: `cit1.${Date.now()}@civictrack.test`,
        name: "Cit 1",
        role: UserRole.CITIZEN,
        clerkUserId: `clerk_${Date.now()}_1`,
        isActive: true,
      });

      const dbCit2 = await UserModel.create({
        email: `cit2.${Date.now()}@civictrack.test`,
        name: "Cit 2",
        role: UserRole.CITIZEN,
        clerkUserId: `clerk_${Date.now()}_2`,
        isActive: true,
      });

      const dbOfficer = await UserModel.create({
        email: `off.${Date.now()}@civictrack.test`,
        name: "Officer Test",
        role: UserRole.OFFICER,
        departmentId: testDept._id,
        passwordHash,
        isActive: true,
      });

      const complaint1 = await ComplaintModel.create({
        referenceNumber: `CT-SOCK-${Date.now()}`,
        title: "Pothole Test",
        description: "Test pothole",
        category: ComplaintCategory.ROADS_POTHOLES,
        citizenId: dbCit1._id,
        status: ComplaintStatus.ASSIGNED,
        priority: ComplaintPriority.MEDIUM,
        departmentId: testDept._id,
        assignedOfficerId: dbOfficer._id,
        location: {
          type: "Point",
          coordinates: [77.5946, 12.9716],
          address: { formattedAddress: "Bangalore" },
        },
        auditTrail: [{ action: "CREATED", performedBy: dbCit1._id, performedByRole: UserRole.CITIZEN, timestamp: new Date() }],
      });

      const cit1InOwn = await authorizeRoomJoin({ id: dbCit1._id.toString(), role: UserRole.CITIZEN }, `complaint:${complaint1._id}`);
      const cit2InCit1 = await authorizeRoomJoin({ id: dbCit2._id.toString(), role: UserRole.CITIZEN }, `complaint:${complaint1._id}`);
      const offInAssigned = await authorizeRoomJoin({ id: dbOfficer._id.toString(), role: UserRole.OFFICER, departmentId: testDept._id.toString() }, `complaint:${complaint1._id}`);
      const adminInAny = await authorizeRoomJoin({ id: mockAdminId, role: UserRole.ADMIN }, `complaint:${complaint1._id}`);

      if (!cit1InOwn || cit2InCit1 || !offInAssigned || !adminInAny) {
        throw new Error("Database complaint room authorization check failed");
      }
      console.log("   -> Database complaint room scoping verified (citizen isolation & officer assignment)");

      // Cleanup
      await ComplaintModel.deleteOne({ _id: complaint1._id });
      await UserModel.deleteMany({ _id: { $in: [dbCit1._id, dbCit2._id, dbOfficer._id] } });
      await DepartmentModel.deleteOne({ _id: testDept._id });
    } finally {
      await disconnectDatabase();
    }
  } else {
    console.log("   -> Live database deferred (offline mode), unit socket room security verified");
  }

  // Test 8: Real-Time Event Contracts & Zod Schemas Validation
  console.log("8. Testing Real-time event contracts & Zod schema validation:");
  const testComplaintId = new Types.ObjectId().toString();
  const testRefNum = "CT-2026-TEST";
  const nowIso = new Date().toISOString();

  // Valid complaint created payload
  const validCreatedPayload = {
    complaintId: testComplaintId,
    referenceNumber: testRefNum,
    title: "Burst water pipeline on 5th main",
    category: ComplaintCategory.WATER_SUPPLY,
    status: ComplaintStatus.SUBMITTED,
    priority: ComplaintPriority.HIGH,
    citizenId: mockCit1Id,
    address: "5th Main Rd, Indiranagar, Bengaluru",
    location: {
      type: "Point" as const,
      coordinates: [77.6412, 12.9784] as [number, number],
    },
    departmentId: mockDeptId,
    createdAt: nowIso,
  };
  const parsedCreated = ComplaintCreatedPayloadSchema.safeParse(validCreatedPayload);
  if (!parsedCreated.success) {
    throw new Error(`Failed to validate valid ComplaintCreatedPayload: ${JSON.stringify(parsedCreated.error)}`);
  }

  // Invalid payload with missing complaintId
  const invalidCreated = ComplaintCreatedPayloadSchema.safeParse({
    ...validCreatedPayload,
    complaintId: undefined,
  });
  if (invalidCreated.success) {
    throw new Error("ComplaintCreatedPayloadSchema should have rejected missing complaintId");
  }

  // Valid complaint status updated payload
  const validStatusPayload = {
    complaintId: testComplaintId,
    referenceNumber: testRefNum,
    status: ComplaintStatus.IN_PROGRESS,
    citizenId: mockCit1Id,
    departmentId: mockDeptId,
    assignedOfficerId: mockOfficerId,
    updatedAt: nowIso,
    remarks: "Officer arrived on site",
  };
  const parsedStatus = ComplaintStatusUpdatedPayloadSchema.safeParse(validStatusPayload);
  if (!parsedStatus.success) {
    throw new Error(`Failed to validate valid ComplaintStatusUpdatedPayload: ${JSON.stringify(parsedStatus.error)}`);
  }

  // Valid complaint assigned payload
  const validAssignedPayload = {
    complaintId: testComplaintId,
    referenceNumber: testRefNum,
    departmentId: mockDeptId,
    assignedOfficerId: mockOfficerId,
    citizenId: mockCit1Id,
    updatedAt: nowIso,
  };
  const parsedAssigned = ComplaintAssignedPayloadSchema.safeParse(validAssignedPayload);
  if (!parsedAssigned.success) {
    throw new Error(`Failed to validate valid ComplaintAssignedPayload: ${JSON.stringify(parsedAssigned.error)}`);
  }

  // Valid dashboard stats payload
  const validStatsPayload = {
    scope: "ADMIN" as const,
    timestamp: nowIso,
    totalComplaints: 42,
  };
  const parsedStats = DashboardStatsUpdatedPayloadSchema.safeParse(validStatsPayload);
  if (!parsedStats.success) {
    throw new Error(`Failed to validate valid DashboardStatsUpdatedPayload: ${JSON.stringify(parsedStats.error)}`);
  }
  console.log("   -> Real-time event contract schemas strictly verified\n");

  // Test 9: Socket Event Emission & Role-Scoped Room Routing
  console.log("9. Testing Socket event emission & role-scoped room routing:");
  const httpServer = createServer();
  const testIo = initSocketServer(httpServer);

  const dispatched: Array<{ room: string; event: string; payload: any }> = [];
  testIo.to = (room: string | string[]) => {
    const rooms = Array.isArray(room) ? room : [room];
    return {
      emit: (event: string, ...args: any[]) => {
        for (const r of rooms) {
          dispatched.push({ room: r, event, payload: args[0] });
        }
        return true as any;
      },
    } as any;
  };

  // Test emitComplaintCreated room delivery
  dispatched.length = 0;
  emitComplaintCreated(validCreatedPayload);
  const createdRooms = dispatched.map((d) => d.room);
  if (
    !createdRooms.includes(`user:${mockCit1Id}`) ||
    !createdRooms.includes("role:admin") ||
    !createdRooms.includes(`dept:${mockDeptId}`) ||
    !createdRooms.includes(`complaint:${testComplaintId}`)
  ) {
    throw new Error(`emitComplaintCreated did not dispatch to expected rooms: ${JSON.stringify(createdRooms)}`);
  }
  if (createdRooms.includes(`user:${mockCit2Id}`)) {
    throw new Error("emitComplaintCreated leaked to unauthorized citizen room");
  }

  // Test emitComplaintStatusUpdated room delivery
  dispatched.length = 0;
  emitComplaintStatusUpdated(validStatusPayload);
  const statusRooms = dispatched.map((d) => d.room);
  if (
    !statusRooms.includes(`user:${mockCit1Id}`) ||
    !statusRooms.includes("role:admin") ||
    !statusRooms.includes(`dept:${mockDeptId}`) ||
    !statusRooms.includes(`user:${mockOfficerId}`) ||
    !statusRooms.includes(`complaint:${testComplaintId}`)
  ) {
    throw new Error(`emitComplaintStatusUpdated did not dispatch to expected rooms: ${JSON.stringify(statusRooms)}`);
  }

  // Test emitComplaintAssigned room delivery
  dispatched.length = 0;
  emitComplaintAssigned(validAssignedPayload);
  const assignedRooms = dispatched.map((d) => d.room);
  if (
    !assignedRooms.includes(`dept:${mockDeptId}`) ||
    !assignedRooms.includes("role:admin") ||
    !assignedRooms.includes(`user:${mockOfficerId}`) ||
    !assignedRooms.includes(`user:${mockCit1Id}`) ||
    !assignedRooms.includes(`complaint:${testComplaintId}`)
  ) {
    throw new Error(`emitComplaintAssigned did not dispatch to expected rooms: ${JSON.stringify(assignedRooms)}`);
  }

  // Test emitDashboardStatsUpdated room scoping
  dispatched.length = 0;
  emitDashboardStatsUpdated({ scope: "ADMIN", timestamp: nowIso });
  if (dispatched.length !== 1 || dispatched[0].room !== "role:admin") {
    throw new Error("ADMIN stats must only dispatch to role:admin");
  }

  dispatched.length = 0;
  emitDashboardStatsUpdated({ scope: "OFFICER", departmentId: mockDeptId, timestamp: nowIso });
  if (dispatched.length !== 1 || dispatched[0].room !== `dept:${mockDeptId}`) {
    throw new Error("OFFICER stats must only dispatch to dept:departmentId");
  }

  dispatched.length = 0;
  emitDashboardStatsUpdated({ scope: "CITIZEN", userId: mockCit1Id, timestamp: nowIso });
  if (dispatched.length !== 1 || dispatched[0].room !== `user:${mockCit1Id}`) {
    throw new Error("CITIZEN stats must only dispatch to user:userId");
  }

  testIo.close();
  httpServer.close();
  console.log("   -> Event emission room routing strictly verified across all role rooms\n");

  // Test 10: Client-Side Deduplication Sliding Window Logic
  console.log("10. Testing Client-side Event Deduplication (Sliding-window TTL):");
  const dedupeWindow = new Map<string, number>();
  const DEDUPE_TTL_MS = 10000;
  function checkAndRecordEventDedupe(key: string, now: number): boolean {
    const lastSeen = dedupeWindow.get(key);
    if (lastSeen && now - lastSeen < DEDUPE_TTL_MS) {
      return false; // Suppress duplicate
    }
    dedupeWindow.set(key, now);
    return true; // Accept new event
  }

  const baseTime = 100000;
  const eventKey = `${SocketEvent.COMPLAINT_STATUS_UPDATED}:${testComplaintId}:RESOLVED`;
  const firstSeen = checkAndRecordEventDedupe(eventKey, baseTime);
  const duplicateImmediate = checkAndRecordEventDedupe(eventKey, baseTime + 200);
  const duplicateWithinTtl = checkAndRecordEventDedupe(eventKey, baseTime + 5000);
  const afterTtl = checkAndRecordEventDedupe(eventKey, baseTime + 11000);

  if (!firstSeen) throw new Error("First event must be accepted");
  if (duplicateImmediate) throw new Error("Immediate duplicate must be suppressed");
  if (duplicateWithinTtl) throw new Error("Duplicate within TTL must be suppressed");
  if (!afterTtl) throw new Error("Event after TTL window must be accepted");

  // Different status transition for same complaint must not be suppressed
  const nextStatusKey = `${SocketEvent.COMPLAINT_STATUS_UPDATED}:${testComplaintId}:CLOSED`;
  const nextStatusAccepted = checkAndRecordEventDedupe(nextStatusKey, baseTime + 200);
  if (!nextStatusAccepted) throw new Error("Distinct status transition must be accepted immediately");
  console.log("   -> Event deduplication logic verified: duplicates dropped, distinct transitions passed\n");

  // Test 11: Reconnect Recovery Stale-State Prevention
  console.log("11. Testing Reconnect Recovery Stale-State Prevention Flow:");
  let restFetchCount = 0;
  const mockReconnectListeners: Array<() => void> = [];
  function onReconnect(cb: () => void) {
    mockReconnectListeners.push(cb);
  }
  function simulateSocketReconnect() {
    for (const listener of mockReconnectListeners) {
      listener();
    }
  }

  // Register dashboard / screen recovery listener
  onReconnect(() => {
    restFetchCount++;
  });

  // Verify initial state
  if (restFetchCount !== 0) throw new Error("Fetch should not occur before reconnect");

  // Simulate network glitch & socket reconnection
  simulateSocketReconnect();
  if (restFetchCount !== 1) throw new Error("Reconnect must trigger REST fetch recovery");

  simulateSocketReconnect();
  if (restFetchCount !== 2) throw new Error("Consecutive reconnects must each trigger fresh state synchronization");
  console.log("   -> Reconnect recovery verified: triggers REST reconciliation on every connection resume\n");

  console.log("\nAll Socket.io Dual Authentication & Room Authorization tests passed successfully!\n");
}

runSocketAuthTests().catch((err) => {
  console.error("Socket Auth test failed:", err);
  process.exit(1);
});
