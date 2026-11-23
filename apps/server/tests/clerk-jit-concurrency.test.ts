import { Types } from "mongoose";
import { UserService } from "../src/modules/users/user.service.js";
import { UserModel } from "../src/modules/users/user.model.js";
import { UserRole } from "@civictrack/contracts";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";

async function runClerkJitConcurrencyTests(): Promise<void> {
  console.log("Running Clerk JIT Provisioning & Concurrency Race Condition Tests...\n");

  // =========================================================================
  // Test 1: Unit Test - Simulate E11000 duplicate key error during race condition
  // Verifies that when a parallel thread inserts first and MongoDB throws
  // E11000 on UserModel.create, UserService.syncFromClerk catches the error,
  // recovers the newly created record via findOne, and returns it cleanly.
  // =========================================================================
  console.log("1. Testing unit-level E11000 race condition recovery:");
  const originalReadyState = UserModel.db.readyState;
  const originalFindOne = UserModel.findOne;
  const originalCreate = UserModel.create;

  try {
    // Force readyState = 1 so UserService does not enter offline memory fallback
    Object.defineProperty(UserModel.db, "readyState", {
      value: 1,
      configurable: true,
      writable: true,
    });

    const mockClerkUserId = "user_simulated_race_123";
    const mockEmail = "simulated.race@civictrack.org";
    const mockName = "Simulated Citizen";
    const mockUserId = new Types.ObjectId();

    const createdRecord = {
      _id: mockUserId,
      clerkUserId: mockClerkUserId,
      email: mockEmail,
      name: mockName,
      role: UserRole.CITIZEN,
      isActive: true,
      save: async () => createdRecord,
    };

    let findOneCallCount = 0;
    let createCallCount = 0;

    // Simulate behavior during race:
    // First findOne: returns null (neither thread sees the record yet)
    // UserModel.create: throws duplicate key error E11000 (competing thread won the insert)
    // Second findOne: returns the record created by the competing thread
    UserModel.findOne = (async () => {
      findOneCallCount++;
      if (findOneCallCount === 1) {
        return null;
      }
      return createdRecord;
    }) as any;

    UserModel.create = (async () => {
      createCallCount++;
      const dupError = new Error(
        `E11000 duplicate key error collection: civictrack-db.users index: clerkUserId_1 dup key: { clerkUserId: "${mockClerkUserId}" }`
      ) as any;
      dupError.code = 11000;
      dupError.codeName = "DuplicateKey";
      throw dupError;
    }) as any;

    const recoveredUser = await UserService.syncFromClerk({
      clerkUserId: mockClerkUserId,
      email: mockEmail,
      name: mockName,
    });

    if (!recoveredUser) {
      throw new Error("Expected recoveredUser to be returned, got null/undefined");
    }
    if (recoveredUser._id.toString() !== mockUserId.toString()) {
      throw new Error(`User ID mismatch: expected ${mockUserId.toString()}, got ${recoveredUser._id.toString()}`);
    }
    if (createCallCount !== 1) {
      throw new Error(`Expected create to be called once, got ${createCallCount}`);
    }
    if (findOneCallCount < 2) {
      throw new Error(`Expected recovery findOne to be called, got count ${findOneCallCount}`);
    }

    console.log("   -> E11000 duplicate key error intercepted successfully!");
    console.log("   -> Recovered user document created by competing parallel thread without throwing 401.\n");
  } finally {
    // Restore original functions and properties
    Object.defineProperty(UserModel.db, "readyState", {
      value: originalReadyState,
      configurable: true,
      writable: true,
    });
    UserModel.findOne = originalFindOne;
    UserModel.create = originalCreate;
  }

  // =========================================================================
  // Test 2: Live Database or Offline Integration Assertions
  // =========================================================================
  if (process.env.TEST_LIVE_DB === "true") {
    const isDbConnected = await connectDatabase();
    if (isDbConnected) {
      console.log("2. Testing live simultaneous concurrent JIT user creation against MongoDB Atlas:");
      const testClerkId = `user_race_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const testEmail = `race.${Date.now()}.${Math.random().toString(36).substring(2, 7)}@civictrack.org`;
      const testName = "Concurrent Citizen";

      const concurrentCalls = 5;
      console.log(`   Launching ${concurrentCalls} simultaneous UserService.syncFromClerk calls...`);

      const results = await Promise.all(
        Array.from({ length: concurrentCalls }).map((_, i) =>
          UserService.syncFromClerk({
            clerkUserId: testClerkId,
            email: testEmail,
            name: `${testName} ${i}`,
          })
        )
      );

      if (results.length !== concurrentCalls) {
        throw new Error(`Expected ${concurrentCalls} results, got ${results.length}`);
      }

      const firstUserId = results[0]._id.toString();
      for (const res of results) {
        if (res._id.toString() !== firstUserId) {
          throw new Error(`Inconsistent user ID returned: expected ${firstUserId}, got ${res._id.toString()}`);
        }
        if (res.role !== UserRole.CITIZEN) {
          throw new Error(`Expected role CITIZEN, got ${res.role}`);
        }
      }
      console.log(`   -> All ${concurrentCalls} concurrent calls resolved to the exact same user ID: ${firstUserId}`);

      const count = await UserModel.countDocuments({ clerkUserId: testClerkId });
      if (count !== 1) {
        throw new Error(`Expected exactly 1 document in DB, found ${count}`);
      }
      console.log("   -> Exactly 1 MongoDB document exists for clerkUserId. Zero duplicate key violations.\n");

      await UserModel.deleteOne({ clerkUserId: testClerkId });
      await disconnectDatabase();
    }
  }

  console.log(">>> ALL CLERK JIT PROVISIONING CONCURRENCY TESTS PASSED! <<<\n");
}

runClerkJitConcurrencyTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
