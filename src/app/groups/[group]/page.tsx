import { api, HydrateClient } from "~/trpc/server";
import GroupInfo from "./GroupInfo";

interface GroupPageProps {
  params: Promise<{
    group: string;
  }>;
}

export default async function page({ params }: GroupPageProps) {
  const { group: groupSlug } = await params;

  void api.group.getGroupBySlug.prefetch({
    slug: groupSlug,
  });

  return (
    <HydrateClient>
      <div>
        <GroupInfo groupSlug={groupSlug} />
      </div>
    </HydrateClient>
  );
}
