"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { DollarSign, ArrowRight, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { api } from "~/trpc/react";
import { AnimatedButton } from "./ui/animated-button";

const settleUpFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      { message: "Amount must be greater than 0" },
    ),
});

type SettleUpForm = z.infer<typeof settleUpFormSchema>;

interface SettleUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  groupName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  suggestedAmount: number;
  toVenmoUsername: string | null;
  toCashappUsername: string | null;
}

export default function SettleUpModal({
  open,
  onOpenChange,
  groupId,
  groupName,
  fromUserId,
  fromUserName,
  toUserId,
  toUserName,
  suggestedAmount,
  toVenmoUsername,
  toCashappUsername,
}: SettleUpModalProps) {
  const utils = api.useUtils();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SettleUpForm>({
    resolver: zodResolver(settleUpFormSchema),
    defaultValues: {
      amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
    },
  });

  const settleMutation = api.group.createSettlement.useMutation();
  const watchedAmount = form.watch("amount");
  const paymentNote = encodeURIComponent(`TabTally - ${groupName}`);

  const onSubmit = async (data: SettleUpForm) => {
    setError(null);
    const amount = parseFloat(data.amount);

    const result = await settleMutation.mutateAsync({
      groupId,
      payerId: fromUserId,
      recipientId: toUserId,
      amount,
    });

    if (result.error) {
      setError(result.error.message);
    } else {
      onOpenChange(false);
      form.reset();
      settleMutation.reset();
      void utils.group.getGroupBySlug.invalidate();
      void utils.group.getGroupTransactions.invalidate();
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      form.reset({ amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "" });
      setError(null);
      settleMutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settle Up</DialogTitle>
          <DialogDescription>Record a payment between members</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Visual from → to */}
            <div className="border-border bg-muted/30 flex items-center justify-center gap-4 rounded-lg border p-4">
              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-red-500/8 text-sm font-medium text-red-500">
                    {fromUserName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{fromUserName.split(" ")[0]}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-border h-px w-6" />
                <ArrowRight className="text-muted-foreground h-4 w-4" />
                <div className="bg-border h-px w-6" />
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-green-500/8 text-sm font-medium text-green-600">
                    {toUserName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{toUserName.split(" ")[0]}</span>
              </div>
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <Input type="text" placeholder="0.00" className="pl-10 text-lg" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(toVenmoUsername ?? toCashappUsername) && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">
                  Pay {toUserName.split(" ")[0]} directly
                </p>
                <div className="flex gap-2">
                  {toVenmoUsername && (
                    <a
                      href={`https://account.venmo.com/pay?recipients=${toVenmoUsername}&txn=pay${watchedAmount ? `&amount=${watchedAmount}` : ""}&note=${paymentNote}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border bg-muted/30 text-foreground hover:bg-muted inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                    >
                      Venmo @{toVenmoUsername}
                      <ExternalLink className="text-muted-foreground h-3 w-3" />
                    </a>
                  )}
                  {toCashappUsername && (
                    <a
                      href={`https://cash.app/$${toCashappUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border bg-muted/30 text-foreground hover:bg-muted inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                    >
                      Cash App ${toCashappUsername}
                      <ExternalLink className="text-muted-foreground h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {(error ?? settleMutation.error) && (
              <div className="border-destructive/20 bg-destructive/5 rounded-md border p-3">
                <p className="text-destructive text-sm">
                  {error ?? settleMutation.error?.message ?? "An unexpected error occurred."}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <AnimatedButton
                type="submit"
                loading={settleMutation.isPending}
                success={settleMutation.isSuccess && !settleMutation.data?.error}
                loadingType="spinner"
                loadingText="Recording..."
                successText="Settled!"
                className="min-w-[120px]"
              >
                Record Payment
              </AnimatedButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
