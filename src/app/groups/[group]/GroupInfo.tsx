"use client";

import { api } from "~/trpc/react";

interface GroupInfoProps {
  groupSlug: string;
}

export default function GroupInfo({ groupSlug }: GroupInfoProps) {
  const {
    data: groupResponse,
    error: apiError,
    isPending,
  } = api.group.getGroupBySlug.useQuery({
    slug: groupSlug,
  });

  if (isPending) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          <div className="animate-pulse">
            <div className="mb-4 h-8 w-1/3 rounded bg-gray-200"></div>
            <div className="mb-2 h-4 w-2/3 rounded bg-gray-200"></div>
            <div className="h-4 w-1/2 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    );
  }

  if (apiError) {
    console.error("API Error:", apiError);
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          <h2 className="text-xl font-semibold text-red-600">
            Error loading group
          </h2>
          <p className="mt-2 text-gray-600">Failed to fetch group data</p>
        </div>
      </div>
    );
  }

  if (groupResponse?.error) {
    console.error("Error fetching group:", groupResponse.error);
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl p-4 md:p-8">
          <h2 className="text-xl font-semibold text-red-600">
            Error loading group
          </h2>
          <p className="mt-2 text-gray-600">{groupResponse.error.message}</p>
        </div>
      </div>
    );
  }

  const group = groupResponse.data;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{group.name}</h1>
        {group.description && (
          <p className="mb-6 text-gray-600">{group.description}</p>
        )}
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Group ID: {group.id}</p>
          <p className="text-sm text-gray-500">Slug: {group.slug}</p>
        </div>
      </div>
    </div>
  );
}
