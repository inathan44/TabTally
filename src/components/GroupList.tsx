"use client";

import { GroupCard } from "./GroupCard";
import { api } from "~/trpc/react";
import { useAuth } from "@clerk/nextjs";

interface GroupListProps {
  className?: string;
}

export function GroupList({ className }: GroupListProps) {
  const { userId } = useAuth();
  const { data: result, isPending, error } = api.user.getGroups.useQuery();

  if (isPending) {
    return (
      <div className={`space-y-4 md:space-y-6 ${className}`}>
        <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase md:text-base">Your Groups</h2>
        <div className="space-y-3 md:space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex animate-pulse items-center justify-between rounded-lg bg-gray-100 p-4 md:p-6">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="h-12 w-12 rounded-full bg-gray-200 md:h-14 md:w-14"></div>
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-gray-200"></div>
                  <div className="h-3 w-24 rounded bg-gray-200"></div>
                </div>
              </div>
              <div className="h-5 w-5 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 md:space-y-6 ${className}`}>
        <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase md:text-base">Your Groups</h2>
        <div className="py-8 text-center text-red-500 md:py-12">
          <p className="md:text-lg">Error loading groups</p>
          <p className="text-sm md:text-base">{error.message}</p>
        </div>
      </div>
    );
  }

  if (result?.error) {
    return (
      <div className={`space-y-4 md:space-y-6 ${className}`}>
        <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase md:text-base">Your Groups</h2>
        <div className="py-8 text-center text-red-500 md:py-12">
          <p className="md:text-lg">Error loading groups</p>
          <p className="text-sm md:text-base">{result.error.message}</p>
        </div>
      </div>
    );
  }

  const groups = result?.data;

  if (!groups || groups.length === 0) {
    return (
      <div className={`space-y-4 md:space-y-6 ${className}`}>
        <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase md:text-base">Your Groups</h2>
        <div className="py-8 text-center text-gray-500 md:py-12">
          <p className="md:text-lg">No groups yet</p>
          <p className="text-sm md:text-base">Create or join your first group to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 md:space-y-6 ${className}`}>
      <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase md:text-base">Your Groups</h2>
      <div className="space-y-3 md:space-y-4">
        {groups.map((group) => (
          <GroupCard
            key={group.id}
            id={group.id.toString()}
            name={group.name}
            slug={group.slug}
            balance={100} // TODO: Calculate balance from transactions
            balanceType="receive" // TODO: Determine from balance calculation
            isOwner={group.createdById == userId} // TODO: Get from group membership data
          />
        ))}
      </div>
    </div>
  );
}
