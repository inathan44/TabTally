"use client";

import { useState } from "react";
import { DollarSign, Pencil, Receipt } from "lucide-react";
import CreateTransactionModal from "~/components/create-transaction-modal";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { GetGroupResponse } from "~/server/contracts/groups";
import type { SafeTransaction } from "~/server/contracts/transactions";
import { cn } from "~/lib/utils";

interface TransactionsTabProps {
  group: GetGroupResponse;
  totalSpending: number;
  isGroupAdmin: boolean;
  userId: string | null | undefined;
}

export default function TransactionsTab({
  group,
  totalSpending,
  isGroupAdmin,
  userId,
}: TransactionsTabProps) {
  const [editingTransaction, setEditingTransaction] = useState<SafeTransaction | null>(null);

  const canEdit = (transaction: SafeTransaction) =>
    isGroupAdmin || transaction.createdById === userId;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        {totalSpending > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/8">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total spent</p>
              <p className="text-sm font-semibold text-foreground">
                ${totalSpending.toFixed(2)}
              </p>
            </div>
          </div>
        )}
        <CreateTransactionModal
          groupId={group.id}
          groupMembers={group.members}
        />
      </div>

      {group.transactions && group.transactions.length > 0 ? (
        <div className="space-y-2">
          {group.transactions
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .map((transaction) => (
              <Card
                key={transaction.id}
                className="gap-0 py-0"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className={cn(
                          "text-[11px] font-medium",
                          {
                            "bg-green-500/8 text-green-600": transaction.isSettlement,
                            "bg-primary/8 text-primary": !transaction.isSettlement,
                          },
                        )}>
                          {transaction.payer.firstName.charAt(0)}
                          {transaction.payer.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {transaction.isSettlement
                            ? `${transaction.payer.firstName} settled up`
                            : (transaction.description ?? "Untitled expense")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.isSettlement
                            ? `Paid ${transaction.transactionDetails?.[0]?.recipient.firstName ?? "someone"}`
                            : `${transaction.payer.firstName} paid`}
                          {" · "}
                          {new Date(transaction.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-semibold",
                        {
                          "text-green-600": transaction.isSettlement,
                          "text-foreground": !transaction.isSettlement,
                        },
                      )}>
                        ${Math.abs(Number(transaction.amount)).toFixed(2)}
                      </span>
                      {canEdit(transaction) && !transaction.isSettlement && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingTransaction(transaction)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {!transaction.isSettlement && transaction.transactionDetails?.length > 0 && (
                    <div className="ml-11 mt-3 space-y-1.5 border-t border-border pt-3">
                      {transaction.transactionDetails.map((detail) => (
                        <div
                          key={detail.id}
                          className="flex items-center justify-between"
                        >
                          <span className="text-xs text-muted-foreground">
                            {detail.recipient.firstName}{" "}
                            {detail.recipient.lastName}
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
          <p className="mt-3 text-sm font-medium text-foreground">
            No transactions yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first expense to get started.
          </p>
        </div>
      )}

      {editingTransaction && (
        <CreateTransactionModal
          groupId={group.id}
          groupMembers={group.members}
          editTransaction={editingTransaction}
          open={!!editingTransaction}
          onOpenChange={(open) => { if (!open) setEditingTransaction(null); }}
        />
      )}
    </div>
  );
}
