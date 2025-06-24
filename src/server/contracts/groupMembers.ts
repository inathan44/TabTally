import type { GroupMember } from "@prisma/client";
import type { SafeUser } from "./users";

export type SafeGroupMember = Pick<
  GroupMember,
  "id" | "isAdmin" | "status" | "invitedById" | "createdAt" | "memberId"
> & {
  member: SafeUser;
  invitedBy: SafeUser;
};
