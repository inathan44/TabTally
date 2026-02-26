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
import { DollarSign, ArrowRight } from "lucide-react";
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
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  suggestedAmount: number;
}

export default function SettleUpModal({
  open,
  onOpenChange,
  groupId,
  fromUserId,
  fromUserName,
  toUserId,
  toUserName,
  suggestedAmount,
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
            <div className="flex items-center justify-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-red-500/8 text-sm font-medium text-red-500">
                    {fromUserName.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium">{fromUserName.split(" ")[0]}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px w-6 bg-border" />
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="h-px w-6 bg-border" />
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-green-500/8 text-sm font-medium text-green-600">
                    {toUserName.split(" ").map((n) => n[0]).join("")}
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
                      <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="0.00"
                        className="pl-10 text-lg"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(error ?? settleMutation.error) && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-sm text-destructive">
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
