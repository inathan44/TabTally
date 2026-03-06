import type { GroupMemberStatus, Prisma, TransactionCategory } from "@prisma/client";
import { z } from "zod";
import { withCatch } from "~/lib/utils";
import { createGroupSlug } from "~/lib/slugify";
import { storageService, type UploadResult } from "~/server/services/storage";

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
  updateTransactionSchema,
  deleteTransactionSchema,
  restoreTransactionSchema,
  createSettlementSchema,
  deleteGroupSchema,
  updateGroupSchema,
  updateMemberRoleSchema,
  restoreGroupSchema,
  getGroupTransactionsSchema,
  transactionCategories,
  transactionCategoryLabels,
  inviteMemberSchema,
  uninviteMemberSchema,
  restoreInviteSchema,
  type GetGroupResponse,
} from "~/server/contracts/groups";
import type { CreateTransactionDetail } from "~/server/contracts/transactionDetail";
import type { SafeTransaction } from "~/server/contracts/transactions";
import type { BalanceCalculationResult, UserBalance } from "~/server/contracts/balances";
import { calculateGroupBalances } from "~/server/helpers/balanceCalculation";

export const groupRouter = createTRPCRouter({
  createGroup: protectedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(`[createGroup] User ${ctx.userId} creating group "${input.name}"`);
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

          const slug = createGroupSlug(input.name, newGroup.id);

          const updatedGroup = await tx.group.update({
            where: { id: newGroup.id },
            data: { slug },
          });

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
              console.error(
                `[createGroup] Non-existent invited user IDs: ${nonExistentUsers.join(", ")}`,
              );
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
          }

          return updatedGroup;
        });
      });

      if (error !== null) {
        console.error(`[createGroup] Failed for user ${ctx.userId}:`, error);
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

      console.log(`[createGroup] Created group ${data.id}, slug=${data.slug}`);

      return { data: data.slug, error: null };
    }),

  getGroupBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<GetGroupResponse>> => {
      console.log(`[getGroupBySlug] User ${ctx.userId} fetching group slug="${input.slug}"`);
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
                    username: true,
                    firstName: true,
                    lastName: true,
                    createdAt: true,
                    venmoUsername: true,
                    cashappUsername: true,
                    zelleUsername: true,
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
                        username: true,
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
                    username: true,
                    firstName: true,
                    lastName: true,
                    createdAt: true,
                  },
                },
                payer: {
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
          },
        });
      });

      if (groupError !== null) {
        console.error(`[getGroupBySlug] Failed to fetch slug="${input.slug}":`, groupError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!group) {
        console.warn(`[getGroupBySlug] Group not found for slug="${input.slug}"`);
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
          `[getGroupBySlug] Membership check failed for user ${ctx.userId}:`,
          isMemberError,
        );
        return { data: null, error: isMemberError };
      }

      if (!isMember) {
        console.warn(
          `[getGroupBySlug] User ${ctx.userId} is not a member of group slug="${input.slug}"`,
        );
        return {
          data: null,
          error: { message: "You are not a member of this group", code: "FORBIDDEN" },
        };
      }

      console.log(`[getGroupBySlug] Returned group ${group.id}, slug="${group.slug}"`);

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
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              venmoUsername: true,
              cashappUsername: true,
              zelleUsername: true,
            },
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
          category: transaction.category,
          receiptUrl: transaction.receiptUrl,
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

  getGroupTransactions: groupMemberProcedure
    .input(getGroupTransactionsSchema)
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeTransaction[]>> => {
      console.log(
        `[getGroupTransactions] User ${ctx.userId} fetching transactions for group ${input.groupId}`,
      );
      const where: Prisma.TransactionWhereInput = {
        groupId: input.groupId,
        deletedAt: null,
      };

      if (input.search) {
        const term = input.search;
        where.OR = [
          { description: { contains: term, mode: "insensitive" } },
          { payer: { firstName: { contains: term, mode: "insensitive" } } },
          { payer: { lastName: { contains: term, mode: "insensitive" } } },
          {
            transactionDetails: {
              some: { recipient: { firstName: { contains: term, mode: "insensitive" } } },
            },
          },
          {
            transactionDetails: {
              some: { recipient: { lastName: { contains: term, mode: "insensitive" } } },
            },
          },
          // Match category by checking if the search term matches any category enum value
          ...transactionCategories
            .filter((cat) =>
              transactionCategoryLabels[cat].toLowerCase().includes(term.toLowerCase()),
            )
            .map((cat) => ({ category: cat as TransactionCategory })),
        ];
      }

      if (input.categories && input.categories.length > 0) {
        where.category = { in: input.categories };
      }

      if (input.payerIds && input.payerIds.length > 0) {
        where.payerId = { in: input.payerIds };
      }

      if (input.dateFrom || input.dateTo) {
        where.transactionDate = {};
        if (input.dateFrom) where.transactionDate.gte = input.dateFrom;
        if (input.dateTo) {
          const endOfDay = new Date(input.dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          where.transactionDate.lte = endOfDay;
        }
      }

      const { data: transactions, error: fetchError } = await withCatch(async () => {
        return await ctx.db.transaction.findMany({
          where,
          orderBy: { transactionDate: "desc" },
          include: {
            transactionDetails: {
              include: {
                recipient: {
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
            createdBy: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                createdAt: true,
              },
            },
            payer: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                createdAt: true,
              },
            },
          },
        });
      });

      if (fetchError !== null) {
        console.error(`[getGroupTransactions] Failed for group ${input.groupId}:`, fetchError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching transactions.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      const mapped: SafeTransaction[] = transactions.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount.toNumber(),
        description: transaction.description,
        category: transaction.category,
        receiptUrl: transaction.receiptUrl,
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
      }));

      console.log(
        `[getGroupTransactions] Returned ${mapped.length} transactions for group ${input.groupId}`,
      );
      return { data: mapped, error: null };
    }),

  deleteGroup: protectedProcedure
    .input(deleteGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[deleteGroup] User ${ctx.userId} deleting group ${input.groupId}, hard=${input.hard ?? false}`,
      );
      const { data: groupToDelete, error: fetchError } = await withCatch(async () => {
        return await ctx.db.group.findUnique({
          where: { id: input.groupId, deletedAt: null },
        });
      });

      if (fetchError !== null) {
        console.error(`[deleteGroup] Failed to fetch group ${input.groupId}:`, fetchError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!groupToDelete) {
        console.warn(`[deleteGroup] Group ${input.groupId} not found`);
        return {
          data: null,
          error: {
            message: "Group not found",
            code: "NOT_FOUND",
          },
        };
      }

      if (groupToDelete.createdById !== ctx.userId) {
        console.warn(
          `[deleteGroup] User ${ctx.userId} not authorized to delete group ${input.groupId}`,
        );
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
          return await ctx.db.group.update({
            where: { id: input.groupId },
            data: { deletedAt: new Date() },
          });
        }

        return await ctx.db.group.delete({
          where: { id: input.groupId },
        });
      });

      if (error !== null) {
        console.error(`[deleteGroup] Failed to delete group ${input.groupId}:`, error);
        return {
          data: null,
          error: {
            message: "An error occurred while deleting the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[deleteGroup] Deleted group ${data.id}`);
      return { data: "Group deleted successfully", error: null };
    }),

  restoreGroup: protectedProcedure
    .input(restoreGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(`[restoreGroup] User ${ctx.userId} restoring group ${input.groupId}`);
      const { data: group, error: fetchError } = await withCatch(async () => {
        return await ctx.db.group.findFirst({
          where: { id: input.groupId, deletedAt: { not: null } },
        });
      });

      if (fetchError !== null) {
        console.error(`[restoreGroup] Failed to fetch group ${input.groupId}:`, fetchError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!group) {
        console.warn(`[restoreGroup] No deleted group found for id ${input.groupId}`);
        return {
          data: null,
          error: { message: "No deleted group found to restore.", code: "NOT_FOUND" },
        };
      }

      if (group.createdById !== ctx.userId) {
        console.warn(
          `[restoreGroup] User ${ctx.userId} not authorized to restore group ${input.groupId}`,
        );
        return {
          data: null,
          error: {
            message: "Only the group creator can restore a deleted group.",
            code: "FORBIDDEN",
          },
        };
      }

      const { error: restoreError } = await withCatch(async () => {
        return await ctx.db.group.update({
          where: { id: input.groupId },
          data: { deletedAt: null },
        });
      });

      if (restoreError !== null) {
        console.error(`[restoreGroup] Failed to restore group ${input.groupId}:`, restoreError);
        return {
          data: null,
          error: {
            message: "An error occurred while restoring the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[restoreGroup] Restored group ${input.groupId}`);
      return { data: "Group restored successfully", error: null };
    }),

  updateGroup: groupAdminProcedure
    .input(updateGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(`[updateGroup] User ${ctx.userId} updating group ${input.groupId}`);
      const { error: updateError } = await withCatch(async () => {
        return await ctx.db.group.update({
          where: { id: input.groupId, deletedAt: null },
          data: {
            name: input.name,
            description: input.description ?? null,
          },
        });
      });

      if (updateError !== null) {
        console.error(`[updateGroup] Failed for group ${input.groupId}:`, updateError);
        return {
          data: null,
          error: {
            message: "An error occurred while updating the group.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[updateGroup] Updated group ${input.groupId}`);
      return { data: "Group updated successfully", error: null };
    }),

  updateMemberRole: groupAdminProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[updateMemberRole] User ${ctx.userId} setting member ${input.memberId} isAdmin=${input.isAdmin} in group ${input.groupId}`,
      );
      if (input.memberId === ctx.userId) {
        console.warn(`[updateMemberRole] User ${ctx.userId} tried to change own role`);
        return {
          data: null,
          error: { message: "You cannot change your own role.", code: "BAD_REQUEST" },
        };
      }

      // Cannot demote the group creator
      const { data: group, error: groupError } = await withCatch(async () => {
        return await ctx.db.group.findUnique({ where: { id: input.groupId } });
      });

      if (groupError !== null || !group) {
        console.warn(`[updateMemberRole] Group ${input.groupId} not found`);
        return {
          data: null,
          error: { message: "Group not found.", code: "NOT_FOUND" },
        };
      }

      if (input.memberId === group.createdById && !input.isAdmin) {
        console.warn(
          `[updateMemberRole] Cannot demote group owner ${input.memberId} in group ${input.groupId}`,
        );
        return {
          data: null,
          error: { message: "The group owner cannot be demoted.", code: "FORBIDDEN" },
        };
      }

      const { data: member, error: fetchError } = await withCatch(async () => {
        return await ctx.db.groupMember.findUnique({
          where: {
            groupId_memberId: { groupId: input.groupId, memberId: input.memberId },
          },
        });
      });

      if (fetchError !== null) {
        console.error(`[updateMemberRole] Failed to fetch member ${input.memberId}:`, fetchError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the member.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!member || member.deletedAt !== null) {
        console.warn(
          `[updateMemberRole] Member ${input.memberId} not found in group ${input.groupId}`,
        );
        return {
          data: null,
          error: { message: "Member not found in this group.", code: "NOT_FOUND" },
        };
      }

      if (member.status !== "JOINED") {
        console.warn(
          `[updateMemberRole] Member ${input.memberId} status is ${member.status}, not JOINED`,
        );
        return {
          data: null,
          error: { message: "Can only change roles for joined members.", code: "BAD_REQUEST" },
        };
      }

      const { error: updateError } = await withCatch(async () => {
        return await ctx.db.groupMember.update({
          where: { id: member.id },
          data: { isAdmin: input.isAdmin },
        });
      });

      if (updateError !== null) {
        console.error(
          `[updateMemberRole] Failed for member ${input.memberId} in group ${input.groupId}:`,
          updateError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while updating the member role.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        `[updateMemberRole] Member ${input.memberId} ${input.isAdmin ? "promoted to admin" : "demoted to member"} in group ${input.groupId}`,
      );
      return {
        data: `Member ${input.isAdmin ? "promoted to admin" : "demoted to member"} successfully`,
        error: null,
      };
    }),

  inviteUser: groupMemberProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[inviteUser] User ${ctx.userId} inviting ${input.inviteeUserId} to group ${input.groupId}, role=${input.role}`,
      );

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
          console.error(`[inviteUser] Failed to check inviter permissions:`, inviterError);
          return {
            data: null,
            error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
          };
        }

        if (!inviter) {
          console.warn(`[inviteUser] Non-admin user ${ctx.userId} tried to assign admin role`);
          return {
            data: null,
            error: { message: "Only admins can assign the admin role.", code: "FORBIDDEN" },
          };
        }

        const isGroupAdmin = inviter.isAdmin || inviter.group.createdById === ctx.userId;
        if (!isGroupAdmin) {
          console.warn(
            `[inviteUser] User ${ctx.userId} is not admin, cannot assign admin role in group ${input.groupId}`,
          );
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
        console.error(
          `[inviteUser] Failed to check membership for user ${input.inviteeUserId}:`,
          isAlreadyJoinedError,
        );
        return {
          data: null,
          error: isAlreadyJoinedError,
        };
      }

      if (isAlreadyJoined) {
        console.warn(
          `[inviteUser] User ${input.inviteeUserId} already joined group ${input.groupId}`,
        );
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
        console.error(
          `[inviteUser] Failed to check invite status for user ${input.inviteeUserId}:`,
          isAlreadyInvitedError,
        );
        return {
          data: null,
          error: isAlreadyInvitedError,
        };
      }

      if (isAlreadyInvited) {
        console.warn(
          `[inviteUser] User ${input.inviteeUserId} already invited to group ${input.groupId}`,
        );
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
        console.error(
          `[inviteUser] Failed to verify user ${input.inviteeUserId} exists:`,
          userExistsError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while validating the user.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!userExists) {
        console.warn(`[inviteUser] User ${input.inviteeUserId} does not exist`);
        return {
          data: null,
          error: {
            message: "The user you are trying to invite does not exist",
            code: "BAD_REQUEST",
          },
        };
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
        console.error(
          `[inviteUser] Failed to invite user ${input.inviteeUserId} to group ${input.groupId}:`,
          inviteUserError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while inviting the user.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }
      console.log(`[inviteUser] Invited user ${input.inviteeUserId} to group ${input.groupId}`);

      return { data: "User invited successfully", error: null };
    }),

  uninviteUser: groupAdminProcedure
    .input(uninviteMemberSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const groupId = input.groupId;
      const targetUserId = input.userId;
      console.log(
        `[uninviteUser] User ${ctx.userId} revoking invite for ${targetUserId} in group ${groupId}`,
      );

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
        console.error(
          `[uninviteUser] Failed to find invite for ${targetUserId} in group ${groupId}:`,
          findError,
        );
        return {
          data: null,
          error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      if (!invitedMember) {
        console.warn(
          `[uninviteUser] No pending invite for user ${targetUserId} in group ${groupId}`,
        );
        return {
          data: null,
          error: { message: "No pending invite found for this user.", code: "NOT_FOUND" },
        };
      }

      // Hard delete the invite
      const { error: deleteError } = await withCatch(async () => {
        return await ctx.db.groupMember.delete({
          where: { id: invitedMember.id },
        });
      });

      if (deleteError !== null) {
        console.error(
          `[uninviteUser] Failed to revoke invite for ${targetUserId} in group ${groupId}:`,
          deleteError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while revoking the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[uninviteUser] Revoked invite for user ${targetUserId} in group ${groupId}`);
      return { data: "Invite revoked successfully", error: null };
    }),

  restoreInvite: groupAdminProcedure
    .input(restoreInviteSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      const groupId = input.groupId;
      const targetUserId = input.userId;
      console.log(
        `[restoreInvite] User ${ctx.userId} restoring invite for ${targetUserId} in group ${groupId}`,
      );

      // Check if already a member or has a pending invite
      const { data: existingMember, error: findError } = await withCatch(async () => {
        return await ctx.db.groupMember.findFirst({
          where: { groupId, memberId: targetUserId },
        });
      });

      if (findError !== null) {
        console.error(
          `[restoreInvite] Failed to check membership for ${targetUserId} in group ${groupId}:`,
          findError,
        );
        return {
          data: null,
          error: { message: "An error occurred.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      if (existingMember) {
        console.warn(
          `[restoreInvite] User ${targetUserId} already has active membership or invite in group ${groupId}`,
        );
        return {
          data: null,
          error: {
            message: "User already has an active membership or invite.",
            code: "BAD_REQUEST",
          },
        };
      }

      // Re-create the invite
      const { error: createError } = await withCatch(async () => {
        return await ctx.db.groupMember.create({
          data: {
            groupId,
            memberId: targetUserId,
            invitedById: ctx.userId,
            isAdmin: false,
            status: "INVITED",
          },
        });
      });

      if (createError !== null) {
        console.error(
          `[restoreInvite] Failed to restore invite for ${targetUserId} in group ${groupId}:`,
          createError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while restoring the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[restoreInvite] Restored invite for user ${targetUserId} in group ${groupId}`);
      return { data: "Invite restored successfully", error: null };
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ groupMemberId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(`[acceptInvite] User ${ctx.userId} accepting invite ${input.groupMemberId}`);
      const { data: existingInvite, error: existingInviteError } = await withCatch(async () => {
        return await ctx.db.groupMember.findUnique({
          where: { id: input.groupMemberId, deletedAt: null },
        });
      });

      if (existingInviteError !== null) {
        console.error(
          `[acceptInvite] Failed to fetch invite ${input.groupMemberId}:`,
          existingInviteError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!existingInvite) {
        console.warn(`[acceptInvite] Invite ${input.groupMemberId} not found`);
        return {
          data: null,
          error: {
            message: "Invite not found",
            code: "NOT_FOUND",
          },
        };
      }

      if (existingInvite.memberId !== ctx.userId) {
        console.warn(
          `[acceptInvite] User ${ctx.userId} tried to accept invite ${input.groupMemberId} belonging to another user`,
        );
        return {
          data: null,
          error: {
            message: "You can only accept your own invitations.",
            code: "FORBIDDEN",
          },
        };
      }

      if (existingInvite.status !== "INVITED") {
        console.warn(
          `[acceptInvite] Invite ${input.groupMemberId} already responded to, status=${existingInvite.status}`,
        );
        return {
          data: null,
          error: {
            message: "This invitation has already been responded to.",
            code: "BAD_REQUEST",
          },
        };
      }

      const { error } = await withCatch(async () => {
        return await ctx.db.groupMember.update({
          where: { id: input.groupMemberId },
          data: {
            status: "JOINED",
          },
        });
      });

      if (error !== null) {
        console.error(`[acceptInvite] Failed to accept invite ${input.groupMemberId}:`, error);
        return {
          data: null,
          error: {
            message: "An error occurred while accepting the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[acceptInvite] User ${ctx.userId} accepted invite ${input.groupMemberId}`);
      return { data: "Invite accepted successfully", error: null };
    }),

  declineInvite: protectedProcedure
    .input(z.object({ groupMemberId: z.number() }))
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(`[declineInvite] User ${ctx.userId} declining invite ${input.groupMemberId}`);
      const { data: existingInvite, error: fetchError } = await withCatch(async () => {
        return await ctx.db.groupMember.findUnique({
          where: { id: input.groupMemberId, deletedAt: null },
        });
      });

      if (fetchError !== null) {
        console.error(`[declineInvite] Failed to fetch invite ${input.groupMemberId}:`, fetchError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!existingInvite) {
        console.warn(`[declineInvite] Invite ${input.groupMemberId} not found`);
        return {
          data: null,
          error: { message: "Invite not found", code: "NOT_FOUND" },
        };
      }

      if (existingInvite.memberId !== ctx.userId) {
        console.warn(
          `[declineInvite] User ${ctx.userId} tried to decline invite ${input.groupMemberId} belonging to another user`,
        );
        return {
          data: null,
          error: {
            message: "You can only decline your own invitations.",
            code: "FORBIDDEN",
          },
        };
      }

      if (existingInvite.status !== "INVITED") {
        console.warn(
          `[declineInvite] Invite ${input.groupMemberId} already responded to, status=${existingInvite.status}`,
        );
        return {
          data: null,
          error: {
            message: "This invitation has already been responded to.",
            code: "BAD_REQUEST",
          },
        };
      }

      const { error } = await withCatch(async () => {
        return await ctx.db.groupMember.delete({
          where: { id: input.groupMemberId },
        });
      });

      if (error !== null) {
        console.error(`[declineInvite] Failed to decline invite ${input.groupMemberId}:`, error);
        return {
          data: null,
          error: {
            message: "An error occurred while declining the invite.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[declineInvite] User ${ctx.userId} declined invite ${input.groupMemberId}`);
      return { data: "Invite declined successfully", error: null };
    }),

  createTransaction: groupMemberProcedure
    .input(createTransactionSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[createTransaction] User ${ctx.userId} creating transaction in group ${input.groupId}, amount=${input.amount}`,
      );

      const nonZeroDetails = input.transactionDetails.filter((d) => d.amount > 0);

      if (!verifyTransactionDetails(input.amount, nonZeroDetails, input.payerId)) {
        console.warn(
          `[createTransaction] Invalid details for group ${input.groupId}: amount=${input.amount}, splits=${nonZeroDetails.length}, payerId=${input.payerId}`,
        );
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
      const allRecipientIds = nonZeroDetails.map((detail) => detail.recipientId);
      const allUserIds = [input.payerId, ...allRecipientIds];

      const { error: membershipError } = await verifyUsersAreGroupMembers(
        ctx,
        input.groupId,
        allUserIds,
      );
      if (membershipError !== null) {
        return { data: null, error: membershipError };
      }

      const { data: transaction, error: transactionError } = await withCatch(async () => {
        return await ctx.db.$transaction(async (tx) => {
          const newTransaction = await tx.transaction.create({
            data: {
              groupId: input.groupId,
              amount: input.amount,
              description: input.description ?? null,
              category: input.category ?? null,
              receiptUrl: input.receiptUrl ?? null,
              transactionDate: input.transactionDate,
              payerId: input.payerId,
              createdById: ctx.userId,
            },
          });

          await Promise.all(
            nonZeroDetails.map(async (detail) => {
              return await tx.transactionDetail.create({
                data: {
                  transactionId: newTransaction.id,
                  recipientId: detail.recipientId,
                  groupId: input.groupId,
                  amount: detail.amount,
                },
              });
            }),
          );

          return newTransaction;
        });
      });

      if (transactionError !== null) {
        console.error(`[createTransaction] Failed in group ${input.groupId}:`, transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while creating the transaction. Please try again later.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        `[createTransaction] Created transaction ${transaction.id} in group ${input.groupId}`,
      );
      return { data: "Transaction created successfully", error: null };
    }),

  createSettlement: groupMemberProcedure
    .input(createSettlementSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[createSettlement] User ${ctx.userId} recording settlement in group ${input.groupId}, amount=${input.amount}`,
      );
      if (input.payerId === input.recipientId) {
        console.warn(`[createSettlement] User ${input.payerId} tried to settle with self`);
        return {
          data: null,
          error: { message: "Cannot settle up with yourself.", code: "BAD_REQUEST" },
        };
      }

      // Only the payer or recipient can record a settlement
      if (ctx.userId !== input.payerId && ctx.userId !== input.recipientId) {
        console.warn(`[createSettlement] User ${ctx.userId} is neither payer nor recipient`);
        return {
          data: null,
          error: {
            message: "Only the payer or recipient can record a settlement.",
            code: "FORBIDDEN",
          },
        };
      }

      const { error: membershipError } = await verifyUsersAreGroupMembers(ctx, input.groupId, [
        input.payerId,
        input.recipientId,
      ]);
      if (membershipError !== null) {
        return { data: null, error: membershipError };
      }

      const { error: transactionError } = await withCatch(async () => {
        return await ctx.db.$transaction(async (tx) => {
          const settlement = await tx.transaction.create({
            data: {
              groupId: input.groupId,
              amount: -input.amount,
              description: "Settlement",
              isSettlement: true,
              transactionDate: new Date(),
              payerId: input.payerId,
              createdById: ctx.userId,
            },
          });

          await tx.transactionDetail.create({
            data: {
              transactionId: settlement.id,
              recipientId: input.recipientId,
              groupId: input.groupId,
              amount: -input.amount,
            },
          });

          return settlement;
        });
      });

      if (transactionError !== null) {
        console.error(`[createSettlement] Failed in group ${input.groupId}:`, transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while recording the settlement.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(`[createSettlement] Recorded settlement in group ${input.groupId}`);
      return { data: "Settlement recorded successfully", error: null };
    }),

  updateTransaction: groupMemberProcedure
    .input(updateTransactionSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[updateTransaction] User ${ctx.userId} updating transaction ${input.transactionId} in group ${input.groupId}`,
      );

      const { data: existingTransaction, error: fetchError } = await withCatch(async () => {
        return await ctx.db.transaction.findFirst({
          where: { id: input.transactionId, groupId: input.groupId, deletedAt: null },
        });
      });

      if (fetchError !== null) {
        console.error(
          `[updateTransaction] Failed to fetch transaction ${input.transactionId}:`,
          fetchError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the transaction.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!existingTransaction) {
        console.warn(
          `[updateTransaction] Transaction ${input.transactionId} not found in group ${input.groupId}`,
        );
        return {
          data: null,
          error: { message: "Transaction not found.", code: "NOT_FOUND" },
        };
      }

      if (existingTransaction.isSettlement) {
        console.warn(`[updateTransaction] Cannot edit settlement ${input.transactionId}`);
        return {
          data: null,
          error: {
            message: "Settlements cannot be edited. Delete and recreate instead.",
            code: "BAD_REQUEST",
          },
        };
      }

      // Only the record creator or a group admin can edit
      const { error: permError } = canModifyRecord(
        ctx.userId,
        existingTransaction.createdById,
        ctx.isGroupAdmin,
      );
      if (permError) {
        return { data: null, error: permError };
      }

      const nonZeroDetails = input.transactionDetails.filter((d) => d.amount > 0);

      if (!verifyTransactionDetails(input.amount, nonZeroDetails, input.payerId)) {
        console.warn(
          `[updateTransaction] Invalid details for transaction ${input.transactionId}: amount=${input.amount}, splits=${nonZeroDetails.length}, payerId=${input.payerId}`,
        );
        return {
          data: null,
          error: {
            message:
              "Invalid transaction details. Please check that amounts add up correctly and no user is selected more than once.",
            code: "BAD_REQUEST",
          },
        };
      }

      // Verify all users are group members
      const allRecipientIds = nonZeroDetails.map((detail) => detail.recipientId);
      const allUserIds = [input.payerId, ...allRecipientIds];
      const { error: membershipError } = await verifyUsersAreGroupMembers(
        ctx,
        input.groupId,
        allUserIds,
      );
      if (membershipError !== null) {
        return { data: null, error: membershipError };
      }

      const { error: updateError } = await withCatch(async () => {
        return await ctx.db.$transaction(async (tx) => {
          await tx.transactionDetail.deleteMany({
            where: { transactionId: input.transactionId },
          });

          await tx.transaction.update({
            where: { id: input.transactionId },
            data: {
              amount: input.amount,
              description: input.description ?? null,
              category: input.category ?? null,
              receiptUrl: input.receiptUrl ?? null,
              transactionDate: input.transactionDate,
              payerId: input.payerId,
            },
          });

          await Promise.all(
            nonZeroDetails.map(async (detail) => {
              return await tx.transactionDetail.create({
                data: {
                  transactionId: input.transactionId,
                  recipientId: detail.recipientId,
                  groupId: input.groupId,
                  amount: detail.amount,
                },
              });
            }),
          );
        });
      });

      if (updateError !== null) {
        console.error(
          `[updateTransaction] Failed to update transaction ${input.transactionId}:`,
          updateError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while updating the transaction.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        `[updateTransaction] Updated transaction ${input.transactionId} in group ${input.groupId}`,
      );
      return { data: "Transaction updated successfully", error: null };
    }),

  deleteTransaction: groupMemberProcedure
    .input(deleteTransactionSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[deleteTransaction] User ${ctx.userId} deleting transaction ${input.transactionId} in group ${input.groupId}`,
      );
      const { data: transaction, error: fetchError } = await withCatch(async () => {
        return await ctx.db.transaction.findFirst({
          where: { id: input.transactionId, groupId: input.groupId, deletedAt: null },
        });
      });

      if (fetchError !== null) {
        console.error(
          `[deleteTransaction] Failed to fetch transaction ${input.transactionId}:`,
          fetchError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the transaction.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!transaction) {
        console.warn(
          `[deleteTransaction] Transaction ${input.transactionId} not found in group ${input.groupId}`,
        );
        return {
          data: null,
          error: { message: "Transaction not found.", code: "NOT_FOUND" },
        };
      }

      const { error: permError } = canModifyRecord(
        ctx.userId,
        transaction.createdById,
        ctx.isGroupAdmin,
      );
      if (permError) {
        return { data: null, error: permError };
      }

      const { error: deleteError } = await withCatch(async () => {
        return await ctx.db.transaction.update({
          where: { id: input.transactionId },
          data: { deletedAt: new Date() },
        });
      });

      if (deleteError !== null) {
        console.error(
          `[deleteTransaction] Failed to delete transaction ${input.transactionId}:`,
          deleteError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while deleting the transaction.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        `[deleteTransaction] Deleted transaction ${input.transactionId} in group ${input.groupId}`,
      );
      return { data: "Transaction deleted successfully", error: null };
    }),

  restoreTransaction: groupMemberProcedure
    .input(restoreTransactionSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      console.log(
        `[restoreTransaction] User ${ctx.userId} restoring transaction ${input.transactionId} in group ${input.groupId}`,
      );
      const { data: transaction, error: fetchError } = await withCatch(async () => {
        return await ctx.db.transaction.findFirst({
          where: { id: input.transactionId, groupId: input.groupId, deletedAt: { not: null } },
        });
      });

      if (fetchError !== null) {
        console.error(
          `[restoreTransaction] Failed to fetch transaction ${input.transactionId}:`,
          fetchError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while fetching the transaction.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      if (!transaction) {
        console.warn(
          `[restoreTransaction] No deleted transaction ${input.transactionId} found in group ${input.groupId}`,
        );
        return {
          data: null,
          error: { message: "No deleted transaction found to restore.", code: "NOT_FOUND" },
        };
      }

      const { error: permError } = canModifyRecord(
        ctx.userId,
        transaction.createdById,
        ctx.isGroupAdmin,
      );
      if (permError) {
        return { data: null, error: permError };
      }

      const { error: restoreError } = await withCatch(async () => {
        return await ctx.db.transaction.update({
          where: { id: input.transactionId },
          data: { deletedAt: null },
        });
      });

      if (restoreError !== null) {
        console.error(
          `[restoreTransaction] Failed to restore transaction ${input.transactionId}:`,
          restoreError,
        );
        return {
          data: null,
          error: {
            message: "An error occurred while restoring the transaction.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        `[restoreTransaction] Restored transaction ${input.transactionId} in group ${input.groupId}`,
      );
      return { data: "Transaction restored successfully", error: null };
    }),

  uploadReceipt: groupMemberProcedure
    .input(
      z.object({
        groupId: z.number().int().positive(),
        fileName: z.string().min(1).max(255),
        mimeType: z.enum(["image/jpeg", "image/png", "image/heic", "application/pdf"]),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<ApiResponse<UploadResult>> => {
      console.log(
        `[uploadReceipt] User ${ctx.userId} uploading receipt for group ${input.groupId}, file="${input.fileName}"`,
      );
      const { data: result, error: uploadError } = await withCatch(async () => {
        return await storageService.getUploadUrl(input.fileName, input.mimeType);
      });

      if (uploadError !== null) {
        console.error(
          `[uploadReceipt] Failed to get upload URL for group ${input.groupId}:`,
          uploadError,
        );
        return {
          data: null,
          error: { message: "Failed to prepare receipt upload.", code: "INTERNAL_SERVER_ERROR" },
        };
      }

      console.log(`[uploadReceipt] Generated upload URL for group ${input.groupId}`);
      return { data: result, error: null };
    }),

  getDetailedBalances: groupMemberProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<BalanceCalculationResult>> => {
      console.log(
        `[getDetailedBalances] User ${ctx.userId} fetching balances for group ${input.groupId}`,
      );

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
        console.error(`[getDetailedBalances] Failed for group ${input.groupId}:`, transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching transactions.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      const transformedTransactions = transactions.map((transaction) => ({
        payerId: transaction.payerId,
        amount: transaction.amount.toNumber(),
        transactionDetails: transaction.transactionDetails.map((detail) => ({
          recipientId: detail.recipientId,
          amount: detail.amount.toNumber(),
        })),
      }));

      const balanceData = calculateGroupBalances(transformedTransactions);

      console.log(
        `[getDetailedBalances] Calculated balances for group ${input.groupId}, ${Object.keys(balanceData.userBalances).length} users`,
      );
      return {
        data: balanceData,
        error: null,
      };
    }),

  getSimpleBalances: groupMemberProcedure
    .input(z.object({ groupId: z.number() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<Record<string, UserBalance>>> => {
      console.log(
        `[getSimpleBalances] User ${ctx.userId} fetching balances for group ${input.groupId}`,
      );

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
        console.error(`[getSimpleBalances] Failed for group ${input.groupId}:`, transactionError);
        return {
          data: null,
          error: {
            message: "An error occurred while fetching transactions.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      const transformedTransactions = transactions.map((transaction) => ({
        payerId: transaction.payerId,
        amount: transaction.amount.toNumber(),
        transactionDetails: transaction.transactionDetails.map((detail) => ({
          recipientId: detail.recipientId,
          amount: detail.amount.toNumber(),
        })),
      }));

      const balanceData = calculateGroupBalances(transformedTransactions);

      console.log(
        `[getSimpleBalances] Calculated balances for group ${input.groupId}, ${Object.keys(balanceData.userBalances).length} users`,
      );
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
  if (Math.abs(totalAmount - transactionAmount) > 0.01) {
    console.error("Total amount of transaction details does not match transaction amount");
    return false;
  }

  return true;
}

function canModifyRecord(
  userId: string | null,
  recordCreatedById: string,
  isGroupAdmin: boolean,
): ApiResponse<void> {
  if (isGroupAdmin || recordCreatedById === userId) {
    return { data: undefined, error: null };
  }
  return {
    data: null,
    error: {
      message: "Only the record creator or a group admin can perform this action.",
      code: "FORBIDDEN",
    },
  };
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
