import type { User } from "@prisma/client";
import { z } from "zod";

export type SafeUser = Pick<User, "id" | "firstName" | "lastName" | "createdAt">;

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

export const createUserSchema = z.object({
  id,
  firstName,
  lastName,
  email,
});
