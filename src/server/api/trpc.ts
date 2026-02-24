/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { withCatch } from "~/lib/utils";
import type { GroupMemberStatus } from "@prisma/client";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const authData = await auth();

  return {
    db,
    userId: authData.userId,
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

const authMiddleware = t.middleware(async ({ next, ctx }) => {
  if (isTestEnvironment()) {
    console.log("[TRPC] Bypassing auth middleware in test environment");
    const result = await next({
      ctx: {
        ...ctx,
        userId: ctx.userId ?? "test-user-id",
      },
    });
    return result;
  }

  if (!ctx.userId) {
    console.warn("[TRPC] Unauthorized access - missing userId or sessionId");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unauthorized - missing session claims",
    });
  }

  const result = await next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
  return result;
});

const findOrCreateUserMiddleware = t.middleware(async ({ next, ctx }) => {
  if (isTestEnvironment()) {
    console.log("[TRPC] Bypassing findorcreate middleware in test environment");

    const result = await next({
      ctx: {
        ...ctx,
        userId: ctx.userId ?? "test-user-id",
      },
    });
    return result;
  }

  if (!ctx.userId) {
    console.warn("[TRPC] Unauthorized access - missing userId");
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unauthorized - missing userId",
    });
  }

  const client = await clerkClient();

  const { emailAddresses, firstName, lastName, id } = await client.users.getUser(ctx.userId);

  const userInDatabase = await ctx.db.user.findUnique({
    where: { id: ctx.userId },
  });

  if (userInDatabase) {
    return next();
  }

  if (!emailAddresses || emailAddresses.length === 0 || !emailAddresses[0]?.emailAddress) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "User does not have an email address",
    });
  }

  if (ctx.userId !== id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User ID does not match session user ID",
    });
  }

  console.log("[TRPC] User not found creating new user in database:", ctx.userId);

  const { data, error } = await withCatch(
    async () =>
      await ctx.db.user.create({
        data: {
          id: ctx.userId!,
          email: emailAddresses[0]!.emailAddress.toLowerCase(),
          firstName: firstName
            ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
            : "default",
          lastName: lastName
            ? lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase()
            : "default",
        },
      }),
  );

  if (error !== null) {
    console.error("[TRPC] Error creating user in database:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Create user middleware failed: ${error?.message}`,
    });
  }

  console.log("[TRPC] User created in database:", data.id);

  return next();
});

const requireGroupMembershipMiddleware = t.middleware(async ({ next, ctx, input }) => {
  const inputWithGroupId = input as { groupId?: number };

  if (!inputWithGroupId?.groupId) {
    console.error(
      "[TRPC] requireGroupMembershipMiddleware used on procedure without groupId in input",
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal error: groupId is required for this operation",
    });
  }

  const { data: isMemberResponse, error: membershipError } = await withCatch(async () => {
    return await ctx.db.groupMember.findFirst({
      where: {
        groupId: inputWithGroupId.groupId,
        memberId: ctx.userId!,
        status: "JOINED" as GroupMemberStatus,
      },
    });
  });

  if (membershipError !== null) {
    console.error("[TRPC] Error checking group membership in middleware:", membershipError);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "An error occurred while checking group membership.",
    });
  }

  const isMember = isMemberResponse !== null;

  if (!isMember) {
    console.warn(
      "[TRPC] User is not a member of the group:",
      ctx.userId,
      "groupId:",
      inputWithGroupId.groupId,
    );
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a member of this group to perform this action",
    });
  }

  return next();
});

export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(authMiddleware)
  .use(findOrCreateUserMiddleware);
export const groupMemberProcedure = protectedProcedure.use(requireGroupMembershipMiddleware);

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

function isTestEnvironment() {
  return process.env.NODE_ENV === "test" && process.env.BYPASS_AUTH === "true";
}
