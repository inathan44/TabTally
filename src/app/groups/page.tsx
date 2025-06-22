import { UserProfile } from "~/components/UserProfile";
import { GroupList } from "~/components/GroupList";
import { api, HydrateClient } from "~/trpc/server";

export default async function GroupsPage() {
  // Prefetch the groups data on the server
  await api.user.getGroups.prefetch();

  return (
    <HydrateClient>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl">
          {/* Groups Section */}
          <div className="p-4 md:p-8">
            <GroupList />
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
