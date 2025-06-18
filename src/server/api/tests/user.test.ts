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
});
