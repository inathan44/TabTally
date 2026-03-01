import type { User } from "@prisma/client";
import { z } from "zod";

export type SafeUser = Pick<User, "id" | "username" | "firstName" | "lastName" | "createdAt">;

export type UserProfile = Pick<
  User,
  | "id"
  | "username"
  | "firstName"
  | "lastName"
  | "email"
  | "venmoUsername"
  | "cashappUsername"
  | "createdAt"
>;

export type GetUserGroupsResponse = {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
  createdById: string;
  groupUsers: SafeUser[];
  userBalance?: {
    amount: number;
    type: "receive" | "pay";
  };
};

export type PendingInvite = {
  id: number;
  groupId: number;
  groupName: string;
  groupSlug: string;
  invitedBy: SafeUser;
  memberCount: number;
  createdAt: Date;
};

const firstName = z.string().min(1).max(50);
const lastName = z.string().min(1).max(50);
const email = z.string().email().max(100);
const id = z.string().min(1);

const paymentUsername = z.string().max(50).optional();

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const usernameSchema = z
  .string()
  .min(USERNAME_MIN_LENGTH, `Username must be at least ${USERNAME_MIN_LENGTH} characters`)
  .max(USERNAME_MAX_LENGTH, `Username must be at most ${USERNAME_MAX_LENGTH} characters`)
  .regex(USERNAME_REGEX, "Username can only contain letters, numbers, and underscores")
  .transform((val) => val.toLowerCase());

export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  venmoUsername: paymentUsername,
  cashappUsername: paymentUsername,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const setupProfileSchema = updateProfileSchema.extend({
  username: usernameSchema,
});
export type SetupProfileInput = z.infer<typeof setupProfileSchema>;

export const checkUsernameSchema = z.object({
  username: usernameSchema,
});

export const searchUsersSchema = z.object({
  query: z.string().min(1).max(50),
});

export const createUserSchema = z.object({
  id,
  firstName,
  lastName,
  email,
});
