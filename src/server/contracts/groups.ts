import type { Group } from "@prisma/client";
import { z } from "zod";
import type { SafeUser } from "./users";
import type { SafeTransaction } from "./transactions";
import { createTransactionDetailSchema } from "./transactionDetail";

const groupName = z.string().min(1).max(100);
const groupDescription = z.string().max(255).optional();
const groupId = z.number().int().positive();

export const invitedUserSchema = z.object({
  userId: z.string(),
  role: z.enum(["user", "admin"]),
});

export const createGroupSchema = z.object({
  name: groupName,
  description: groupDescription,
  invitedUsers: z.array(invitedUserSchema).optional(),
});

export const deleteGroupSchema = z.object({
  groupId: groupId,
  hard: z.boolean().default(false).optional(),
});

export const inviteMemberSchema = z.object({
  groupId: groupId,
  inviteeUserId: z.string(),
});

export const createTransactionSchema = z.object({
  groupId: groupId,
  amount: z.number(),
  payerId: z.string(),
  description: z.string().max(255).optional(),
  transactionDate: z.coerce.date().default(() => new Date()), // Coerce and default to current date
  transactionDetails: z
    .array(createTransactionDetailSchema)
    .min(1, "At least one transaction detail is required"),
});

// Client-side form schema for the transaction creation modal
export const createTransactionFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Amount must be a valid number greater than 0" },
    ),
  description: z.string().max(255, "Description must be 255 characters or less").optional(),
  payerId: z.string().min(1, "Please select who paid"),
  transactionDate: z.coerce.date().default(() => new Date()),
  splits: z
    .array(
      z.object({
        recipientId: z.string().min(1, "Recipient is required"),
        amount: z
          .string()
          .min(1, "Amount is required")
          .refine(
            (val) => {
              const num = parseFloat(val);
              return !isNaN(num) && num > 0;
            },
            { message: "Amount must be a valid number greater than 0" },
          ),
      }),
    )
    .min(1, "At least one split is required"),
});

type SafeGroup = Pick<Group, "id" | "name" | "slug" | "createdAt" | "createdById" | "description">;

export type GroupMember = SafeUser & {
  isAdmin: boolean;
};

export type GetGroupResponse = SafeGroup & {
  members: GroupMember[];
  transactions: SafeTransaction[];
};

// Form schema that includes full user objects for UI display
export const createGroupFormSchema = z.object({
  name: groupName,
  description: groupDescription.optional(),
  invitedUsers: z
    .array(
      z.object({
        user: z.object({
          id: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
        }),
        role: z.enum(["user", "admin"]),
      }),
    )
    .optional(),
});

export type CreateGroupForm = z.infer<typeof createGroupFormSchema>;
export type InvitedUser = z.infer<typeof invitedUserSchema>;
export type InvitedUserWithDetails = {
  user: SafeUser & { email?: string };
  role: "user" | "admin";
};
