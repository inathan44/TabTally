"use client";

import { GroupCard } from "./GroupCard";
import InvitationCard from "./invitation-card";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";
import { cn } from "~/lib/utils";

interface GroupListProps {
  className?: string;
}

export function GroupList({ className }: GroupListProps) {
  const { userId } = useAuth();
  const { data: result, isPending, error } = api.user.getGroups.useQuery();
  const { data: invitesResult } = api.user.getPendingInvites.useQuery();

  if (isPending) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center", className)}>
        <p className="font-medium text-destructive">Error loading groups</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className={cn("rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center", className)}>
        <p className="font-medium text-destructive">Error loading groups</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.error.message}</p>
      </div>
    );
  }

  const groups = result?.data;
  const invites = invitesResult?.data ?? [];

  if ((!groups || groups.length === 0) && invites.length === 0) {
    return (
      <div className={cn("rounded-lg border-2 border-dashed border-border p-8 text-center", className)}>
        <p className="font-medium text-foreground">No groups yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first group to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Pending Invitations ({invites.length})
          </h2>
          {invites.map((invite) => (
            <InvitationCard key={invite.id} invite={invite} />
          ))}
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="space-y-3">
          {invites.length > 0 && (
            <h2 className="text-sm font-medium text-muted-foreground">Your Groups</h2>
          )}
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              id={group.id.toString()}
              name={group.name}
              slug={group.slug}
              balance={group.userBalance?.amount.cents ?? 0}
              balanceType={group.userBalance?.type ?? "receive"}
              isOwner={group.createdById == userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
