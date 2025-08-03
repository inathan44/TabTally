import CreateGroupModal from "~/components/create-group-modal";
import { GroupList } from "~/components/GroupList";
import { api, HydrateClient } from "~/trpc/server";

export default async function GroupsPage() {
  // Prefetch the groups data on the server
  await api.user.getGroups.prefetch();

  return (
    <HydrateClient>
      <div className="mx-auto max-w-4xl">
        <CreateGroupModal />
        {/* Groups Section */}
        <div className="p-4 md:p-8">
          <GroupList />
        </div>
      </div>
    </HydrateClient>
  );
}
