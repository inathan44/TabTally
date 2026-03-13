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
import { toMoney } from "~/lib/money";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }): Promise<ApiResponse<UserProfile>> => {
    console.log(`[getProfile] Fetching profile for user ${ctx.userId}`);
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
      console.error(`[getProfile] DB error for user ${ctx.userId}:`, error);
      return {
        data: null,
        error: { message: "Failed to load profile.", code: "INTERNAL_SERVER_ERROR" },
      };
    }

    if (!user) {
      console.warn(`[getProfile] User not found for ${ctx.userId}`);
      return {
        data: null,
        error: { message: "User not found.", code: "NOT_FOUND" },
      };
    }

    console.log(`[getProfile] Profile loaded for user ${ctx.userId}`);
    return { data: user, error: null };
  }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(`[updateProfile] Updating profile for user ${ctx.userId}`);
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
          console.warn(
            `[updateProfile] Profanity rejected for user ${ctx.userId}, username="${input.username}"`,
          );
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
          console.error(
            `[updateProfile] Username check failed for user ${ctx.userId}:`,
            checkError,
          );
          return {
            data: null,
            error: {
              message: "An error occurred. Please try again.",
              code: "INTERNAL_SERVER_ERROR",
            },
          };
        }

        if (existing && existing.id !== ctx.userId) {
          console.warn(
            `[updateProfile] Username "${input.username}" taken by user ${existing.id}, requested by ${ctx.userId}`,
          );
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
        console.error(`[updateProfile] DB error for user ${ctx.userId}:`, error);
        return {
          data: null,
          error: { message: "Failed to update profile.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      console.log(`[updateProfile] Profile updated for user ${ctx.userId}`);
      return { data: "Profile updated successfully", error: null };
    }),

  getUserById: protectedProcedure
    .input(z.string().min(1))
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeUser>> => {
      console.log(`[getUserById] Fetching user ${input} by ${ctx.userId}`);
      const { data: user, error } = await withCatch(
        async () =>
          await ctx.db.user.findUnique({
            where: { id: input, deletedAt: null },
          }),
      );

      if (error !== null) {
        console.error(`[getUserById] DB error fetching user ${input}:`, error);
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
        console.warn(`[getUserById] User ${input} not found`);
        return {
          data: null,
          error: {
            message: "User not found",
            code: "NOT_FOUND",
          },
        };
      }

      console.log(`[getUserById] Found user ${user.id}`);
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
      console.log(`[getGroups] Fetching groups for user ${ctx.userId}`);
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
        console.error(`[getGroups] DB error for user ${ctx.userId}:`, error);
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
        let userBalance: GetUserGroupsResponse["userBalance"];

        if (group.transactions.length > 0) {
          const transformedTransactions = group.transactions.map((transaction) => ({
            payerId: transaction.payerId,
            amount: transaction.amount,
            transactionDetails: transaction.transactionDetails.map((detail) => ({
              recipientId: detail.recipientId,
              amount: detail.amount,
            })),
          }));

          const balanceData = calculateGroupBalances(transformedTransactions);
          const currentUserBalance = balanceData.userBalances[ctx.userId];

          if (currentUserBalance) {
            const netBalance = currentUserBalance.netBalance;
            if (Math.abs(netBalance) > 0) {
              userBalance = {
                amount: toMoney(Math.abs(netBalance)),
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

      console.log(`[getGroups] Found ${userGroups.length} groups for user ${ctx.userId}`);
      return { data: userGroups, error: null };
    },
  ),

  getPendingInvites: protectedProcedure.query(
    async ({ ctx }): Promise<ApiResponse<PendingInvite[]>> => {
      console.log(`[getPendingInvites] Fetching invites for user ${ctx.userId}`);
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
        console.error(`[getPendingInvites] DB error for user ${ctx.userId}:`, error);
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

      console.log(
        `[getPendingInvites] Found ${pendingInvites.length} invites for user ${ctx.userId}`,
      );
      return { data: pendingInvites, error: null };
    },
  ),

  searchUsers: protectedProcedure
    .input(searchUsersSchema)
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeUser[]>> => {
      console.log(`[searchUsers] User ${ctx.userId} searching for "${input.query}"`);
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
        console.error(`[searchUsers] DB error for user ${ctx.userId}:`, error);
        return {
          data: null,
          error: {
            message: "An error occurred while searching for users.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[searchUsers] Found ${users.length} results for query "${input.query}"`);
      return { data: users, error: null };
    }),

  checkUsernameAvailability: protectedProcedure
    .input(checkUsernameSchema)
    .query(async ({ ctx, input }): Promise<ApiResponse<{ available: boolean }>> => {
      console.log(
        `[checkUsernameAvailability] User ${ctx.userId} checking username "${input.username}"`,
      );
      const username = input.username;

      if (containsProfanity(username)) {
        console.warn(
          `[checkUsernameAvailability] Profanity rejected for user ${ctx.userId}, username="${username}"`,
        );
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
        console.error(`[checkUsernameAvailability] DB error for user ${ctx.userId}:`, error);
        return {
          data: null,
          error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      console.log(
        `[checkUsernameAvailability] Username "${input.username}" available=${!existing}`,
      );
      return { data: { available: !existing }, error: null };
    }),
});
