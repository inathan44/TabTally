import { z } from "zod";
import { withCatch } from "~/lib/utils";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { ApiResponse } from "~/server/contracts/apiResponse";
import type { SafeUser } from "~/server/contracts/users";

export const userRouter = createTRPCRouter({
  getUserById: protectedProcedure
    .input(z.string())
    .query(async ({ ctx, input }): Promise<ApiResponse<SafeUser>> => {
      const { data: user, error } = await withCatch(
        async () =>
          await ctx.db.user.findUnique({
            where: { id: input },
          }),
      );

      if (error !== null) {
        return {
          data: null,
          error: {
            message:
              error.message ||
              "An error occurred while getting user information. Please try again later.",
            code: "INTERNAL_SERVER_ERROR",
            status: 500,
          },
        };
      }

      if (!user) {
        return {
          data: null,
          error: {
            message: "User not found",
            code: "NOT_FOUND",
            status: 404,
          },
        };
      }

      const safeUser: SafeUser = {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
      };

      return { data: safeUser, error: null };
    }),
});
