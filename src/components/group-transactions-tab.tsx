"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DollarSign, Receipt, Search } from "lucide-react";
import CreateTransactionModal from "~/components/create-transaction-modal";
import TransactionDetailSheet from "~/components/transaction-detail-sheet";
import TransactionFiltersBar, {
  hasActiveFilters,
  type TransactionFilters,
} from "~/components/transaction-filters";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import type { GetGroupResponse } from "~/server/contracts/groups";
import { transactionCategoryLabels, transactionCategories } from "~/server/contracts/groups";
import type { SafeTransaction } from "~/server/contracts/transactions";
import type { TransactionCategory } from "@prisma/client";
import { cn } from "~/lib/utils";

interface TransactionsTabProps {
  group: GetGroupResponse;
  totalSpending: number;
  isGroupAdmin: boolean;
  userId: string | null | undefined;
}

function parseFiltersFromParams(params: URLSearchParams): TransactionFilters {
  const categoriesParam = params.get("categories");
  const payersParam = params.get("payers");
  return {
    search: params.get("search") ?? "",
    categories: categoriesParam ? categoriesParam.split(",") : [],
    payerIds: payersParam ? payersParam.split(",") : [],
    dateFrom: params.get("from") ? new Date(params.get("from")!) : undefined,
    dateTo: params.get("to") ? new Date(params.get("to")!) : undefined,
  };
}

export default function TransactionsTab({
  group,
  totalSpending,
  isGroupAdmin,
  userId,
}: TransactionsTabProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [selectedTransaction, setSelectedTransaction] = useState<SafeTransaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<SafeTransaction | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const filters = parseFiltersFromParams(searchParams);
  const filtersActive = hasActiveFilters(filters);

  const handleFilterChange = useCallback(
    (newFilters: TransactionFilters) => {
      const params = new URLSearchParams(searchParams.toString());

      // Preserve non-filter params (like tab)
      const setOrDelete = (key: string, value: string | undefined) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      };

      setOrDelete("search", newFilters.search || undefined);
      setOrDelete(
        "categories",
        newFilters.categories.length > 0 ? newFilters.categories.join(",") : undefined,
      );
      setOrDelete(
        "payers",
        newFilters.payerIds.length > 0 ? newFilters.payerIds.join(",") : undefined,
      );
      setOrDelete("from", newFilters.dateFrom?.toISOString().split("T")[0]);
      setOrDelete("to", newFilters.dateTo?.toISOString().split("T")[0]);

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, router, pathname],
  );

  // Build query input from URL filters
  const validCategories = filters.categories.filter((c) =>
    transactionCategories.includes(c as (typeof transactionCategories)[number]),
  ) as (typeof transactionCategories)[number][];

  const queryInput = {
    groupId: group.id,
    ...(filters.search && { search: filters.search }),
    ...(validCategories.length > 0 && { categories: validCategories }),
    ...(filters.payerIds.length > 0 && { payerIds: filters.payerIds }),
    ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
    ...(filters.dateTo && { dateTo: filters.dateTo }),
  };

  const { data: txResponse, isFetching: txFetching } =
    api.group.getGroupTransactions.useQuery(queryInput);

  const transactions = txResponse?.data ?? [];
  const totalCount = group.transactions?.length ?? 0;

  const canEdit = (transaction: SafeTransaction) =>
    isGroupAdmin || transaction.createdById === userId;

  const getUserShare = (
    transaction: SafeTransaction,
  ): { label: string; className: string } | null => {
    if (!userId || transaction.isSettlement) return null;

    const amountPaid = transaction.payerId === userId ? Number(transaction.amount) : 0;
    const amountOwed = Number(
      transaction.transactionDetails.find((d) => d.recipientId === userId)?.amount ?? 0,
    );
    const net = amountPaid - amountOwed;

    if (net > 0) {
      return { label: `You are owed $${net.toFixed(2)}`, className: "text-green-600" };
    }
    if (net < 0) {
      return { label: `You owe $${Math.abs(net).toFixed(2)}`, className: "text-orange-600" };
    }

    return null;
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        {totalSpending > 0 && (
          <div className="flex items-center gap-2">
            <div className="bg-success/8 flex h-8 w-8 items-center justify-center rounded-lg">
              <DollarSign className="text-success h-4 w-4" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total spent</p>
              <p className="text-foreground text-sm font-semibold">${totalSpending.toFixed(2)}</p>
            </div>
          </div>
        )}
        <CreateTransactionModal groupId={group.id} groupMembers={group.members} />
      </div>

      {totalCount > 0 && (
        <div className="mb-4">
          <TransactionFiltersBar
            filters={filters}
            onFilterChange={handleFilterChange}
            members={group.members}
            expanded={filtersExpanded}
            onToggleExpanded={() => setFiltersExpanded((prev) => !prev)}
          />
          {filtersActive && !txFetching && (
            <p className="text-muted-foreground mt-2 text-xs">
              Showing {transactions.length} of {totalCount} transactions
            </p>
          )}
        </div>
      )}

      {txFetching ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-16 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map((transaction) => {
            const share = getUserShare(transaction);

            return (
              <Card
                key={transaction.id}
                className="hover:bg-muted/50 cursor-pointer gap-0 py-0 transition-colors"
                onClick={() => setSelectedTransaction(transaction)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-foreground truncate text-sm font-medium">
                          {transaction.isSettlement
                            ? `${transaction.payer.firstName} → ${transaction.transactionDetails?.[0]?.recipient.firstName ?? "?"}`
                            : (transaction.description ?? "Untitled expense")}
                        </p>
                        {transaction.category && (
                          <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                            {transactionCategoryLabels[transaction.category as TransactionCategory]}
                          </Badge>
                        )}
                        {transaction.receiptUrl && (
                          <Receipt className="text-muted-foreground h-3 w-3 shrink-0" />
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {transaction.isSettlement
                          ? "Settlement"
                          : `${transaction.payer.firstName} paid`}
                        {" · "}
                        {new Date(transaction.transactionDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p
                        className={cn("text-sm font-semibold", {
                          "text-green-600": transaction.isSettlement,
                          "text-foreground": !transaction.isSettlement,
                        })}
                      >
                        ${Math.abs(Number(transaction.amount)).toFixed(2)}
                      </p>
                      {share && <p className={cn("text-xs", share.className)}>{share.label}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : filtersActive ? (
        <div className="border-border rounded-xl border-2 border-dashed px-6 py-12 text-center">
          <Search className="text-muted-foreground/40 mx-auto h-8 w-8" />
          <p className="text-foreground mt-3 text-sm font-medium">No matching transactions</p>
          <p className="text-muted-foreground mt-1 text-xs">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="border-border rounded-xl border-2 border-dashed px-6 py-12 text-center">
          <Receipt className="text-muted-foreground/40 mx-auto h-8 w-8" />
          <p className="text-foreground mt-3 text-sm font-medium">No transactions yet</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Add your first expense to get started.
          </p>
        </div>
      )}

      <TransactionDetailSheet
        transaction={selectedTransaction}
        open={!!selectedTransaction}
        onOpenChange={(open) => {
          if (!open) setSelectedTransaction(null);
        }}
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
          onOpenChange={(open) => {
            if (!open) setEditingTransaction(null);
          }}
        />
      )}
    </div>
  );
}
