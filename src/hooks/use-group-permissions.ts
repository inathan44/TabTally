import { useAuth } from "@clerk/nextjs";
import type { GetGroupResponse } from "~/server/contracts/groups";

export function useGroupPermissions(group: GetGroupResponse | null | undefined) {
  const { userId } = useAuth();

  if (!group) {
    return {
      currentMember: undefined,
      isCreator: false,
      isAdmin: false,
      isGroupAdmin: false,
    };
  }

  const currentMember = group.members.find((m) => m.id === userId);
  const isCreator = group.createdById === userId;
  const isAdmin = currentMember?.isAdmin === true;
  const isGroupAdmin = isAdmin || isCreator;

  return {
    currentMember,
    isCreator,
    isAdmin,
    isGroupAdmin,
  };
}
