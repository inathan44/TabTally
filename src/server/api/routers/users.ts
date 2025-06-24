import { z } from "zod";
import { withCatch } from "~/lib/utils";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import type { GetUserGroupsResponse, SafeUser } from "~/server/contracts/users";

export const userRouter = createTRPCRouter({
  getUserById: protectedProcedure.input(z.string().min(1)).query(async ({ ctx, input }): Promise<ApiResponse<SafeUser>> => {
    const { data: user, error } = await withCatch(
      async () =>
        await ctx.db.user.findUnique({
          where: { id: input },
        }),
    );

    if (error !== null) {
      console.error("Error fetching user:", error);
      return {
        data: null,
        error: {
          message: error.message || "An error occurred while getting user information. Please try again later.",
          code: "INTERNAL_SERVER_ERROR",
        },
      };
    }

    if (!user) {
      console.warn("User not found for ID:", input);
      return {
        data: null,
        error: {
          message: "User not found",
          code: "NOT_FOUND",
        },
      };
    }

    console.log("User found:", user.id);
    const safeUser: SafeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };

    return { data: safeUser, error: null };
  }),
  getGroups: protectedProcedure.query(async ({ ctx }): Promise<ApiResponse<GetUserGroupsResponse[]>> => {
    const { data: groups, error } = await withCatch(
      async () =>
        await ctx.db.group.findMany({
          where: {
            members: { some: { memberId: ctx.userId, status: "JOINED" } },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            createdById: true,
            members: {
              where: {
                status: "JOINED",
              },
              select: {
                member: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        }),
    );

    if (error !== null) {
      console.error("Error fetching user groups:", error);
      return {
        data: null,
        error: {
          message: "An error occurred while getting user groups. Please try again later.",
          code: "INTERNAL_SERVER_ERROR",
        },
      };
    }

    const userGroups: GetUserGroupsResponse[] = groups.map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      createdAt: group.createdAt,
      createdById: group.createdById,
      groupUsers: group.members.map((member) => ({
        id: member.member.id,
        firstName: member.member.firstName,
        lastName: member.member.lastName,
        createdAt: member.member.createdAt,
      })),
    }));

    return { data: userGroups, error: null };
  }),

  searchUserByEmail: protectedProcedure.input(z.object({ email: z.string() })).query(async ({ ctx, input }): Promise<ApiResponse<SafeUser>> => {
    const email = input.email.trim().toLowerCase();
    const { data: user, error } = await withCatch(
      async () =>
        await ctx.db.user.findUnique({
          where: {
            email: email,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        }),
    );

    if (error !== null) {
      console.error("Error searching user by email:", error);
      return {
        data: null,
        error: {
          message: "An error occurred while searching for users. Please try again later.",
          code: "INTERNAL_SERVER_ERROR",
        },
      };
    }

    if (user === null) {
      console.warn("User not found for email:", email);
      return {
        data: null,
        error: {
          message: "No user found with the provided email",
          code: "NOT_FOUND",
        },
      };
    }

    const safeUser: SafeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    };

    return { data: safeUser, error: null };
  }),
});
