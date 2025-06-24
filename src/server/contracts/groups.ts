import type { Group } from "@prisma/client";
import { z } from "zod";
import type { SafeUser } from "./users";
import type { SafeTransaction } from "./transactions";

const groupName = z.string().min(1).max(100);
const groupDescription = z.string().max(500).optional();
const groupId = z.number().int().positive();

export const createGroupSchema = z.object({
  name: groupName,
  description: groupDescription,
});

export const deleteGroupSchema = z.object({
  groupId: groupId,
  hard: z.boolean().default(false).optional(),
});

export const inviteMemberSchema = z.object({
  groupId: groupId,
  inviteeUserId: z.string(),
});

type SafeGroup = Pick<Group, "id" | "name" | "slug" | "createdAt" | "createdById" | "description">;

export type GetGroupResponse = SafeGroup & {
  members: SafeUser[];
  transactions: SafeTransaction[];
};
