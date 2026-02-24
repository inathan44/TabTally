"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Star, ArrowLeft, Users, Receipt, DollarSign } from "lucide-react";
import Link from "next/link";
import ConfettiEffect from "~/components/ConfettiEffect";
import CreateTransactionModal from "~/components/create-transaction-modal";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

interface GroupInfoProps {
  groupSlug: string;
}

export default function GroupInfo({ groupSlug }: GroupInfoProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = api.useUtils();

  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setShowConfetti(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("new");
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  const {
    data: groupResponse,
    error: apiError,
    isPending,
  } = api.group.getGroupBySlug.useQuery({ slug: groupSlug });

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="animate-pulse space-y-6">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="h-4 w-72 rounded bg-muted" />
          </div>
          <div className="h-10 w-full rounded bg-muted" />
          <div className="grid gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (apiError || groupResponse?.error) {
    const message = apiError?.message ?? groupResponse?.error?.message ?? "Failed to load group";
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-medium text-destructive">Error loading group</p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  const group = groupResponse.data;
  const totalSpending = group.transactions?.reduce((sum, t) => sum + Number(t.amount), 0) ?? 0;

  return (
    <div className="overflow-x-hidden">
      <ConfettiEffect trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {/* Back link */}
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3 h-8 gap-1.5 text-xs text-muted-foreground">
          <Link href="/groups">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to groups
          </Link>
        </Button>

        {/* Group header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12 rounded-xl">
              <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                {group.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{group.name}</h1>
              {group.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{group.description}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-xs font-normal">
                  <Users className="h-3 w-3" />
                  {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                </Badge>
                {group.transactions && group.transactions.length > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs font-normal">
                    <Receipt className="h-3 w-3" />
                    {group.transactions.length} transaction{group.transactions.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="h-9 w-full justify-start rounded-lg bg-muted/50 p-0.5">
            <TabsTrigger value="transactions" className="h-8 rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm">
              Transactions
            </TabsTrigger>
            <TabsTrigger value="members" className="h-8 rounded-md px-4 text-xs font-medium data-[state=active]:shadow-sm">
              Members
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="mt-6">
            <div className="mb-5 flex items-center justify-between">
              {totalSpending > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/8">
                    <DollarSign className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total spent</p>
                    <p className="text-sm font-semibold text-foreground">${totalSpending.toFixed(2)}</p>
                  </div>
                </div>
              )}
              <CreateTransactionModal
                groupId={group.id}
                groupMembers={group.members}
                onSuccess={() => {
                  void utils.group.getGroupBySlug.invalidate({ slug: groupSlug });
                }}
              />
            </div>

            {group.transactions && group.transactions.length > 0 ? (
              <div className="space-y-2">
                {group.transactions
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((transaction) => (
                    <Card key={transaction.id} className="gap-0 py-0 transition-colors hover:bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/8 text-[11px] font-medium text-primary">
                                {transaction.payer.firstName.charAt(0)}
                                {transaction.payer.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {transaction.description || "Untitled expense"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {transaction.payer.firstName} paid · {new Date(transaction.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-foreground">
                            ${Number(transaction.amount).toFixed(2)}
                          </span>
                        </div>

                        {transaction.transactionDetails?.length > 0 && (
                          <div className="ml-11 mt-3 space-y-1.5 border-t border-border pt-3">
                            {transaction.transactionDetails.map((detail) => (
                              <div key={detail.id} className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {detail.recipient.firstName} {detail.recipient.lastName}
                                </span>
                                <span className="text-xs font-medium text-foreground">
                                  ${Number(detail.amount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
                <Receipt className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium text-foreground">No transactions yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add your first expense to get started.
                </p>
              </div>
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-6">
            {group.members.length > 0 ? (
              <div className="space-y-1">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/8 text-xs font-medium text-primary">
                          {member.firstName.charAt(0)}
                          {member.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(member.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    {member.isAdmin && (
                      <Badge variant="outline" className="gap-1 border-warning/30 text-[11px] font-normal text-warning">
                        <Star className="h-3 w-3 fill-current" />
                        {group.createdById === member.id ? "Creator" : "Admin"}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-border px-6 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium text-foreground">No members</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
