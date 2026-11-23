process.env.REQUIRE_TEST_DB = "true";
await import("./staff-auth.test.js");
await import("./authorization-privacy.test.js");
