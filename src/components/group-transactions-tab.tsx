"use client";

import { useState } from "react";
import { DollarSign, Receipt } from "lucide-react";
import CreateTransactionModal from "~/components/create-transaction-modal";
import TransactionDetailSheet from "~/components/transaction-detail-sheet";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type { GetGroupResponse } from "~/server/contracts/groups";
import { transactionCategoryLabels } from "~/server/contracts/groups";
import type { SafeTransaction } from "~/server/contracts/transactions";
import type { TransactionCategory } from "@prisma/client";
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
  const [selectedTransaction, setSelectedTransaction] = useState<SafeTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SafeTransaction | null>(null);

  const canEdit = (transaction: SafeTransaction) =>
    isGroupAdmin || transaction.createdById === userId;

  const getUserShare = (transaction: SafeTransaction): { label: string; className: string } | null => {
    if (!userId || transaction.isSettlement) return null;

    const userSplit = transaction.transactionDetails.find((d) => d.recipientId === userId);
    const isPayer = transaction.payerId === userId;

    if (isPayer && userSplit) {
      const owedBack = Math.abs(Number(transaction.amount)) - Number(userSplit.amount);
      if (owedBack > 0) {
        return { label: `You are owed $${owedBack.toFixed(2)}`, className: "text-green-600" };
      }
    } else if (userSplit) {
      return { label: `You owe $${Number(userSplit.amount).toFixed(2)}`, className: "text-orange-600" };
    }

    return null;
  };

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
            .map((transaction) => {
              const share = getUserShare(transaction);

              return (
                <Card
                  key={transaction.id}
                  className="cursor-pointer gap-0 py-0 transition-colors hover:bg-muted/50"
                  onClick={() => setSelectedTransaction(transaction)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {transaction.isSettlement
                              ? `${transaction.payer.firstName} → ${transaction.transactionDetails?.[0]?.recipient.firstName ?? "?"}`
                              : (transaction.description ?? "Untitled expense")}
                          </p>
                          {transaction.category && (
                            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                              {transactionCategoryLabels[transaction.category as TransactionCategory]}
                            </Badge>
                          )}
                          {transaction.receiptUrl && (
                            <Receipt className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {transaction.isSettlement ? "Settlement" : `${transaction.payer.firstName} paid`}
                          {" · "}
                          {new Date(transaction.transactionDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className={cn("text-sm font-semibold", {
                          "text-green-600": transaction.isSettlement,
                          "text-foreground": !transaction.isSettlement,
                        })}>
                          ${Math.abs(Number(transaction.amount)).toFixed(2)}
                        </p>
                        {share && (
                          <p className={cn("text-xs", share.className)}>{share.label}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

      <TransactionDetailSheet
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onOpenChange={(open) => { if (!open) setSelectedTransaction(null); }}
        groupId={group.id}
        userId={userId}
        canEdit={selectedTransaction ? canEdit(selectedTransaction) : false}
        onEdit={() => {
          if (selectedTransaction) {
            setEditingTransaction(selectedTransaction);
            setSelectedTransaction(null);
          }
        }}
      />

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
