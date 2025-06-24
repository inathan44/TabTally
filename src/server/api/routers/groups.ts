import type { Group, GroupMemberStatus } from "@prisma/client";
import { z } from "zod";
import { withCatch } from "~/lib/utils";
import { createGroupSlug } from "~/lib/slugify";

import { createTRPCRouter, protectedProcedure, type TRPCContext } from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import { createGroupSchema, deleteGroupSchema, inviteMemberSchema, type GetGroupResponse } from "~/server/contracts/groups";

export const groupRouter = createTRPCRouter({
  createGroup: protectedProcedure.input(createGroupSchema).mutation(async ({ ctx, input }): Promise<ApiResponse<Group>> => {
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

        console.log("Completed create group transaction:", updatedGroup.id);

        return updatedGroup;
      });
    });

    if (error !== null) {
      console.error("Error creating group:", error);
      return {
        data: null,
        error: {
          message: error.message || "An error occurred while creating the group. Please try again later.",
          code: "INTERNAL_SERVER_ERROR",
        },
      };
    }

    console.log("Group created successfully:", data.id, "with slug:", data.slug);

    return { data, error: null };
  }),

  getGroupBySlug: protectedProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }): Promise<ApiResponse<GetGroupResponse>> => {
    const { data: group, error: groupError } = await withCatch(async () => {
      return await ctx.db.group.findUnique({
        where: { slug: input.slug },
        include: {
          members: {
            where: { status: "JOINED" },
            include: {
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

    const { data: isMember, error: isMemberError } = await isUserInGroupByStatus(ctx, group.id, ctx.userId, "JOINED");
    if (isMemberError !== null) {
      console.error("error checking group membership:", isMemberError.message, isMemberError.code);
      return { data: null, error: isMemberError };
    }

    if (!isMember) {
      console.warn("User is not a member of the group:", ctx.userId);
      return { data: null, error: { message: "You are not a member of this group", code: "FORBIDDEN" } };
    }

    console.log("Group fetched successfully:", group.slug);

    const groupResponse: GetGroupResponse = {
      id: group.id,
      name: group.name,
      slug: group.slug,
      description: group.description,
      createdAt: group.createdAt,
      createdById: group.createdById,
      members: group.members.map((member) => member.member),
      transactions: group.transactions.map((transaction) => ({
        id: transaction.id,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        createdById: transaction.createdById,
        payerId: transaction.payerId,
        createdBy: transaction.createdBy,
        payer: transaction.payer,
        transactionDetails: transaction.transactionDetails.map((detail) => ({
          id: detail.id,
          recipientId: detail.recipientId,
          amount: detail.amount,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
          recipient: detail.recipient,
        })),
      })),
    };

    return { data: groupResponse, error: null };
  }),

  deleteGroup: protectedProcedure.input(deleteGroupSchema).mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
    // First, fetch and validate the group
    const { data: groupToDelete, error: fetchError } = await withCatch(async () => {
      return await ctx.db.group.findUnique({
        where: { id: input.groupId },
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
          message: "You are not authorized to delete this group. Only the creator can delete the group.",
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

  inviteUser: protectedProcedure.input(inviteMemberSchema).mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
    const { data: isMember, error: isMemberError } = await isUserInGroupByStatus(ctx, input.groupId, ctx.userId, "JOINED");
    if (isMemberError !== null) {
      console.error("Error checking group membership:", isMemberError);
      return { data: null, error: isMemberError };
    }

    if (!isMember) {
      console.warn("User is not a member of the group:", ctx.userId);
      return {
        data: null,
        error: {
          message: "You must be a member of the group to invite users",
          code: "FORBIDDEN",
        },
      };
    }

    const { data: isAlreadyJoined, error: isAlreadyJoinedError } = await isUserInGroupByStatus(ctx, input.groupId, input.inviteeUserId, "JOINED");

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

    const { data: isAlreadyInvited, error: isAlreadyInvitedError } = await isUserInGroupByStatus(ctx, input.groupId, input.inviteeUserId, "INVITED");

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
    console.log("Inviting user to group:", input.inviteeUserId, "by", ctx.userId);
    const { error: inviteUserError } = await withCatch(async () => {
      return await ctx.db.groupMember.create({
        data: {
          groupId: input.groupId,
          invitedById: ctx.userId,
          memberId: input.inviteeUserId,
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

  acceptInvite: protectedProcedure.input(z.object({ groupMemberId: z.number() })).mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
    const { data: existingInvite, error: existingInviteError } = await withCatch(async () => {
      return await ctx.db.groupMember.findUnique({
        where: { id: input.groupMemberId },
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
    console.log("accepting invite for group member:", existingInvite.id, "for group:", existingInvite.groupId);

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

    console.log("Group invite accepted successfully:", existingInvite.groupId, "by user:", ctx.userId);

    return { data: "Invite accepted successfully", error: null };
  }),
});

async function isUserInGroupByStatus(ctx: TRPCContext, groupId: number, userId: string, status: GroupMemberStatus): Promise<ApiResponse<boolean>> {
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

  if (!isMember) {
    console.warn("User is not a member of the group:", ctx.userId);
    return {
      data: null,
      error: {
        message: "You are not a member of this group",
        code: "FORBIDDEN",
      },
    };
  }

  return {
    data: true,
    error: null,
  };
}
