"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft, Users, Receipt, Clock, Settings } from "lucide-react";
import Link from "next/link";
import { useGroupPermissions } from "~/hooks/use-group-permissions";
import ConfettiEffect from "~/components/ConfettiEffect";
import TransactionsTab from "~/components/group-transactions-tab";
import MembersTab from "~/components/group-members-tab";
import BalancesTab from "~/components/group-balances-tab";
import { GroupBadge } from "~/components/group-badges";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

interface GroupInfoProps {
  groupSlug: string;
}

const VALID_TABS = ["transactions", "balances", "members"] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function GroupInfo({ groupSlug }: GroupInfoProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const activeTab: TabValue = VALID_TABS.includes(tabParam as TabValue)
    ? (tabParam as TabValue)
    : "transactions";

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "transactions") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setShowConfetti(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router, pathname]);

  const {
    data: groupResponse,
    error: apiError,
    isPending,
    isFetching,
  } = api.group.getGroupBySlug.useQuery({ slug: groupSlug });

  const group = groupResponse?.data;
  const { isGroupAdmin, currentMember } = useGroupPermissions(group);

  if (isPending) {
    return (
      <div className="overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="space-y-6">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (apiError || groupResponse?.error) {
    const message = apiError?.message ?? groupResponse?.error?.message ?? "Failed to load group";
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="border-destructive/20 bg-destructive/5 rounded-xl border p-8 text-center">
          <p className="text-destructive text-sm font-medium">Error loading group</p>
          <p className="text-muted-foreground mt-1 text-xs">{message}</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="border-destructive/20 bg-destructive/5 rounded-xl border p-8 text-center">
          <p className="text-destructive text-sm font-medium">Error loading group</p>
          <p className="text-muted-foreground mt-1 text-xs">Group data is unavailable.</p>
        </div>
      </div>
    );
  }

  const totalSpending =
    group.transactions
      ?.filter((t) => !t.isSettlement)
      .reduce((sum, t) => sum + Math.abs(t.amount.cents), 0) ?? 0;
  const joinedCount = group.members.filter((m) => m.status === "JOINED").length;
  const invitedCount = group.members.filter((m) => m.status === "INVITED").length;
  const transactionCount = group.transactions?.length ?? 0;

  return (
    <div className="overflow-x-hidden">
      <ConfettiEffect trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Back link */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground mb-6 -ml-3 h-8 gap-1.5 text-xs"
        >
          <Link href="/groups">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to groups
          </Link>
        </Button>

        {/* Group header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 rounded-xl">
              <AvatarFallback className="bg-primary/10 text-primary rounded-xl text-sm font-semibold">
                {group.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-foreground text-lg font-semibold tracking-tight">{group.name}</h1>
              {group.description && (
                <p className="text-muted-foreground mt-0.5 text-sm">{group.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <GroupBadge
                  icon={Users}
                  label={`${joinedCount} member${joinedCount !== 1 ? "s" : ""}`}
                />
                {invitedCount > 0 && (
                  <GroupBadge
                    icon={Clock}
                    label={`${invitedCount} invited`}
                    variant="outline"
                    className="text-muted-foreground"
                  />
                )}
                {transactionCount > 0 && (
                  <GroupBadge
                    icon={Receipt}
                    label={`${transactionCount} transaction${transactionCount !== 1 ? "s" : ""}`}
                  />
                )}
              </div>
            </div>
          </div>
          {isGroupAdmin && (
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
              <Link href={`/groups/${groupSlug}/settings`}>
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        <Separator className="my-8" />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-muted/50 h-9 w-full justify-start rounded-lg p-0.5">
            <TabsTrigger
              value="transactions"
              className="h-8 rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm"
            >
              Transactions
            </TabsTrigger>
            <TabsTrigger
              value="balances"
              className="h-8 rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm"
            >
              Balances
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="h-8 rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm"
            >
              Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-6">
            <TransactionsTab
              group={group}
              totalSpending={totalSpending}
              isGroupAdmin={isGroupAdmin}
              userId={currentMember?.id}
            />
          </TabsContent>

          <TabsContent value="balances" className="mt-6">
            <BalancesTab group={group} isFetching={isFetching} />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <MembersTab group={group} joinedCount={joinedCount} isGroupAdmin={isGroupAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
