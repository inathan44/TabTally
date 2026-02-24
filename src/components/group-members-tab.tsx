"use client";

import { Clock, Star, Users } from "lucide-react";
import InviteMemberModal from "~/components/invite-member-modal";
import UninviteMemberDialog from "~/components/uninvite-member-dialog";
import { GroupBadge } from "~/components/group-badges";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { GetGroupResponse } from "~/server/contracts/groups";
import { cn } from "~/lib/utils";

interface MembersTabProps {
  group: GetGroupResponse;
  joinedCount: number;
  isGroupAdmin: boolean;
}

export default function MembersTab({ group, joinedCount, isGroupAdmin }: MembersTabProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-medium">
          {joinedCount} member{joinedCount !== 1 ? "s" : ""}
        </h3>
        <InviteMemberModal groupId={group.id} existingMembers={group.members} canAssignRoles={isGroupAdmin} />
      </div>

      {group.members.length > 0 ? (
        <div className="space-y-1">
          {group.members
            .sort((a, b) => {
              if (a.status === b.status) return 0;
              return a.status === "JOINED" ? -1 : 1;
            })
            .map((member) => (
              <div
                key={member.id}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/40",
                  member.status === "INVITED" && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-medium",
                        {
                          "bg-muted text-muted-foreground": member.status === "INVITED",
                          "bg-primary/8 text-primary": member.status !== "INVITED",
                        },
                      )}
                    >
                      {member.firstName.charAt(0)}
                      {member.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {member.firstName} {member.lastName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {member.status === "INVITED"
                        ? "Pending invite"
                        : `Joined ${new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.status === "INVITED" && (
                    <GroupBadge
                      icon={Clock}
                      label="Invited"
                      variant="outline"
                      className="border-border text-muted-foreground text-[11px]"
                    />
                  )}
                  {member.status === "INVITED" && isGroupAdmin && (
                    <UninviteMemberDialog
                      groupId={group.id}
                      memberId={member.id}
                      memberName={`${member.firstName} ${member.lastName}`}
                    />
                  )}
                  {member.isAdmin && member.status === "JOINED" && (
                    <GroupBadge
                      icon={Star}
                      label={group.createdById === member.id ? "Creator" : "Admin"}
                      variant="outline"
                      className="border-warning/30 text-warning text-[11px] [&_svg]:fill-current"
                    />
                  )}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="border-border rounded-xl border-2 border-dashed px-6 py-12 text-center">
          <Users className="text-muted-foreground/40 mx-auto h-8 w-8" />
          <p className="text-foreground mt-3 text-sm font-medium">No members</p>
        </div>
      )}
    </div>
  );
}
