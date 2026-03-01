"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useGroupPermissions } from "~/hooks/use-group-permissions";
import GeneralSettings from "~/components/settings/general-settings";
import MemberRoleSettings from "~/components/settings/member-role-settings";
import DangerZoneSettings from "~/components/settings/danger-zone-settings";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

interface GroupSettingsProps {
  groupSlug: string;
}

export default function GroupSettings({ groupSlug }: GroupSettingsProps) {
  const {
    data: groupResponse,
    error: apiError,
    isPending,
  } = api.group.getGroupBySlug.useQuery({ slug: groupSlug });

  const group = groupResponse?.data;
  const { isGroupAdmin } = useGroupPermissions(group);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="animate-pulse space-y-6">
          <div className="bg-muted h-5 w-32 rounded" />
          <div className="bg-muted h-6 w-48 rounded" />
          <div className="bg-muted h-40 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (apiError || groupResponse?.error || !group) {
    const message = apiError?.message ?? groupResponse?.error?.message ?? "Failed to load group";
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Error loading group</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  if (!isGroupAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Access denied</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only group admins can access settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="mb-6 -ml-3 h-8 gap-1.5 text-xs text-muted-foreground"
      >
        <Link href={`/groups/${groupSlug}`}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to group
        </Link>
      </Button>

      <h1 className="text-lg font-semibold tracking-tight text-foreground">Group Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage settings for {group.name}
      </p>

      <Separator className="my-8" />

      <div className="space-y-10">
        <GeneralSettings group={group} />

        <Separator />

        <MemberRoleSettings group={group} />

        <Separator />

        <DangerZoneSettings group={group} groupSlug={groupSlug} />
      </div>
    </div>
  );
}
