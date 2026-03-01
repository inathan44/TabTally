import { api, HydrateClient } from "~/trpc/server";
import GroupSettings from "./group-settings";

interface SettingsPageProps {
  params: Promise<{
    group: string;
  }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { group: groupSlug } = await params;

  void api.group.getGroupBySlug.prefetch({
    slug: groupSlug,
  });

  return (
    <HydrateClient>
      <GroupSettings groupSlug={groupSlug} />
    </HydrateClient>
  );
}
