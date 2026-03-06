import { Suspense } from "react";
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
        <Suspense>
          <GroupInfo groupSlug={groupSlug} />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
