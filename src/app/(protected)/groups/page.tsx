import CreateGroupModal from "~/components/create-group-modal";
import { GroupList } from "~/components/GroupList";
import { api, HydrateClient } from "~/trpc/server";

export default async function GroupsPage() {
  await api.user.getGroups.prefetch();
  await api.user.getPendingInvites.prefetch();

  return (
    <HydrateClient>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Groups</h1>
            <p className="text-sm text-muted-foreground">Manage your shared expense groups.</p>
          </div>
          <CreateGroupModal />
        </div>
        <div className="mt-8">
          <GroupList />
        </div>
      </div>
    </HydrateClient>
  );
}
