"use client";

import { Receipt, CalendarDays, User, Pencil } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import DeleteTransactionDialog from "~/components/delete-transaction-dialog";
import { transactionCategoryLabels } from "~/server/contracts/groups";
import type { SafeTransaction } from "~/server/contracts/transactions";
import { cn } from "~/lib/utils";

interface TransactionDetailSheetProps {
  transaction: SafeTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  userId: string | null | undefined;
  canEdit: boolean;
  onEdit: () => void;
}

export default function TransactionDetailSheet({
  transaction,
  open,
  onOpenChange,
  groupId,
  userId,
  canEdit,
  onEdit,
}: TransactionDetailSheetProps) {
  if (!transaction) return null;

  const amount = Math.abs(Number(transaction.amount));
  const userSplit = transaction.transactionDetails.find((d) => d.recipientId === userId);
  const userOwes = userSplit && transaction.payerId !== userId;
  const userPaid = transaction.payerId === userId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {transaction.isSettlement
              ? `${transaction.payer.firstName} settled up`
              : transaction.title}
          </SheetTitle>
          <SheetDescription>
            {new Date(transaction.transactionDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Amount */}
          <div className="text-center">
            <p
              className={cn("text-3xl font-bold", {
                "text-green-600": transaction.isSettlement,
                "text-foreground": !transaction.isSettlement,
              })}
            >
              ${amount.toFixed(2)}
            </p>
            {transaction.category && (
              <Badge variant="secondary" className="mt-2">
                {transactionCategoryLabels[transaction.category]}
              </Badge>
            )}
          </div>

          <Separator />

          {/* Paid by */}
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/8 text-primary text-[11px] font-medium">
                {transaction.payer.firstName.charAt(0)}
                {transaction.payer.lastName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {transaction.payer.firstName} {transaction.payer.lastName}
              </p>
              <p className="text-muted-foreground text-xs">Paid the full amount</p>
            </div>
          </div>

          {/* Split breakdown */}
          {!transaction.isSettlement && transaction.transactionDetails.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">Split breakdown</p>
                {transaction.transactionDetails.map((detail) => (
                  <div key={detail.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-muted text-[9px] font-medium">
                          {detail.recipient.firstName.charAt(0)}
                          {detail.recipient.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn("text-sm", {
                          "font-medium": detail.recipientId === userId,
                          "text-muted-foreground": detail.recipientId !== userId,
                        })}
                      >
                        {detail.recipientId === userId
                          ? "You"
                          : `${detail.recipient.firstName} ${detail.recipient.lastName}`}
                      </span>
                    </div>
                    <span className="text-sm font-medium">${Number(detail.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Settlement recipient */}
          {transaction.isSettlement && transaction.transactionDetails[0] && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-green-500/8 text-[11px] font-medium text-green-600">
                    {transaction.transactionDetails[0].recipient.firstName.charAt(0)}
                    {transaction.transactionDetails[0].recipient.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {transaction.transactionDetails[0].recipient.firstName}{" "}
                    {transaction.transactionDetails[0].recipient.lastName}
                  </p>
                  <p className="text-muted-foreground text-xs">Received payment</p>
                </div>
              </div>
            </>
          )}

          {/* Receipt */}
          {transaction.receiptUrl && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Receipt</p>
                {transaction.receiptUrl.endsWith(".pdf") ? (
                  <a
                    href={transaction.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border hover:bg-muted/50 flex items-center gap-2 rounded-md border p-3 transition-colors"
                  >
                    <Receipt className="text-muted-foreground h-4 w-4" />
                    <span className="text-muted-foreground text-sm">View PDF</span>
                  </a>
                ) : (
                  <a href={transaction.receiptUrl} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={transaction.receiptUrl}
                      alt="Receipt"
                      className="border-border w-full rounded-md border object-contain"
                    />
                  </a>
                )}
              </div>
            </>
          )}

          {/* Meta info */}
          <Separator />
          <div className="text-muted-foreground space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>
                Added{" "}
                {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              <span>
                Created by {transaction.createdBy.firstName} {transaction.createdBy.lastName}
              </span>
            </div>
          </div>

          {/* Actions */}
          {canEdit && (
            <>
              <Separator />
              <div className="flex gap-2">
                {!transaction.isSettlement && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      onOpenChange(false);
                      onEdit();
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                <DeleteTransactionDialog
                  groupId={groupId}
                  transactionId={transaction.id}
                  transactionDescription={
                    transaction.isSettlement
                      ? `${transaction.payer.firstName} settled up`
                      : transaction.title
                  }
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
