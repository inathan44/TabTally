import { z } from "zod";
import { withCatch } from "~/lib/utils";
import { containsProfanity } from "~/lib/profanity";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import type {
  GetUserGroupsResponse,
  PendingInvite,
  SafeUser,
  UserProfile,
} from "~/server/contracts/users";
import {
  updateProfileSchema,
  checkUsernameSchema,
  searchUsersSchema,
} from "~/server/contracts/users";
import { calculateGroupBalances } from "~/server/helpers/balanceCalculation";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }): Promise<ApiResponse<UserProfile>> => {
    const { data: user, error } = await withCatch(
      async () =>
        await ctx.db.user.findUnique({
          where: { id: ctx.userId, deletedAt: null },
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            venmoUsername: true,
            cashappUsername: true,
            zelleUsername: true,
            createdAt: true,
          },
        }),
    );

    if (error !== null) {
      return {
        data: null,
        error: { message: "Failed to load profile.", code: "INTERNAL_SERVER_ERROR" },
      };
    }

    if (!user) {
      return {
        data: null,
        error: { message: "User not found.", code: "NOT_FOUND" },
      };
    }

    return { data: user, error: null };
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const data: {
        venmoUsername?: string | null;
        cashappUsername?: string | null;
        zelleUsername?: string | null;
        username?: string;
      } = {
        // Intentionally using || to coerce empty strings to null
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        venmoUsername: input.venmoUsername?.trim() || null,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        cashappUsername: input.cashappUsername?.trim() || null,
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        zelleUsername: input.zelleUsername?.trim() || null,
      };

      if (input.username) {
        if (containsProfanity(input.username)) {
          return {
            data: null,
            error: { message: "That username is not allowed.", code: "BAD_REQUEST" },
          };
        }

        // Intentionally not filtering by deletedAt — usernames must be globally unique to avoid conflicts with the DB unique constraint
        const { data: existing, error: checkError } = await withCatch(
          async () =>
            await ctx.db.user.findFirst({
              where: { username: { equals: input.username!, mode: "insensitive" } },
              select: { id: true },
            }),
        );

        if (checkError !== null) {
          return {
            data: null,
            error: {
              message: "An error occurred. Please try again.",
              code: "INTERNAL_SERVER_ERROR",
            },
          };
        }

        if (existing && existing.id !== ctx.userId) {
          return {
            data: null,
            error: { message: "That username is already taken.", code: "CONFLICT" },
          };
        }

        data.username = input.username;
      }

      const { error } = await withCatch(
        async () =>
          await ctx.db.user.update({
            where: { id: ctx.userId },
            data,
          }),
      );

      if (error !== null) {
        console.error("Error updating profile:", error);
        return {
          data: null,
          error: { message: "Failed to update profile.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      return { data: "Profile updated successfully", error: null };
    }),

  getUserById: protectedProcedure
    .input(z.string().min(1))
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeUser>> => {
      const { data: user, error } = await withCatch(
        async () =>
          await ctx.db.user.findUnique({
            where: { id: input, deletedAt: null },
          }),
      );

      if (error !== null) {
        console.error("Error fetching user:", error);
        return {
          data: null,
          error: {
            message:
              // Intentionally using || to fallback on empty error messages
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              error.message ||
              "An error occurred while getting user information. Please try again later.",
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
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      };

      return { data: safeUser, error: null };
    }),
  getGroups: protectedProcedure.query(
    async ({ ctx }): Promise<ApiResponse<GetUserGroupsResponse[]>> => {
      const { data: groups, error } = await withCatch(
        async () =>
          await ctx.db.group.findMany({
            where: {
              deletedAt: null,
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
                  deletedAt: null,
                },
                select: {
                  member: {
                    select: {
                      id: true,
                      username: true,
                      firstName: true,
                      lastName: true,
                      createdAt: true,
                    },
                  },
                },
              },
              transactions: {
                where: { deletedAt: null },
                include: {
                  transactionDetails: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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

      const userGroups: GetUserGroupsResponse[] = groups.map((group) => {
        // Calculate balance for this group for the current user
        let userBalance: { amount: number; type: "receive" | "pay" } | undefined;

        if (group.transactions.length > 0) {
          // Transform transactions for balance calculation
          const transformedTransactions = group.transactions.map((transaction) => ({
            payerId: transaction.payerId,
            amount: transaction.amount.toNumber(),
            transactionDetails: transaction.transactionDetails.map((detail) => ({
              recipientId: detail.recipientId,
              amount: detail.amount.toNumber(),
            })),
          }));

          // Calculate balances using helper method
          const balanceData = calculateGroupBalances(transformedTransactions);
          const currentUserBalance = balanceData.userBalances[ctx.userId];

          if (currentUserBalance) {
            const netBalance = currentUserBalance.netBalance;
            if (Math.abs(netBalance) > 0.01) {
              // Only show balance if significant
              userBalance = {
                amount: Math.abs(netBalance),
                type: netBalance > 0 ? "receive" : "pay",
              };
            }
          }
        }

        return {
          id: group.id,
          name: group.name,
          slug: group.slug,
          createdAt: group.createdAt,
          createdById: group.createdById,
          groupUsers: group.members.map((member) => ({
            id: member.member.id,
            username: member.member.username,
            firstName: member.member.firstName,
            lastName: member.member.lastName,
            createdAt: member.member.createdAt,
          })),
          userBalance,
        };
      });

      return { data: userGroups, error: null };
    },
  ),

  getPendingInvites: protectedProcedure.query(
    async ({ ctx }): Promise<ApiResponse<PendingInvite[]>> => {
      const { data: invites, error } = await withCatch(
        async () =>
          await ctx.db.groupMember.findMany({
            where: {
              memberId: ctx.userId,
              status: "INVITED",
              deletedAt: null,
              group: { deletedAt: null },
            },
            select: {
              id: true,
              groupId: true,
              createdAt: true,
              group: {
                select: {
                  name: true,
                  slug: true,
                  members: {
                    where: { status: "JOINED", deletedAt: null },
                    select: { id: true },
                  },
                },
              },
              invitedBy: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
      );

      if (error !== null) {
        console.error("Error fetching pending invites:", error);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching invitations.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      const pendingInvites: PendingInvite[] = invites.map((invite) => ({
        id: invite.id,
        groupId: invite.groupId,
        groupName: invite.group.name,
        groupSlug: invite.group.slug,
        invitedBy: invite.invitedBy,
        memberCount: invite.group.members.length,
        createdAt: invite.createdAt,
      }));

      return { data: pendingInvites, error: null };
    },
  ),

  searchUsers: protectedProcedure
    .input(searchUsersSchema)
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeUser[]>> => {
      const query = input.query.trim().toLowerCase();
      const isEmail = query.includes("@");

      const { data: users, error } = await withCatch(
        async () =>
          await ctx.db.user.findMany({
            where: {
              deletedAt: null,
              id: { not: ctx.userId },
              ...(isEmail
                ? { email: { equals: query, mode: "insensitive" } }
                : { username: { contains: query, mode: "insensitive" } }),
            },
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              createdAt: true,
            },
            take: 10,
            orderBy: { username: "asc" },
          }),
      );

      if (error !== null) {
        console.error("Error searching users:", error);
        return {
          data: null,
          error: {
            message: "An error occurred while searching for users.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      return { data: users, error: null };
    }),

  checkUsernameAvailability: protectedProcedure
    .input(checkUsernameSchema)
    .query(async ({ ctx, input }): Promise<ApiResponse<{ available: boolean }>> => {
      const username = input.username;

      if (containsProfanity(username)) {
        return {
          data: null,
          error: { message: "That username is not allowed.", code: "BAD_REQUEST" },
        };
      }

      // Intentionally not filtering by deletedAt — usernames must be globally unique to avoid conflicts with the DB unique constraint
      const { data: existing, error } = await withCatch(
        async () =>
          await ctx.db.user.findFirst({
            where: { username: { equals: username, mode: "insensitive" } },
            select: { id: true },
          }),
      );

      if (error !== null) {
        return {
          data: null,
          error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      return { data: { available: !existing }, error: null };
    }),
});
