"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Plus, DollarSign, Users, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { GroupMember } from "~/server/contracts/groups";
import { createTransactionFormSchema } from "~/server/contracts/groups";
import { AnimatedButton } from "./ui/animated-button";

export type CreateTransactionForm = z.infer<typeof createTransactionFormSchema>;

interface CreateTransactionModalProps {
  groupId: number;
  groupMembers: GroupMember[];
}

export default function CreateTransactionModal({
  groupId,
  groupMembers,
}: CreateTransactionModalProps) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(createTransactionFormSchema),
    defaultValues: {
      amount: "",
      description: "",
      payerId: "",
      transactionDate: new Date(),
      splits: [] as { recipientId: string; amount: string }[],
    },
  });

  const createTransactionMutation = api.group.createTransaction.useMutation();

  const { fields, replace, append, remove } = useFieldArray({
    control: form.control,
    name: "splits",
  });

  const watchedAmount = form.watch("amount");
  const watchedSplits = form.watch("splits");
  const watchedPayerId = form.watch("payerId");

  const selectedMemberIds = new Set(fields.map((f) => f.recipientId));

  // Auto-select payer in splits when payer changes
  useEffect(() => {
    if (!watchedPayerId) return;
    const currentSplits = form.getValues("splits");
    const alreadyIncluded = currentSplits.some((s) => s.recipientId === watchedPayerId);
    if (!alreadyIncluded) {
      append({ recipientId: watchedPayerId, amount: "" });
    }
  }, [watchedPayerId, form]);

  const toggleMember = (memberId: string) => {
    const currentSplits = form.getValues("splits");
    if (selectedMemberIds.has(memberId)) {
      const indexToRemove = currentSplits.findIndex((s) => s.recipientId === memberId);
      if (indexToRemove !== -1) remove(indexToRemove);
    } else {
      append({ recipientId: memberId, amount: "" });
    }
  };

  const selectAll = () => {
    const currentSplits = form.getValues("splits");
    const allSelected = groupMembers.every((m) => selectedMemberIds.has(m.id));
    if (allSelected) {
      replace([]);
    } else {
      const newSplits = groupMembers.map((member) => {
        const existing = currentSplits.find((s) => s.recipientId === member.id);
        return existing ?? { recipientId: member.id, amount: "" };
      });
      replace(newSplits);
    }
  };

  const equalSplit = () => {
    const amount = form.getValues("amount");
    const splits = form.getValues("splits");
    const amountValue = parseFloat(amount || "0");
    if (amountValue > 0 && splits.length > 0) {
      const totalCents = Math.round(amountValue * 100);
      const splitCount = splits.length;
      const baseCents = Math.floor(totalCents / splitCount);
      const remainderCents = totalCents % splitCount;

      const updatedSplits = splits.map((split, index) => {
        const splitCents = baseCents + (index < remainderCents ? 1 : 0);
        return { ...split, amount: (splitCents / 100).toFixed(2) };
      });

      replace(updatedSplits);
    }
  };

  const getMemberById = (id: string) => groupMembers.find((m) => m.id === id);

  const handleSubmit = async (values: CreateTransactionForm) => {
    try {
      setTransactionError(null);

      const amountValue = parseFloat(values.amount);
      const splitValues = values.splits.map((split) => ({
        recipientId: split.recipientId,
        amount: parseFloat(split.amount),
      }));

      const totalSplitAmount = splitValues.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplitAmount - amountValue) > 0.01) {
        setTransactionError(
          `Split amounts ($${totalSplitAmount.toFixed(2)}) must equal the total amount ($${amountValue.toFixed(2)})`,
        );
        return;
      }

      const result = await createTransactionMutation.mutateAsync({
        groupId,
        amount: amountValue,
        description: values.description,
        payerId: values.payerId,
        transactionDate: values.transactionDate,
        transactionDetails: splitValues,
      });

      if (result.error) {
        setTransactionError(result.error.message);
      } else {
        setOpen(false);
        void utils.group.getGroupBySlug.invalidate();
        form.reset();
        createTransactionMutation.reset();
        setTransactionError(null);
      }
    } catch (error) {
      console.error("Transaction creation error:", error);
      setTransactionError("An unexpected error occurred. Please try again.");
    }
  };

  const resetModal = () => {
    form.reset();
    setTransactionError(null);
    createTransactionMutation.reset();
  };

  const totalSplitAmount = watchedSplits.reduce(
    (sum, split) => sum + (parseFloat(split.amount) || 0),
    0,
  );
  const amountValue = parseFloat(watchedAmount || "0");
  const amountDifference = amountValue - totalSplitAmount;
  const allSelected = groupMembers.length > 0 && groupMembers.every((m) => selectedMemberIds.has(m.id));

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          resetModal();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
          <DialogDescription>Add a new expense to split between group members</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                        <Input type="text" placeholder="0.00" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="payerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who Paid? *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {groupMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.firstName} {member.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="transactionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              { "text-muted-foreground": !field.value },
                            )}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What was this expense for? (e.g., Dinner at restaurant, Groceries, etc.)"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Split Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">Split Between</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                    {allSelected ? "Deselect All" : "Select All"}
                  </Button>
                  {fields.length > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={equalSplit}>
                      Split Evenly
                    </Button>
                  )}
                </div>
              </div>

              {/* Member Chips */}
              <div className="relative overflow-hidden">
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {groupMembers.map((member) => {
                    const isSelected = selectedMemberIds.has(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleMember(member.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-all",
                          {
                            "border-primary bg-primary/10 text-primary": isSelected,
                            "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground": !isSelected,
                          },
                        )}
                      >
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px]">
                            {member.firstName.charAt(0)}
                            {member.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.firstName}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Fade hint on right edge */}
                <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent" />
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
                      <div key={field.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/8 text-[10px] font-medium text-primary">
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
                                  <DollarSign className="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                                  <Input
                                    type="text"
                                    placeholder="0.00"
                                    className="h-8 pl-6 text-sm"
                                    {...amountField}
                                  />
                                </div>
                              </FormControl>
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
                  className={cn(
                    "rounded-lg border p-3 text-sm",
                    {
                      "border-green-200 bg-green-50 text-green-700": Math.abs(amountDifference) < 0.01,
                      "border-yellow-200 bg-yellow-50 text-yellow-700": Math.abs(amountDifference) >= 0.01,
                    },
                  )}
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
                      <span className={cn({
                        "text-red-600": amountDifference > 0,
                        "text-blue-600": amountDifference <= 0,
                      })}>
                        ${Math.abs(amountDifference).toFixed(2)}{" "}
                        {amountDifference > 0 ? "remaining" : "over"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Display */}
            {transactionError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4">
                <div className="text-sm text-red-800">{transactionError}</div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <AnimatedButton
                type="submit"
                loading={createTransactionMutation.isPending}
                success={createTransactionMutation.isSuccess && !createTransactionMutation.data?.error}
                successText="Transaction Created!"
                disabled={
                  createTransactionMutation.isPending || createTransactionMutation.isSuccess
                }
                className="min-w-[140px]"
              >
                Create Transaction
              </AnimatedButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
