import { z } from "zod";
import { withCatch } from "~/lib/utils";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import type {
  GetUserGroupsResponse,
  PendingInvite,
  SafeUser,
  UserProfile,
} from "~/server/contracts/users";
import { updatePaymentUsernamesSchema } from "~/server/contracts/users";
import { calculateGroupBalances } from "~/server/helpers/balanceCalculation";

export const userRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx }): Promise<ApiResponse<UserProfile>> => {
    const { data: user, error } = await withCatch(
      async () =>
        await ctx.db.user.findUnique({
          where: { id: ctx.userId, deletedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            venmoUsername: true,
            cashappUsername: true,
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

  updatePaymentUsernames: protectedProcedure
    .input(updatePaymentUsernamesSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const { error } = await withCatch(async () => {
        return await ctx.db.user.update({
          where: { id: ctx.userId },
          data: {
            venmoUsername: input.venmoUsername?.trim() || null,
            cashappUsername: input.cashappUsername?.trim() || null,
          },
        });
      });

      if (error !== null) {
        return {
          data: null,
          error: { message: "Failed to update payment usernames.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      return { data: "Payment usernames updated successfully", error: null };
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

  searchUserByEmail: protectedProcedure
    .input(z.object({ email: z.string() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeUser>> => {
      const email = input.email.trim().toLowerCase();
      const { data: user, error } = await withCatch(
        async () =>
          await ctx.db.user.findUnique({
            where: {
              email: email,
              deletedAt: null,
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

      if (user === null || user.id === ctx.userId) {
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
