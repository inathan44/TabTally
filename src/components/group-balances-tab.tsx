"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import SettleUpModal from "~/components/settle-up-modal";
import type { GetGroupResponse, GroupMember } from "~/server/contracts/groups";
import { cn } from "~/lib/utils";

interface BalancesTabProps {
  group: GetGroupResponse;
}

interface SettleUpTarget {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  toVenmoUsername: string | null;
  toCashappUsername: string | null;
  toZelleUsername: string | null;
}

export default function BalancesTab({ group }: BalancesTabProps) {
  const { userId } = useAuth();
  const [settleTarget, setSettleTarget] = useState<SettleUpTarget | null>(null);
  const memberMap = new Map(group.members.map((m) => [m.id, m]));
  const getMember = (id: string) => memberMap.get(id);

  // Group settlements by debtor (who owes)
  const owesByUser = new Map<string, { to: GroupMember; amount: number }[]>();
  // Group settlements by creditor (who is owed)
  const owedToUser = new Map<string, { from: GroupMember; amount: number }[]>();

  for (const settlement of group.settlements) {
    const fromMember = getMember(settlement.fromUserId);
    const toMember = getMember(settlement.toUserId);
    if (!fromMember || !toMember) continue;

    const owes = owesByUser.get(settlement.fromUserId) ?? [];
    owes.push({ to: toMember, amount: settlement.amount });
    owesByUser.set(settlement.fromUserId, owes);

    const owed = owedToUser.get(settlement.toUserId) ?? [];
    owed.push({ from: fromMember, amount: settlement.amount });
    owedToUser.set(settlement.toUserId, owed);
  }

  // Get all members with non-zero balances, sorted by absolute balance
  const membersWithBalances = group.members
    .filter((m) => {
      const balance = group.balances[m.id];
      return balance && Math.abs(balance.netBalance) > 0.01;
    })
    .sort((a, b) => {
      const balA = group.balances[a.id]?.netBalance ?? 0;
      const balB = group.balances[b.id]?.netBalance ?? 0;
      return balB - balA; // Creditors first, then debtors
    });

  if (group.settlements.length === 0) {
    return (
      <div className="border-border rounded-xl border-2 border-dashed px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-500/60" />
        <p className="text-foreground mt-3 text-sm font-medium">All settled up!</p>
        <p className="text-muted-foreground mt-1 text-xs">No outstanding balances in this group.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settlement cards */}
      <div className="space-y-2">
        {group.settlements.map((settlement, index) => {
          const from = getMember(settlement.fromUserId);
          const to = getMember(settlement.toUserId);
          if (!from || !to) return null;

          return (
            <Card key={index} className="gap-0 py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-red-500/8 text-[11px] font-medium text-red-500">
                      {from.firstName.charAt(0)}
                      {from.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{from.firstName}</span>
                </div>

                <div className="flex flex-1 items-center justify-center gap-2">
                  <div className="bg-border h-px flex-1" />
                  <div className="border-border bg-muted/50 flex items-center gap-1.5 rounded-full border px-3 py-1">
                    <span className="text-foreground text-xs font-semibold">
                      ${settlement.amount.toFixed(2)}
                    </span>
                    <ArrowRight className="text-muted-foreground h-3 w-3" />
                  </div>
                  <div className="bg-border h-px flex-1" />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{to.firstName}</span>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-green-500/8 text-[11px] font-medium text-green-600">
                      {to.firstName.charAt(0)}
                      {to.lastName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {(userId === settlement.fromUserId || userId === settlement.toUserId) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 shrink-0 text-xs"
                    onClick={() =>
                      setSettleTarget({
                        fromUserId: settlement.fromUserId,
                        fromUserName: `${from.firstName} ${from.lastName}`,
                        toUserId: settlement.toUserId,
                        toUserName: `${to.firstName} ${to.lastName}`,
                        amount: settlement.amount,
                        toVenmoUsername: to.venmoUsername,
                        toCashappUsername: to.cashappUsername,
                        toZelleUsername: to.zelleUsername,
                      })
                    }
                  >
                    Settle
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-person breakdown */}
      <div className="space-y-3">
        <h3 className="text-muted-foreground text-sm font-medium">Per-person breakdown</h3>
        <div className="space-y-2">
          {membersWithBalances.map((member) => {
            const balance = group.balances[member.id]!;
            const isCreditor = balance.netBalance > 0;
            const debts = owesByUser.get(member.id) ?? [];
            const credits = owedToUser.get(member.id) ?? [];

            return (
              <Card key={member.id} className="gap-0 py-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className={cn("text-xs font-medium", {
                            "bg-green-500/8 text-green-600": isCreditor,
                            "bg-red-500/8 text-red-500": !isCreditor,
                          })}
                        >
                          {member.firstName.charAt(0)}
                          {member.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-foreground text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        <p
                          className={cn("text-xs", {
                            "text-green-600": isCreditor,
                            "text-red-500": !isCreditor,
                          })}
                        >
                          {isCreditor
                            ? `Owed $${balance.netBalance.toFixed(2)} total`
                            : `Owes $${Math.abs(balance.netBalance).toFixed(2)} total`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detail rows */}
                  {(debts.length > 0 || credits.length > 0) && (
                    <div className="border-border mt-3 ml-12 space-y-1.5 border-t pt-3">
                      {credits.map((credit) => (
                        <div key={credit.from.id} className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            {credit.from.firstName} {credit.from.lastName} pays them
                          </span>
                          <span className="text-xs font-medium text-green-600">
                            +${credit.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {debts.map((debt) => (
                        <div key={debt.to.id} className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            Pays {debt.to.firstName} {debt.to.lastName}
                          </span>
                          <span className="text-xs font-medium text-red-500">
                            -${debt.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {settleTarget && (
        <SettleUpModal
          open={!!settleTarget}
          onOpenChange={(open) => {
            if (!open) setSettleTarget(null);
          }}
          groupId={group.id}
          groupName={group.name}
          fromUserId={settleTarget.fromUserId}
          fromUserName={settleTarget.fromUserName}
          toUserId={settleTarget.toUserId}
          toUserName={settleTarget.toUserName}
          suggestedAmount={settleTarget.amount}
          toVenmoUsername={settleTarget.toVenmoUsername}
          toCashappUsername={settleTarget.toCashappUsername}
          toZelleUsername={settleTarget.toZelleUsername}
        />
      )}
    </div>
  );
}
