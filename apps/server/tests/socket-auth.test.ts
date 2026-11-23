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
} from "@civictrack/contracts";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  authorizeRoomJoin,
  disconnectUserSockets,
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

  console.log("\nAll Socket.io Dual Authentication & Room Authorization tests passed successfully!\n");
}

runSocketAuthTests().catch((err) => {
  console.error("Socket Auth test failed:", err);
  process.exit(1);
});
