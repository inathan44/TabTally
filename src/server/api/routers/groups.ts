import type { Group } from "@prisma/client";
import { z } from "zod";
import { withCatch } from "~/lib/utils";
import { createGroupSlug } from "~/lib/slugify";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import {
  createGroupSchema,
  deleteGroupSchema,
} from "~/server/contracts/groups";

export const groupRouter = createTRPCRouter({
  createGroup: protectedProcedure
    .input(createGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<Group>> => {
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

          console.log(
            "New group created with temporary slug:",
            newGroup.id,
            temporarySlug,
          );

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
            message:
              error.message ||
              "An error occurred while creating the group. Please try again later.",
            code: "INTERNAL_SERVER_ERROR",
          },
        };
      }

      console.log(
        "Group created successfully:",
        data.id,
        "with slug:",
        data.slug,
      );

      return { data, error: null };
    }),

  getGroupBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }): Promise<ApiResponse<Group>> => {
      const { data: group, error: groupError } = await withCatch(async () => {
        return await ctx.db.group.findUnique({
          where: { slug: input.slug },
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

      const { data: isMember, error: isMemberError } = await withCatch(
        async () => {
          return await ctx.db.groupMember.findFirst({
            where: {
              groupId: group.id,
              memberId: ctx.userId,
            },
          });
        },
      );

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

      console.log("Group fetched successfully:", group.slug);

      return { data: group, error: null };
    }),

  deleteGroup: protectedProcedure
    .input(deleteGroupSchema)
    .mutation(async ({ ctx, input }): Promise<ApiResponse<string>> => {
      // First, fetch and validate the group
      const { data: groupToDelete, error: fetchError } = await withCatch(
        async () => {
          return await ctx.db.group.findUnique({
            where: { id: input.groupId },
          });
        },
      );

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
});
