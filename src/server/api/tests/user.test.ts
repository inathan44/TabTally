import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterEach,
} from "vitest";
import { TRPCError } from "@trpc/server";
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";
import { createTRPCContext } from "~/server/api/trpc";

const EXISTING_TEST_USER = "cmbyp0iqv0002t6v4vxh97qfy";
const NON_EXISTING_TEST_USER = "nonexistent-user-id";

// Mock Clerk auth for testing
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-id" })),
}));

// Create a test-specific context creator that doesn't rely on real auth
const createTestContext = async () => {
  const heads = new Headers();
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
};

describe("User API Tests", () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;
  let caller: ReturnType<typeof createCaller>;

  // Set up environment for testing
  beforeAll(async () => {
    // Ensure we're in test environment (this is set by the test script)
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Tests should only run in test environment!");
    }
    process.env.BYPASS_AUTH = "true";

    // Create shared context and caller for all tests
    ctx = await createTestContext();
    caller = createCaller(ctx);
  });

  beforeEach(() => {
    if (process.env.NODE_ENV !== "test") {
      throw new Error("Tests should only run in test environment!");
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserById - Unit Tests with Database", () => {
    it("should return a user when found", async () => {
      const result = await caller.user.getUserById(EXISTING_TEST_USER);

      expect(result).toEqual({
        data: {
          id: "cmbyp0iqv0002t6v4vxh97qfy",
          firstName: "Charlie",
          lastName: "Brown",
          createdAt: new Date(Date.UTC(2025, 5, 16, 6, 8, 0, 481)),
        },
        error: null,
      });
    });

    it("should return a TRPC error when db call fails", async () => {
      vi.spyOn(db.user, "findUnique").mockImplementationOnce(() => {
        throw new Error("Database error");
      });

      const result = await caller.user.getUserById(EXISTING_TEST_USER);

      expect(result).toEqual({
        data: null,
        error: {
          message: "Database error",
          code: "INTERNAL_SERVER_ERROR",
        },
      });
    });

    it("Should throw a TRPCError with BAD_REQUEST for invalid input", async () => {
      await expect(async () => {
        await caller.user.getUserById(1 as unknown as string); // Invalid type passed purposefully
      }).rejects.toThrow(TRPCError);

      // More specific assertion - check the error properties
      try {
        await caller.user.getUserById(1 as unknown as string);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
        expect((error as TRPCError).message).toContain(
          "Expected string, received number",
        );
      }
    });

    it("Should throw a TRPCError if getUserById id is empty string", async () => {
      // When using server-side caller, tRPC throws actual TRPCError for validation failures
      await expect(async () => {
        await caller.user.getUserById("");
      }).rejects.toThrow(TRPCError);

      try {
        await caller.user.getUserById("");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("BAD_REQUEST");
        expect((error as TRPCError).message).toContain(
          "String must contain at least 1 character(s)",
        );
      }
    });

    it("should return user not found error for non-existent user", async () => {
      const result = await caller.user.getUserById(NON_EXISTING_TEST_USER);

      expect(result).toEqual({
        data: null,
        error: {
          message: "User not found",
          code: "NOT_FOUND",
        },
      });
    });
  });

  describe("getGroups - Unit Tests with Database", () => {
    let createdGroupIds: number[] = [];

    beforeEach(async () => {
      // Mock the context to use our test user for group creation
      const testCtx = { ...ctx, userId: EXISTING_TEST_USER };
      const testCaller = createCaller(testCtx);

      // Create test groups using the actual createGroup method
      const group1Result = await testCaller.group.createGroup({
        name: "Test Group 1",
        description: "Test description 1",
      });

      const group2Result = await testCaller.group.createGroup({
        name: "Test Group 2",
        description: "Test description 2",
      });

      // Verify groups were created successfully
      expect(group1Result.error).toBeNull();
      expect(group2Result.error).toBeNull();
      expect(group1Result.data).toBeDefined();
      expect(group2Result.data).toBeDefined();

      createdGroupIds = [group1Result.data!.id, group2Result.data!.id];
    });

    afterEach(async () => {
      if (createdGroupIds.length > 0) {
        const testCtx = { ...ctx, userId: EXISTING_TEST_USER };
        const testCaller = createCaller(testCtx);

        for (const groupId of createdGroupIds) {
          const deleteResult = await testCaller.group.deleteGroup({
            groupId: groupId,
            hard: true,
          });

          expect(deleteResult.error).toBeNull();
        }

        createdGroupIds = [];
      }
    });

    it("should return groups for the user", async () => {
      // Mock the context to use our test user
      const testCtx = { ...ctx, userId: EXISTING_TEST_USER };
      const testCaller = createCaller(testCtx);

      const result = await testCaller.user.getGroups();

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(2);

      // Verify the groups contain expected data
      expect(result.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Test Group 1",
          }),
          expect.objectContaining({
            name: "Test Group 2",
          }),
        ]),
      );

      // Verify each group has the correct structure
      result.data!.forEach((group) => {
        expect(group).toHaveProperty("id");
        expect(group).toHaveProperty("name");
        expect(group).toHaveProperty("slug");
        expect(group).toHaveProperty("createdAt");
        expect(group).toHaveProperty("groupUsers");
        expect(Array.isArray(group.groupUsers)).toBe(true);
      });
    });
  });
});
