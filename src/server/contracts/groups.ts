import { z } from "zod";

const groupName = z.string().min(1).max(100);
const groupDescription = z.string().max(500).optional();

export const createGroupSchema = z.object({
  name: groupName,
  description: groupDescription,
});

export const deleteGroupSchema = z.object({
  groupId: z.number(),
  hard: z.boolean().default(false).optional(),
});
