import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterEach,
} from "vitest";
import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";
import { createTRPCContext } from "~/server/api/trpc";

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
      const result = await caller.user.getUserById("cmbyp0iqv0002t6v4vxh97qfy");

      expect(result).toEqual({
        data: {
          id: "cmbyp0iqv0002t6v4vxh97qfy",
          username: "charlie_brown",
          firstName: "Charlie",
          lastName: "Brown",
          createdAt: new Date(Date.UTC(2025, 5, 16, 6, 8, 0, 481)),
        },
        error: null,
      });
    });
  });

  it("should return a TRPC error when db call fails", async () => {
    // Mock the database call to throw an error
    vi.spyOn(db.user, "findUnique").mockImplementationOnce(() => {
      throw new Error("Database error");
    });

    const result = await caller.user.getUserById("nonexistent-user-id");

    expect(result).toEqual({
      data: null,
      error: {
        message: "Database error",
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
      },
    });
  });
});
