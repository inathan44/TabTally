"use client";

import { Check, X, Users } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import type { PendingInvite } from "~/server/contracts/users";

interface InvitationCardProps {
  invite: PendingInvite;
}

export default function InvitationCard({ invite }: InvitationCardProps) {
  const utils = api.useUtils();

  const acceptMutation = api.group.acceptInvite.useMutation({
    onSuccess: () => {
      void utils.user.getPendingInvites.invalidate();
      void utils.user.getGroups.invalidate();
    },
  });

  const declineMutation = api.group.declineInvite.useMutation({
    onSuccess: () => {
      void utils.user.getPendingInvites.invalidate();
    },
  });

  const isLoading = acceptMutation.isPending || declineMutation.isPending;

  const inviterName = [invite.invitedBy?.firstName, invite.invitedBy?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "border-border bg-card flex items-center justify-between rounded-xl border px-4 py-3.5",
        { "pointer-events-none opacity-50": isLoading },
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 rounded-lg">
          <AvatarFallback className="bg-primary/8 text-primary rounded-lg text-xs font-semibold">
            {invite.groupName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-foreground text-sm font-medium">{invite.groupName}</p>
          <p className="text-muted-foreground text-xs">
            {inviterName ? `Invited by ${inviterName}` : "Pending invitation"}
            <span className="mx-1">·</span>
            <Users className="mb-0.5 inline h-3 w-3" /> {invite.memberCount}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 h-8 w-8"
          onClick={() => declineMutation.mutate({ groupMemberId: invite.id })}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-success hover:bg-success/10 h-8 w-8"
          onClick={() => acceptMutation.mutate({ groupMemberId: invite.id })}
          disabled={isLoading}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
