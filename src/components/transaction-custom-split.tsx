"use client";

import { useFormContext } from "react-hook-form";
import type { z } from "zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { DollarSign } from "lucide-react";
import { cn } from "~/lib/utils";
import type { GroupMember } from "~/server/contracts/groups";
import { createTransactionFormSchema } from "~/server/contracts/groups";

type TransactionFormValues = z.infer<typeof createTransactionFormSchema>;

interface TransactionCustomSplitProps {
  groupMembers: GroupMember[];
  fields: { id: string; recipientId: string; amount: string }[];
  toggleMember: (memberId: string) => void;
  selectAll: () => void;
  equalSplit: () => void;
}

export default function TransactionCustomSplit({
  groupMembers,
  fields,
  toggleMember,
  selectAll,
  equalSplit,
}: TransactionCustomSplitProps) {
  const form = useFormContext<TransactionFormValues>();
  const watchedAmount = form.watch("amount");
  const watchedSplits = form.watch("splits");

  const selectedMemberIds = new Set(fields.map((f) => f.recipientId));
  const allSelected =
    groupMembers.length > 0 && groupMembers.every((m) => selectedMemberIds.has(m.id));

  const totalSplitAmount = watchedSplits.reduce(
    (sum, split) => sum + (parseFloat(split.amount) || 0),
    0,
  );
  const amountValue = parseFloat(watchedAmount || "0");
  const amountDifference = amountValue - totalSplitAmount;

  const getMemberById = (id: string) => groupMembers.find((m) => m.id === id);

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={selectAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
        {fields.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={equalSplit}
            disabled={!watchedAmount || parseFloat(watchedAmount) <= 0}
          >
            Split Evenly
          </Button>
        )}
      </div>

      {/* Member Chips */}
      <div className="relative min-w-0 overflow-hidden">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {groupMembers.map((member) => {
            const isSelected = selectedMemberIds.has(member.id);
            return (
              <Button
                key={member.id}
                type="button"
                variant="outline"
                onClick={() => toggleMember(member.id)}
                className={cn(
                  "flex h-auto shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm",
                  isSelected ? "border-primary bg-primary/10 text-primary hover:bg-primary/20" : "",
                )}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px]">
                    {member.firstName.charAt(0)}
                    {member.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span>{member.firstName}</span>
              </Button>
            );
          })}
        </div>
        {/* Fade hint on right edge */}
        <div className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent" />
      </div>

      <FormField
        control={form.control}
        name="splits"
        render={() => (
          <FormItem>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Amount inputs for selected members */}
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field, index) => {
            const member = getMemberById(field.recipientId);
            if (!member) return null;
            return (
              <div
                key={field.id}
                className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/8 text-primary text-[10px] font-medium">
                    {member.firstName.charAt(0)}
                    {member.lastName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {member.firstName} {member.lastName}
                </span>
                <FormField
                  control={form.control}
                  name={`splits.${index}.amount`}
                  render={({ field: amountField }) => (
                    <FormItem className="mb-0 w-28">
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
                          <Input
                            type="text"
                            placeholder="0.00"
                            className="h-8 pl-6 text-sm"
                            {...amountField}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Amount validation display */}
      {amountValue > 0 && fields.length > 0 && (
        <div
          className={cn("rounded-lg border p-3 text-sm", {
            "border-green-200 bg-green-50 text-green-700": Math.abs(amountDifference) < 0.01,
            "border-yellow-200 bg-yellow-50 text-yellow-700": Math.abs(amountDifference) >= 0.01,
          })}
        >
          <div className="flex justify-between">
            <span>Total Amount:</span>
            <span>${amountValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Split Total:</span>
            <span>${totalSplitAmount.toFixed(2)}</span>
          </div>
          {Math.abs(amountDifference) >= 0.01 && (
            <div className="flex justify-between font-medium">
              <span>Difference:</span>
              <span
                className={cn({
                  "text-red-600": amountDifference > 0,
                  "text-blue-600": amountDifference <= 0,
                })}
              >
                ${Math.abs(amountDifference).toFixed(2)}{" "}
                {amountDifference > 0 ? "remaining" : "over"}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
