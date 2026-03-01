"use client";

import { api } from "~/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export default function UsernameDisplay() {
  const { data: profileResult, isPending } = api.user.getProfile.useQuery();
  const profile = profileResult?.data;

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          <div className="bg-muted mt-1 h-4 w-48 animate-pulse rounded" />
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Username</CardTitle>
        <CardDescription>This is how other users find and identify you.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-foreground text-sm font-medium">
          {profile?.username ? `@${profile.username}` : "No username set"}
        </p>
      </CardContent>
    </Card>
  );
}
