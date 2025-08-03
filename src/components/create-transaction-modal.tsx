"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "~/components/ui/button";
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
import { Plus, DollarSign, Users, Trash2 } from "lucide-react";
import { api } from "~/trpc/react";
import type { GroupMember } from "~/server/contracts/groups";
import { createTransactionFormSchema } from "~/server/contracts/groups";
import { AnimatedButton } from "./ui/animated-button";

type CreateTransactionForm = z.infer<typeof createTransactionFormSchema>;

interface CreateTransactionModalProps {
  groupId: number;
  groupMembers: GroupMember[];
  onSuccess?: () => void;
}

export default function CreateTransactionModal({
  groupId,
  groupMembers,
  onSuccess,
}: CreateTransactionModalProps) {
  const [open, setOpen] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [isTransactionSuccessful, setIsTransactionSuccessful] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const form = useForm<CreateTransactionForm>({
    resolver: zodResolver(createTransactionFormSchema),
    defaultValues: {
      amount: "",
      description: "",
      payerId: "",
      splits: [{ recipientId: "", amount: "" }],
    },
  });

  const createTransactionMutation = api.group.createTransaction.useMutation();

  const watchedAmount = form.watch("amount");
  const watchedSplits = form.watch("splits");

  // Calculate split amounts automatically when amount changes (only if splits are empty)
  useEffect(() => {
    const amountValue = parseFloat(watchedAmount || "0");
    if (amountValue > 0 && watchedSplits.length > 0) {
      // Only auto-calculate if all splits are empty (haven't been manually set)
      const allSplitsEmpty = watchedSplits.every(
        (split) => !split.amount || split.amount === "0" || split.amount === "0.00",
      );

      if (allSplitsEmpty) {
        // Convert to cents to avoid floating point issues
        const totalCents = Math.round(amountValue * 100);
        const splitCount = watchedSplits.length;

        // Calculate base amount per person in cents
        const baseCents = Math.floor(totalCents / splitCount);
        const remainderCents = totalCents % splitCount;

        const updatedSplits = watchedSplits.map((split, index) => {
          // First 'remainderCents' people get an extra cent
          const splitCents = baseCents + (index < remainderCents ? 1 : 0);
          const splitAmount = (splitCents / 100).toFixed(2);

          return {
            ...split,
            amount: splitAmount,
          };
        });

        form.setValue("splits", updatedSplits);
      }
    }
  }, [watchedAmount, watchedSplits.length, form]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSplit = () => {
    const currentSplits = form.getValues("splits");
    const amount = form.getValues("amount");
    const amountValue = parseFloat(amount || "0");

    // Calculate remaining amount for the new split
    const currentTotal = currentSplits.reduce(
      (sum, split) => sum + (parseFloat(split.amount) || 0),
      0,
    );
    const remainingAmount = Math.max(0, amountValue - currentTotal);

    const newSplit = {
      recipientId: "",
      amount: remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00",
    };
    form.setValue("splits", [...currentSplits, newSplit]);
  };

  const removeSplit = (index: number) => {
    const currentSplits = form.getValues("splits");
    if (currentSplits.length > 1) {
      form.setValue(
        "splits",
        currentSplits.filter((_, i) => i !== index),
      );
    }
  };

  const equalSplit = () => {
    const amount = form.getValues("amount");
    const splits = form.getValues("splits");
    const amountValue = parseFloat(amount || "0");
    if (amountValue > 0 && splits.length > 0) {
      // Convert to cents to avoid floating point issues
      const totalCents = Math.round(amountValue * 100);
      const splitCount = splits.length;

      // Calculate base amount per person in cents
      const baseCents = Math.floor(totalCents / splitCount);
      const remainderCents = totalCents % splitCount;

      const updatedSplits = splits.map((split, index) => {
        // First 'remainderCents' people get an extra cent
        const splitCents = baseCents + (index < remainderCents ? 1 : 0);
        const splitAmount = (splitCents / 100).toFixed(2);

        return {
          ...split,
          amount: splitAmount,
        };
      });

      form.setValue("splits", updatedSplits);
    }
  };

  const handleSubmit = async (values: CreateTransactionForm) => {
    try {
      setTransactionError(null);

      // Parse string values to numbers
      const amountValue = parseFloat(values.amount);
      const splitValues = values.splits.map((split) => ({
        recipientId: split.recipientId,
        amount: parseFloat(split.amount),
      }));

      // Validate that split amounts add up to total amount
      const totalSplitAmount = splitValues.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplitAmount - amountValue) > 0.01) {
        setTransactionError(
          `Split amounts ($${totalSplitAmount.toFixed(2)}) must equal the total amount ($${amountValue.toFixed(2)})`,
        );
        return;
      }

      // Validate that all recipients are selected
      const unselectedRecipients = values.splits.some((split) => !split.recipientId);
      if (unselectedRecipients) {
        setTransactionError("Please select a recipient for each split");
        return;
      }

      // Validate that no user is selected more than once
      const selectedUserIds = values.splits.map((split) => split.recipientId);
      const uniqueUserIds = new Set(selectedUserIds);
      if (selectedUserIds.length !== uniqueUserIds.size) {
        setTransactionError("Each user can only be selected once per transaction");
        return;
      }

      const result = await createTransactionMutation.mutateAsync({
        groupId,
        amount: amountValue,
        description: values.description,
        payerId: values.payerId,
        transactionDetails: splitValues,
      });

      if (result.error) {
        setTransactionError(result.error.message);
      } else {
        setIsTransactionSuccessful(true);
        setTimeout(() => {
          setIsRedirecting(true);
          setTimeout(() => {
            setOpen(false);
            onSuccess?.();
            // Reset form and states
            form.reset();
            setIsTransactionSuccessful(false);
            setIsRedirecting(false);
            setTransactionError(null);
          }, 1000);
        }, 1500);
      }
    } catch (error) {
      console.error("Transaction creation error:", error);
      setTransactionError("An unexpected error occurred. Please try again.");
    }
  };

  const resetModal = () => {
    form.reset();
    setTransactionError(null);
    setIsTransactionSuccessful(false);
    setIsRedirecting(false);
  };

  const totalSplitAmount = watchedSplits.reduce(
    (sum, split) => sum + (parseFloat(split.amount) || 0),
    0,
  );
  const amountValue = parseFloat(watchedAmount || "0");
  const amountDifference = amountValue - totalSplitAmount;

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
        {isRedirecting && <div className="fixed inset-0 z-50 bg-black/50" />}
        <DialogHeader>
          <DialogTitle>Create New Transaction</DialogTitle>
          <DialogDescription>Add a new expense to split between group members</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Amount and Description */}
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
                            {member.isAdmin && " (Admin)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <span className="font-medium">Split Details</span>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={equalSplit}>
                    Equal Split
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addSplit}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Split
                  </Button>
                </div>
              </div>

              {watchedSplits.map((split, index) => (
                <div key={index} className="flex items-end gap-2">
                  <FormField
                    control={form.control}
                    name={`splits.${index}.recipientId`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Recipient {index + 1}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select recipient" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {groupMembers
                              .filter((member) => {
                                // Filter out already selected users, except for the current selection
                                const selectedUserIds = watchedSplits
                                  .map((split, splitIndex) =>
                                    splitIndex !== index ? split.recipientId : null,
                                  )
                                  .filter(Boolean);
                                return !selectedUserIds.includes(member.id);
                              })
                              .map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  {member.firstName} {member.lastName}
                                  {member.isAdmin && " (Admin)"}
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
                    name={`splits.${index}.amount`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2 transform text-gray-400" />
                            <Input
                              type="text"
                              placeholder="0.00"
                              className="pl-7 text-sm"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {watchedSplits.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSplit(index)}
                      className="mb-2 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {/* Amount validation display */}
              {amountValue > 0 && (
                <div
                  className={`rounded-lg p-3 text-sm ${
                    Math.abs(amountDifference) < 0.01
                      ? "border border-green-200 bg-green-50 text-green-700"
                      : "border border-yellow-200 bg-yellow-50 text-yellow-700"
                  }`}
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
                      <span className={amountDifference > 0 ? "text-red-600" : "text-blue-600"}>
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
                success={isTransactionSuccessful}
                successText="Transaction Created!"
                disabled={
                  createTransactionMutation.isPending || isTransactionSuccessful || isRedirecting
                }
                className="min-w-[140px]"
              >
                {isRedirecting ? "Refreshing..." : "Create Transaction"}
              </AnimatedButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
