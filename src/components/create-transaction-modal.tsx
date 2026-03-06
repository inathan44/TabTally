"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { TransactionCategory } from "@prisma/client";
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
import { Plus, DollarSign, Users, CalendarIcon, Upload, X, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import type { GroupMember } from "~/server/contracts/groups";
import {
  createTransactionFormSchema,
  transactionCategories,
  transactionCategoryLabels,
} from "~/server/contracts/groups";
import type { SafeTransaction } from "~/server/contracts/transactions";
import { AnimatedButton } from "./ui/animated-button";
import { useReceiptUpload } from "~/hooks/use-receipt-upload";

export type CreateTransactionForm = z.infer<typeof createTransactionFormSchema>;

interface CreateTransactionModalProps {
  groupId: number;
  groupMembers: GroupMember[];
  editTransaction?: SafeTransaction;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CreateTransactionModal({
  groupId,
  groupMembers,
  editTransaction,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateTransactionModalProps) {
  const isEditMode = !!editTransaction;
  const utils = api.useUtils();
  const [internalOpen, setInternalOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const receipt = useReceiptUpload({
    groupId,
    initialUrl: isEditMode ? (editTransaction.receiptUrl ?? null) : null,
  });

  // Fallback for uncontrolled mode — no-op is intentional when onOpenChange isn't provided
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = () => {};
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? noop) : setInternalOpen;

  const defaultValues = isEditMode
    ? {
        amount: Math.abs(Number(editTransaction.amount)).toFixed(2),
        description: editTransaction.description ?? "",
        category: editTransaction.category ?? null,
        payerId: editTransaction.payerId,
        transactionDate: new Date(editTransaction.transactionDate),
        splits: editTransaction.transactionDetails.map((d) => ({
          recipientId: d.recipientId,
          amount: Math.abs(Number(d.amount)).toFixed(2),
        })),
      }
    : {
        amount: "",
        description: "",
        category: null as (typeof transactionCategories)[number] | null,
        payerId: "",
        transactionDate: new Date(),
        splits: [] as { recipientId: string; amount: string }[],
      };

  const form = useForm({
    resolver: zodResolver(createTransactionFormSchema),
    defaultValues,
  });

  const createTransactionMutation = api.group.createTransaction.useMutation();
  const updateTransactionMutation = api.group.updateTransaction.useMutation();
  const activeMutation = isEditMode ? updateTransactionMutation : createTransactionMutation;
  const formRef = useRef<HTMLFormElement>(null);

  const { fields, replace, append, remove } = useFieldArray({
    control: form.control,
    name: "splits",
  });

  const watchedAmount = form.watch("amount");
  const watchedSplits = form.watch("splits");
  const watchedPayerId = form.watch("payerId");

  const selectedMemberIds = new Set(fields.map((f) => f.recipientId));

  // Auto-select payer in splits when payer changes (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (!watchedPayerId) return;
    const currentSplits = form.getValues("splits");
    const alreadyIncluded = currentSplits.some((s) => s.recipientId === watchedPayerId);
    if (!alreadyIncluded) {
      append({ recipientId: watchedPayerId, amount: "" });
    }
  }, [watchedPayerId, form, append, isEditMode]);

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
    const scrollTop = formRef.current?.scrollTop ?? 0;
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
    // Restore scroll position after React re-renders the split rows
    requestAnimationFrame(() => {
      if (formRef.current) formRef.current.scrollTop = scrollTop;
    });
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

      const basePayload = {
        groupId,
        amount: amountValue,
        description: values.description,
        category: values.category,
        receiptUrl: receipt.url,
        payerId: values.payerId,
        transactionDate: values.transactionDate,
        transactionDetails: splitValues,
      };

      const result = isEditMode
        ? await updateTransactionMutation.mutateAsync({
            ...basePayload,
            transactionId: editTransaction.id,
          })
        : await createTransactionMutation.mutateAsync(basePayload);

      if (result.error) {
        setTransactionError(result.error.message);
      } else {
        setOpen(false);
        void utils.group.getGroupBySlug.invalidate();
        void utils.group.getGroupTransactions.invalidate();
        form.reset();
        activeMutation.reset();
        setTransactionError(null);
      }
    } catch (error) {
      console.error("Transaction error:", error);
      setTransactionError("An unexpected error occurred. Please try again.");
    }
  };

  const resetModal = () => {
    form.reset(defaultValues);
    setTransactionError(null);
    receipt.reset();
    activeMutation.reset();
  };

  const totalSplitAmount = watchedSplits.reduce(
    (sum, split) => sum + (parseFloat(split.amount) || 0),
    0,
  );
  const amountValue = parseFloat(watchedAmount || "0");
  const amountDifference = amountValue - totalSplitAmount;
  const allSelected =
    groupMembers.length > 0 && groupMembers.every((m) => selectedMemberIds.has(m.id));

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
      {!isEditMode && (
        <DialogTrigger asChild>
          <Button className="">
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Transaction" : "Create New Transaction"}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the transaction details"
              : "Add a new expense to split between group members"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(handleSubmit)}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto"
          >
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
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal", {
                              "text-muted-foreground": !field.value,
                            })}
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
                          onSelect={(date) => {
                            field.onChange(date);
                            setDatePickerOpen(false);
                          }}
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === "none" ? null : val)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
                        {transactionCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {transactionCategoryLabels[cat as TransactionCategory]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>Receipt</FormLabel>
                <input
                  ref={receipt.fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.heic,.pdf"
                  onChange={(e) => {
                    receipt.handleFileChange(e).catch((err: Error) => {
                      setTransactionError(err.message);
                    });
                  }}
                  className="hidden"
                />
                {receipt.error && <p className="text-destructive text-xs">{receipt.error}</p>}
                {receipt.url ? (
                  <div className="border-border flex items-center gap-2 rounded-md border p-2">
                    <FileText className="text-muted-foreground h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {receipt.file?.name ?? "Receipt attached"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={receipt.removeReceipt}
                      disabled={receipt.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : receipt.isPending ? (
                  <div className="border-border flex items-center gap-2 rounded-md border p-2">
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">Uploading...</span>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => receipt.fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Receipt
                  </Button>
                )}
              </div>
            </div>

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
              </div>

              {/* Member Chips */}
              <div className="relative min-w-0 overflow-hidden">
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
                            "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground":
                              !isSelected,
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
                    "border-green-200 bg-green-50 text-green-700":
                      Math.abs(amountDifference) < 0.01,
                    "border-yellow-200 bg-yellow-50 text-yellow-700":
                      Math.abs(amountDifference) >= 0.01,
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
                loading={activeMutation.isPending}
                success={activeMutation.isSuccess && !activeMutation.data?.error}
                successText={isEditMode ? "Transaction Updated!" : "Transaction Created!"}
                disabled={
                  activeMutation.isPending ||
                  (activeMutation.isSuccess && !activeMutation.data?.error)
                }
                className="min-w-[140px]"
              >
                {isEditMode ? "Update Transaction" : "Create Transaction"}
              </AnimatedButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
