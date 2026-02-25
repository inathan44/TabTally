import type { GroupMemberStatus } from "@prisma/client";
import { z } from "zod";
import { withCatch } from "~/lib/utils";
import { createGroupSlug } from "~/lib/slugify";

import {
  createTRPCRouter,
  protectedProcedure,
  groupMemberProcedure,
  groupAdminProcedure,
  type TRPCContext,
} from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import {
  createGroupSchema,
  createTransactionSchema,
  deleteGroupSchema,
  inviteMemberSchema,
  uninviteMemberSchema,
  restoreInviteSchema,
  type GetGroupResponse,
} from "~/server/contracts/groups";
import type { CreateTransactionDetail } from "~/server/contracts/transactionDetail";
import type { BalanceCalculationResult, UserBalance } from "~/server/contracts/balances";
import { calculateGroupBalances } from "~/server/helpers/balanceCalculation";

export const groupRouter = createTRPCRouter({
  createGroup: protectedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const { data, error } = await withCatch(async () => {
        return await ctx.db.$transaction(async (tx) => {
          const temporarySlug = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

          const newGroup = await tx.group.create({
            data: {
              name: input.name,
              description: input.description,
              createdById: ctx.userId,
              slug: temporarySlug,
            },
          });

          console.log("New group created with temporary slug:", newGroup.id, temporarySlug);

          const slug = createGroupSlug(input.name, newGroup.id);

          const updatedGroup = await tx.group.update({
            where: { id: newGroup.id },
            data: { slug },
          });

          console.log("Adding group creator to group members:", ctx.userId);

          await tx.groupMember.create({
            data: {
              groupId: updatedGroup.id,
              invitedById: ctx.userId,
              memberId: ctx.userId,
              isAdmin: true,
              status: "JOINED",
            },
          });

          // Invite additional users if provided
          if (input.invitedUsers && input.invitedUsers.length > 0) {
            console.log("Inviting additional users to group:", input.invitedUsers.length);

            // First, verify all invited users exist in the database
            const invitedUserIds = input.invitedUsers.map((user) => user.userId);
            const existingUsers = await tx.user.findMany({
              where: {
                id: { in: invitedUserIds },
                deletedAt: null,
              },
              select: { id: true },
            });

            const existingUserIds = new Set(existingUsers.map((user) => user.id));
            const nonExistentUsers = invitedUserIds.filter(
              (userId) => !existingUserIds.has(userId),
            );

            if (nonExistentUsers.length > 0) {
              console.error("Some invited users do not exist:", nonExistentUsers);
              throw new Error(
                `The following user IDs do not exist: ${nonExistentUsers.join(", ")}`,
              );
            }

            await Promise.all(
              input.invitedUsers.map(async (invitedUser) => {
                return await tx.groupMember.create({
                  data: {
                    groupId: updatedGroup.id,
                    invitedById: ctx.userId,
                    memberId: invitedUser.userId,
                    isAdmin: invitedUser.role === "admin",
                    status: "INVITED",
                  },
                });
              }),
            );

            console.log("Completed inviting additional users to group");
          }

          console.log("Completed create group transaction:", updatedGroup.id);

          return updatedGroup;
        });
      });

      if (error !== null) {
        console.error("Error creating group:", error);
        return {
          data: null,
          error: {
            message:
              error.message ||
              "An error occurred while creating the group. Please try again later.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log("Group created successfully:", data.id, "with slug:", data.slug);

      return { data: data.slug, error: null };
    }),

  getGroupBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<GetGroupResponse>> => {
      const { data: group, error: groupError } = await withCatch(async () => {
        return await ctx.db.group.findUnique({
          where: { slug: input.slug, deletedAt: null },
          include: {
            members: {
              where: { status: { in: ["JOINED", "INVITED"] }, deletedAt: null },
              select: {
                isAdmin: true,
                status: true,
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
              orderBy: { createdAt: "desc" },
              include: {
                transactionDetails: {
                  include: {
                    recipient: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        createdAt: true,
                      },
                    },
                  },
                },
                createdBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    createdAt: true,
                  },
                },
                payer: {
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
        });
      });

      if (groupError !== null) {
        console.error("Error fetching group:", groupError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!group) {
        console.error("Group not found for slug:", input.slug);
        return {
          data: null,
          error: {
            message: "Group not found",
            code: "NOT_FOUND",
          },
        };
      }

      const { data: isMember, error: isMemberError } = await isUserInGroupByStatus(
        ctx,
        group.id,
        ctx.userId,
        "JOINED",
      );
      if (isMemberError !== null) {
        console.error(
          "error checking group membership:",
          isMemberError.message,
          isMemberError.code,
        );
        return { data: null, error: isMemberError };
      }

      if (!isMember) {
        console.warn("User is not a member of the group:", ctx.userId);
        return {
          data: null,
          error: { message: "You are not a member of this group", code: "FORBIDDEN" },
        };
      }

      console.log("Group fetched successfully:", group.slug);

      const balanceData = calculateGroupBalances(
        group.transactions.map((t) => ({
          payerId: t.payerId,
          amount: t.amount.toNumber(),
          transactionDetails: t.transactionDetails.map((d) => ({
            recipientId: d.recipientId,
            amount: d.amount.toNumber(),
          })),
        })),
      );

      const memberIds = new Set(group.members.map((m) => m.member.id));
      const formerMemberIds = Object.entries(balanceData.userBalances)
        .filter(
          ([userId, balance]) => !memberIds.has(userId) && Math.abs(balance.netBalance) > 0.01,
        )
        .map(([userId]) => userId);

      let formerMembers: GetGroupResponse["members"] = [];
      if (formerMemberIds.length > 0) {
        const { data: users } = await withCatch(async () => {
          return await ctx.db.user.findMany({
            where: { id: { in: formerMemberIds } },
            select: { id: true, firstName: true, lastName: true, createdAt: true },
          });
        });
        if (users) {
          formerMembers = users.map((u) => ({ ...u, isAdmin: false, status: "LEFT" as const }));
        }
      }

      const groupResponse: GetGroupResponse = {
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        createdAt: group.createdAt,
        createdById: group.createdById,
        members: [
          ...group.members.map((member) => ({
            ...member.member,
            isAdmin: member.isAdmin,
            status: member.status,
          })),
          ...formerMembers,
        ],
        transactions: group.transactions.map((transaction) => ({
          id: transaction.id,
          amount: transaction.amount.toNumber(),
          description: transaction.description,
          isSettlement: transaction.isSettlement,
          transactionDate: transaction.transactionDate,
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          createdById: transaction.createdById,
          payerId: transaction.payerId,
          createdBy: transaction.createdBy,
          payer: transaction.payer,
          transactionDetails: transaction.transactionDetails.map((detail) => ({
            id: detail.id,
            recipientId: detail.recipientId,
            amount: detail.amount.toNumber(),
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt,
            recipient: detail.recipient,
          })),
        })),
        balances: balanceData.userBalances,
        settlements: balanceData.settlementPlan,
      };

      return { data: groupResponse, error: null };
    }),

  deleteGroup: protectedProcedure
    .input(deleteGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      // First, fetch and validate the group
      const { data: groupToDelete, error: fetchError } = await withCatch(async () => {
        return await ctx.db.group.findUnique({
          where: { id: input.groupId, deletedAt: null },
        });
      });

      if (fetchError !== null) {
        console.error("Error fetching group for deletion:", fetchError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!groupToDelete) {
        return {
          data: null,
          error: {
            message: "Group not found",
            code: "NOT_FOUND",
          },
        };
      }

      if (groupToDelete.createdById !== ctx.userId) {
        return {
          data: null,
          error: {
            message:
              "You are not authorized to delete this group. Only the creator can delete the group.",
            code: "FORBIDDEN",
          },
        };
      }

      const { data, error } = await withCatch(async () => {
        if (input.hard !== true) {
          console.log("Soft deleting group:", groupToDelete.id);
          return await ctx.db.group.update({
            where: { id: input.groupId },
            data: { deletedAt: new Date() },
          });
        }

        console.log("Hard deleting group:", groupToDelete.id);
        return await ctx.db.group.delete({
          where: { id: input.groupId },
        });
      });

      if (error !== null) {
        console.error("Error deleting group:", error);
        return {
          data: null,
          error: {
            message: "An error occurred while deleting the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log("Group deleted successfully:", data.id);

      return { data: "Group deleted successfully", error: null };
    }),

  inviteUser: groupMemberProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      // Group membership is verified by middleware

      // If assigning admin role, verify the inviter is an admin or creator
      if (input.role === "admin") {
        const { data: inviter, error: inviterError } = await withCatch(async () => {
          return await ctx.db.groupMember.findFirst({
            where: {
              groupId: input.groupId,
              memberId: ctx.userId,
              status: "JOINED" as GroupMemberStatus,
              deletedAt: null,
            },
            include: { group: { select: { createdById: true } } },
          });
        });

        if (inviterError !== null) {
          return {
            data: null,
            error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
          };
        }

        if (!inviter) {
          return {
            data: null,
            error: { message: "Only admins can assign the admin role.", code: "FORBIDDEN" },
          };
        }

        const isGroupAdmin = inviter.isAdmin || inviter.group.createdById === ctx.userId;
        if (!isGroupAdmin) {
          return {
            data: null,
            error: { message: "Only admins can assign the admin role.", code: "FORBIDDEN" },
          };
        }
      }

      const { data: isAlreadyJoined, error: isAlreadyJoinedError } = await isUserInGroupByStatus(
        ctx,
        input.groupId,
        input.inviteeUserId,
        "JOINED",
      );

      if (isAlreadyJoinedError !== null) {
        console.error("Error checking if user is already joined:", isAlreadyJoinedError);
        return {
          data: null,
          error: isAlreadyJoinedError,
        };
      }

      if (isAlreadyJoined) {
        console.warn("User is already a member of the group:", input.inviteeUserId);
        return {
          data: null,
          error: {
            message: "User is already a member of the group",
            code: "BAD_REQUEST",
          },
        };
      }

      const { data: isAlreadyInvited, error: isAlreadyInvitedError } = await isUserInGroupByStatus(
        ctx,
        input.groupId,
        input.inviteeUserId,
        "INVITED",
      );

      if (isAlreadyInvitedError !== null) {
        console.error("Error checking if user is already invited:", isAlreadyInvitedError);
        return {
          data: null,
          error: isAlreadyInvitedError,
        };
      }

      if (isAlreadyInvited) {
        console.warn("User is already invited to the group:", input.inviteeUserId);
        return {
          data: null,
          error: {
            message: "User is already invited to the group",
            code: "BAD_REQUEST",
          },
        };
      }

      // Verify the user to be invited exists
      const { data: userExists, error: userExistsError } = await withCatch(async () => {
        return await ctx.db.user.findUnique({
          where: {
            id: input.inviteeUserId,
            deletedAt: null,
          },
          select: { id: true },
        });
      });

      if (userExistsError !== null) {
        console.error("Error checking if user exists:", userExistsError);
        return {
          data: null,
          error: {
            message: "An error occurred while validating the user.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!userExists) {
        console.warn("User to be invited does not exist:", input.inviteeUserId);
        return {
          data: null,
          error: {
            message: "The user you are trying to invite does not exist",
            code: "BAD_REQUEST",
          },
        };
      }

      console.log("Inviting user to group:", input.inviteeUserId, "by", ctx.userId);

      // Check for a previously soft-deleted invite and restore it
      const { data: deletedInvite, error: deletedInviteError } = await withCatch(async () => {
        return await ctx.db.groupMember.findFirst({
          where: {
            groupId: input.groupId,
            memberId: input.inviteeUserId,
            deletedAt: { not: null },
          },
        });
      });

      if (deletedInviteError !== null) {
        console.error("Error checking for deleted invite:", deletedInviteError);
        return {
          data: null,
          error: {
            message: "An error occurred while inviting the user.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (deletedInvite) {
        // Restore the soft-deleted record
        const { error: restoreError } = await withCatch(async () => {
          return await ctx.db.groupMember.update({
            where: { id: deletedInvite.id },
            data: {
              deletedAt: null,
              status: "INVITED",
              invitedById: ctx.userId,
              isAdmin: input.role === "admin",
            },
          });
        });

        if (restoreError !== null) {
          console.error("Error restoring invite:", restoreError);
          return {
            data: null,
            error: {
              message: "An error occurred while inviting the user.",
              code: "INTERNAL_SERVER_ERROR",
            },
          };
        }

        console.log("Restored previously deleted invite for user:", input.inviteeUserId);
        return { data: "User invited successfully", error: null };
      }

      const { error: inviteUserError } = await withCatch(async () => {
        return await ctx.db.groupMember.create({
          data: {
            groupId: input.groupId,
            invitedById: ctx.userId,
            memberId: input.inviteeUserId,
            isAdmin: input.role === "admin",
            status: "INVITED",
          },
        });
      });

      if (inviteUserError !== null) {
        console.error("Error inviting user to group:", inviteUserError);
        return {
          data: null,
          error: {
            message: "An error occurred while inviting the user.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }
      console.log("User invited to group successfully:", input.inviteeUserId);

      return { data: "User invited successfully", error: null };
    }),

  uninviteUser: groupAdminProcedure
    .input(uninviteMemberSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const groupId = input.groupId;
      const targetUserId = input.userId;

      // Find the invited member
      const { data: invitedMember, error: findError } = await withCatch(async () => {
        return await ctx.db.groupMember.findFirst({
          where: {
            groupId: groupId,
            memberId: targetUserId,
            status: "INVITED",
            deletedAt: null,
          },
        });
      });

      if (findError !== null) {
        return {
          data: null,
          error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      if (!invitedMember) {
        return {
          data: null,
          error: { message: "No pending invite found for this user.", code: "NOT_FOUND" },
        };
      }

      // Soft delete the invite
      const { error: deleteError } = await withCatch(async () => {
        return await ctx.db.groupMember.update({
          where: { id: invitedMember.id },
          data: { deletedAt: new Date() },
        });
      });

      if (deleteError !== null) {
        return {
          data: null,
          error: {
            message: "An error occurred while revoking the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      return { data: "Invite revoked successfully", error: null };
    }),

  restoreInvite: groupAdminProcedure
    .input(restoreInviteSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const groupId = input.groupId;
      const targetUserId = input.userId;

      // Find the soft-deleted invite
      const { data: deletedInvite, error: findError } = await withCatch(async () => {
        return await ctx.db.groupMember.findFirst({
          where: {
            groupId: groupId,
            memberId: targetUserId,
            status: "INVITED",
            deletedAt: { not: null },
          },
          orderBy: { deletedAt: "desc" },
        });
      });

      if (findError !== null) {
        return {
          data: null,
          error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      if (!deletedInvite) {
        return {
          data: null,
          error: { message: "No revoked invite found to restore.", code: "NOT_FOUND" },
        };
      }

      const { error: restoreError } = await withCatch(async () => {
        return await ctx.db.groupMember.update({
          where: { id: deletedInvite.id },
          data: { deletedAt: null },
        });
      });

      if (restoreError !== null) {
        return {
          data: null,
          error: {
            message: "An error occurred while restoring the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      return { data: "Invite restored successfully", error: null };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ groupMemberId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const { data: existingInvite, error: existingInviteError } = await withCatch(async () => {
        return await ctx.db.groupMember.findUnique({
          where: { id: input.groupMemberId, deletedAt: null },
        });
      });

      if (existingInviteError !== null) {
        console.error("Error fetching existing invite:", existingInviteError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!existingInvite) {
        console.warn("Invite not found for ID:", input.groupMemberId);
        return {
          data: null,
          error: {
            message: "Invite not found",
            code: "NOT_FOUND",
          },
        };
      }

      if (existingInvite.memberId !== ctx.userId) {
        console.warn("user can not accept invite on behalf of someone else", ctx.userId);
        return {
          data: null,
          error: {
            message: "user can not accept invite on behalf of someone else",
            code: "FORBIDDEN",
          },
        };
      }
      console.log(
        "accepting invite for group member:",
        existingInvite.id,
        "for group:",
        existingInvite.groupId,
      );

      const { error } = await withCatch(async () => {
        return await ctx.db.groupMember.update({
          where: { id: input.groupMemberId },
          data: {
            status: "JOINED",
          },
        });
      });

      if (error !== null) {
        console.error("Error accepting group invite:", error);
        return {
          data: null,
          error: {
            message: "An error occurred while accepting the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        "Group invite accepted successfully:",
        existingInvite.groupId,
        "by user:",
        ctx.userId,
      );

      return { data: "Invite accepted successfully", error: null };
    }),

  createTransaction: groupMemberProcedure
    .input(createTransactionSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      // Group membership is verified by middleware
      const isSettlement = input.isSettlement ?? false;

      // Settlement-specific validation
      if (isSettlement) {
        if (input.transactionDetails.length !== 1) {
          return {
            data: null,
            error: { message: "Settlements must have exactly one recipient.", code: "BAD_REQUEST" },
          };
        }
        if (input.payerId === input.transactionDetails[0]!.recipientId) {
          return {
            data: null,
            error: { message: "Cannot settle up with yourself.", code: "BAD_REQUEST" },
          };
        }
        // Only the payer or recipient can record a settlement
        const recipientId = input.transactionDetails[0]!.recipientId;
        if (ctx.userId !== input.payerId && ctx.userId !== recipientId) {
          return {
            data: null,
            error: {
              message: "Only the payer or recipient can record this settlement.",
              code: "FORBIDDEN",
            },
          };
        }
      }

      // Regular transactions require amounts to add up
      if (
        !isSettlement &&
        !verifyTransactionDetails(input.amount, input.transactionDetails, input.payerId)
      ) {
        return {
          data: null,
          error: {
            message:
              "Invalid transaction details. Please check that amounts add up correctly and no user is selected more than once.",
            code: "BAD_REQUEST",
          },
        };
      }

      // Verify that payer and all recipients are members of the group
      const allRecipientIds = input.transactionDetails.map((detail) => detail.recipientId);
      const allUserIds = [input.payerId, ...allRecipientIds];

      const { error: membershipError } = await verifyUsersAreGroupMembers(
        ctx,
        input.groupId,
        allUserIds,
      );
      if (membershipError !== null) {
        return { data: null, error: membershipError };
      }

      // Create the transaction and transaction details in a database transaction
      // Settlements are stored with negative amounts (payback, not expense)
      const storedAmount = isSettlement ? -input.amount : input.amount;

      const { data: transaction, error: transactionError } = await withCatch(async () => {
        return await ctx.db.$transaction(async (tx) => {
          console.log("Creating transaction for group:", input.groupId, "by user:", ctx.userId);

          // Create the main transaction
          const newTransaction = await tx.transaction.create({
            data: {
              groupId: input.groupId,
              amount: storedAmount,
              description: isSettlement ? "Settlement" : (input.description ?? null),
              transactionDate: input.transactionDate,
              payerId: input.payerId,
              createdById: ctx.userId,
              isSettlement,
            },
          });

          console.log("Created transaction with ID:", newTransaction.id);

          // Create all transaction details
          const transactionDetails = await Promise.all(
            input.transactionDetails.map(async (detail) => {
              return await tx.transactionDetail.create({
                data: {
                  transactionId: newTransaction.id,
                  recipientId: detail.recipientId,
                  groupId: input.groupId,
                  amount: isSettlement ? -detail.amount : detail.amount,
                },
              });
            }),
          );

          console.log(
            `Created ${transactionDetails.length} transaction details for transaction ${newTransaction.id}`,
          );

          return newTransaction;
        });
      });

      if (transactionError !== null) {
        console.error("Error creating transaction:", transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while creating the transaction. Please try again later.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log("Transaction created successfully:", transaction.id);
      return { data: "Transaction created successfully", error: null };
    }),

  getDetailedBalances: groupMemberProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<BalanceCalculationResult>> => {
      // Fetch all transactions for the group
      const { data: transactions, error: transactionError } = await withCatch(async () => {
        return await ctx.db.transaction.findMany({
          where: {
            groupId: input.groupId,
            deletedAt: null,
          },
          include: {
            transactionDetails: true,
          },
        });
      });

      if (transactionError !== null) {
        console.error("Error fetching transactions:", transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching transactions.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      // Transform transactions to match our helper function signature
      const transformedTransactions = transactions.map((transaction) => ({
        payerId: transaction.payerId,
        amount: transaction.amount.toNumber(), // Convert Decimal to number
        transactionDetails: transaction.transactionDetails.map((detail) => ({
          recipientId: detail.recipientId,
          amount: detail.amount.toNumber(), // Convert Decimal to number
        })),
      }));

      // Calculate balances using helper method
      const balanceData = calculateGroupBalances(transformedTransactions);

      return {
        data: balanceData,
        error: null,
      };
    }),

  getSimpleBalances: groupMemberProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<Record<string, UserBalance>>> => {
      // Group membership is verified by middleware

      // Fetch all transactions for the group
      const { data: transactions, error: transactionError } = await withCatch(async () => {
        return await ctx.db.transaction.findMany({
          where: {
            groupId: input.groupId,
            deletedAt: null,
          },
          include: {
            transactionDetails: true,
          },
        });
      });

      if (transactionError !== null) {
        console.error("Error fetching transactions:", transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching transactions.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      // Transform transactions to match our helper function signature
      const transformedTransactions = transactions.map((transaction) => ({
        payerId: transaction.payerId,
        amount: transaction.amount.toNumber(), // Convert Decimal to number
        transactionDetails: transaction.transactionDetails.map((detail) => ({
          recipientId: detail.recipientId,
          amount: detail.amount.toNumber(), // Convert Decimal to number
        })),
      }));

      // Calculate balances using helper method and return just the user balances
      const balanceData = calculateGroupBalances(transformedTransactions);

      return {
        data: balanceData.userBalances,
        error: null,
      };
    }),
});

async function isUserInGroupByStatus(
  ctx: TRPCContext,
  groupId: number,
  userId: string,
  status: GroupMemberStatus,
): Promise<ApiResponse<boolean>> {
  if (!userId) {
    return {
      data: null,
      error: {
        code: "BAD_REQUEST",
        message: "User ID is required to check group membership.",
      },
    };
  }

  const { data: isMemberResponse, error: isMemberError } = await withCatch(async () => {
    return await ctx.db.groupMember.findFirst({
      where: {
        groupId: groupId,
        memberId: userId,
        status: status,
        deletedAt: null,
      },
    });
  });

  if (isMemberError !== null) {
    console.error("Error checking group membership:", isMemberError);
    return {
      data: null,
      error: {
        message: "An error occurred while checking group membership.",
        code: "INTERNAL_SERVER_ERROR",
      },
    };
  }

  const isMember = isMemberResponse !== null;

  return {
    data: isMember,
    error: null,
  };
}

function verifyTransactionDetails(
  transactionAmount: number,
  transactionDetails: CreateTransactionDetail[],
  _payerId: string,
): boolean {
  if (transactionDetails.length === 0) {
    console.error("Transaction details cannot be empty");
    return false;
  }

  // Check for duplicate recipients
  const recipientIds = transactionDetails.map((detail) => detail.recipientId);
  const uniqueRecipientIds = new Set(recipientIds);
  if (recipientIds.length !== uniqueRecipientIds.size) {
    console.error("Duplicate recipients found in transaction details");
    return false;
  }

  const totalAmount = transactionDetails.reduce((sum, detail) => sum + detail.amount, 0);
  if (totalAmount !== transactionAmount) {
    console.error("Total amount of transaction details does not match transaction amount");
    return false;
  }

  return true;
}

async function verifyUsersAreGroupMembers(
  ctx: TRPCContext,
  groupId: number,
  userIds: string[],
): Promise<ApiResponse<void>> {
  const uniqueUserIds = [...new Set(userIds)];

  // First verify all users exist
  const { data: existingUsers, error: userLookupError } = await withCatch(async () => {
    return await ctx.db.user.findMany({
      where: {
        id: { in: uniqueUserIds },
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  if (userLookupError !== null) {
    console.error("Error checking if users exist:", userLookupError);
    return {
      data: null,
      error: {
        message: "An error occurred while validating users.",
        code: "INTERNAL_SERVER_ERROR",
      },
    };
  }

  const existingUserIds = new Set(existingUsers.map((user) => user.id));
  const nonExistentUsers = uniqueUserIds.filter((userId) => !existingUserIds.has(userId));

  if (nonExistentUsers.length > 0) {
    console.warn("Some users do not exist:", nonExistentUsers);
    return {
      data: null,
      error: {
        message: `The following users do not exist: ${nonExistentUsers.join(", ")}`,
        code: "BAD_REQUEST",
      },
    };
  }

  // Now check group membership for all existing users
  for (const userId of uniqueUserIds) {
    const { data: isJoined } = await isUserInGroupByStatus(ctx, groupId, userId, "JOINED");
    const { data: isInvited } = await isUserInGroupByStatus(ctx, groupId, userId, "INVITED");

    if (!isJoined && !isInvited) {
      console.warn("User is not a member or invitee of the group:", userId);
      return {
        data: null,
        error: {
          message: "All users (payer and recipients) must be members or invitees of the group",
          code: "BAD_REQUEST",
        },
      };
    }
  }

  return { data: undefined, error: null };
}
