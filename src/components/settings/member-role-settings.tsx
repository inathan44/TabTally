"use client";

import { toast } from "sonner";
import { Shield, ShieldOff } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import type { GetGroupResponse } from "~/server/contracts/groups";

interface MemberRoleSettingsProps {
  group: GetGroupResponse;
}

export default function MemberRoleSettings({ group }: MemberRoleSettingsProps) {
  const { userId } = useAuth();
  const utils = api.useUtils();
  const updateRoleMutation = api.group.updateMemberRole.useMutation();

  const joinedMembers = group.members.filter((m) => m.status === "JOINED");

  const handleRoleChange = async (memberId: string, isAdmin: boolean) => {
    try {
      const result = await updateRoleMutation.mutateAsync({
        groupId: group.id,
        memberId,
        isAdmin,
      });

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      void utils.group.getGroupBySlug.invalidate();
      toast.success(result.data);
    } catch {
      toast.error("Failed to update member role.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Manage member roles. Admins can edit settings, manage members, and modify all transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {joinedMembers.map((member) => {
            const isCurrentUser = member.id === userId;
            const isOwner = member.id === group.createdById;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/8 text-primary text-[11px] font-medium">
                      {member.firstName.charAt(0)}
                      {member.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.firstName} {member.lastName}
                      {isCurrentUser && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <Badge
                      variant={isOwner ? "default" : member.isAdmin ? "default" : "secondary"}
                      className="mt-0.5 text-[10px] px-1.5 py-0"
                    >
                      {isOwner ? "Owner" : member.isAdmin ? "Admin" : "Member"}
                    </Badge>
                  </div>
                </div>

                {!isCurrentUser && !isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={updateRoleMutation.isPending}
                    onClick={() => handleRoleChange(member.id, !member.isAdmin)}
                  >
                    {member.isAdmin ? (
                      <>
                        <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
                        Demote
                      </>
                    ) : (
                      <>
                        <Shield className="mr-1.5 h-3.5 w-3.5" />
                        Make Admin
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
