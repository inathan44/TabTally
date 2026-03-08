"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Form } from "~/components/ui/form";
import { Plus, ArrowLeft, Users } from "lucide-react";
import { api } from "~/trpc/react";
import type { GroupMember } from "~/server/contracts/groups";
import { createTransactionFormSchema } from "~/server/contracts/groups";
import type { SafeTransaction } from "~/server/contracts/transactions";
import type { ReceiptData, ReceiptImageMimeType } from "~/server/contracts/receipt";
import { AnimatedButton } from "./ui/animated-button";
import { useReceiptUpload } from "~/hooks/use-receipt-upload";
import TransactionFlowPicker from "./transaction-flow-picker";
import type { TransactionFlowMode } from "./transaction-flow-picker";
import ReceiptParserLoading from "./receipt-parser-loading";
import TransactionManualForm from "./transaction-manual-form";
import TransactionReceiptForm from "./transaction-receipt-form";
import { getDialogDescription, getUploadErrorMessage } from "./transaction-form-helpers";
import { compressImage } from "~/lib/compress-image";

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
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const receipt = useReceiptUpload({
    groupId,
    initialUrl: isEditMode ? (editTransaction.receiptUrl ?? null) : null,
  });

  const [parsedReceipt, setParsedReceipt] = useState<ReceiptData | null>(null);
  const [splitMode, setSplitMode] = useState<"custom" | "items">("custom");
  const [flowMode, setFlowMode] = useState<TransactionFlowMode>(isEditMode ? "manual" : "picker");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const parseReceiptMutation = api.group.parseReceipt.useMutation();

  // Fallback for uncontrolled mode — no-op is intentional when onOpenChange isn't provided
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = () => {};
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? noop) : setInternalOpen;

  const defaultValues = isEditMode
    ? {
        amount: Math.abs(Number(editTransaction.amount)).toFixed(2),
        title: editTransaction.title,
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
        title: "",
        category: null as CreateTransactionForm["category"],
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

  const watchedPayerId = form.watch("payerId");

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
    const selectedMemberIds = new Set(fields.map((f) => f.recipientId));
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
    const selectedMemberIds = new Set(fields.map((f) => f.recipientId));
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

  const handleParseReceipt = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const mimeType = file.type as ReceiptImageMimeType;
      const result = await parseReceiptMutation.mutateAsync({
        groupId,
        imageBase64: base64,
        mimeType,
      });

      if (result.data) {
        setParsedReceipt(result.data);
        form.setValue("amount", result.data.total.toFixed(2));
        if (result.data.merchantName) {
          form.setValue("title", result.data.merchantName);
        }
        if (result.data.category) {
          form.setValue("category", result.data.category);
        }
        if (result.data.date) {
          const parsed = new Date(result.data.date + "T12:00:00");
          if (!isNaN(parsed.getTime())) {
            form.setValue("transactionDate", parsed);
          }
        }
        setSplitMode("items");
        setFlowMode("receipt");
      } else if (result.error) {
        setTransactionError(result.error.message);
        setFlowMode("picker");
      }
    },
    [groupId, parseReceiptMutation, form, setTransactionError],
  );

  const handleItemizedSplitsChange = useCallback(
    (splits: { recipientId: string; amount: number }[]) => {
      replace(
        splits.map((s) => ({
          recipientId: s.recipientId,
          amount: s.amount.toFixed(2),
        })),
      );
    },
    [replace],
  );

  const handleReceiptDataChange = useCallback(
    (updated: ReceiptData) => {
      const newTotal = updated.subtotal + updated.tax + updated.tip;
      form.setValue("amount", newTotal.toFixed(2));
    },
    [form],
  );

  const handleSubmit = async (values: CreateTransactionForm) => {
    try {
      setTransactionError(null);

      const amountValue = parseFloat(values.amount);
      const splitValues = values.splits.map((split) => ({
        recipientId: split.recipientId,
        amount: parseFloat(split.amount),
      }));

      const totalSplitCents = splitValues.reduce((sum, split) => sum + Math.round(split.amount * 100), 0);
      const totalAmountCents = Math.round(amountValue * 100);
      if (totalSplitCents !== totalAmountCents) {
        setTransactionError(
          `Split amounts ($${(totalSplitCents / 100).toFixed(2)}) must equal the total amount ($${amountValue.toFixed(2)})`,
        );
        return;
      }

      const basePayload = {
        groupId,
        amount: amountValue,
        title: values.title,
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
    setParsedReceipt(null);
    setSplitMode("custom");
    setFlowMode(isEditMode ? "manual" : "picker");
    setReceiptPreviewUrl(null);
    parseReceiptMutation.reset();
  };

  const handleReceiptFlowStart = () => {
    if (receipt.fileInputRef.current) {
      receipt.fileInputRef.current.value = "";
    }
    receipt.fileInputRef.current?.click();
  };

  const handleSwitchFlow = () => {
    if (flowMode === "receipt") {
      setSplitMode("custom");
      setFlowMode("manual");
    } else if (parsedReceipt) {
      setSplitMode("items");
      setFlowMode("receipt");
    } else {
      handleReceiptFlowStart();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetModal();
      }}
    >
      {!isEditMode && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Transaction" : "Create New Transaction"}</DialogTitle>
          <DialogDescription>{getDialogDescription(isEditMode, flowMode)}</DialogDescription>
        </DialogHeader>

        {/* Hidden file input — outside form so it's always in DOM */}
        <input
          ref={receipt.fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.heic"
          capture="environment"
          onChange={(e) => {
            const rawFile = e.target.files?.[0];
            if (!rawFile) return;
            setReceiptPreviewUrl(URL.createObjectURL(rawFile));
            setFlowMode("parsing");

            // Compress for storage upload, then compress further for AI parsing
            compressImage(rawFile, { maxDimension: 2000, quality: 0.85 })
              .then((uploadFile) =>
                receipt
                  .uploadFile(uploadFile)
                  .then(() => compressImage(rawFile, { maxDimension: 1500, quality: 0.7 })),
              )
              .then((parseFile) => handleParseReceipt(parseFile))
              .catch((err: unknown) => {
                const message = getUploadErrorMessage(err);
                setTransactionError(message);
                setReceiptPreviewUrl(null);
                setFlowMode("picker");
              });
          }}
          className="hidden"
        />

        {flowMode === "picker" && (
          <>
            {transactionError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="text-sm text-red-800">{transactionError}</div>
              </div>
            )}
            <TransactionFlowPicker
              onSelectMode={(mode) => {
                setTransactionError(null);
                if (mode === "receipt") {
                  handleReceiptFlowStart();
                } else {
                  setFlowMode(mode);
                }
              }}
            />
          </>
        )}

        {flowMode === "parsing" && <ReceiptParserLoading />}

        {(flowMode === "manual" || flowMode === "receipt") && (
          <Form {...form}>
            <form
              ref={formRef}
              onSubmit={form.handleSubmit(handleSubmit)}
              className="min-h-0 flex-1 space-y-6 overflow-y-auto"
            >
              {/* Mode switch header */}
              {!isEditMode && (
                <div className="border-border flex items-center gap-3 border-b pb-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFlowMode("picker")}
                    className="text-muted-foreground hover:text-foreground h-7 w-7"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {flowMode === "manual" ? "Manual Entry" : "Scan Receipt"}
                  </span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={handleSwitchFlow}
                    className="text-muted-foreground hover:text-foreground ml-auto h-auto p-0 text-xs underline-offset-4 hover:underline"
                  >
                    Switch to {flowMode === "manual" ? "Receipt Scan" : "Manual Entry"}
                  </Button>
                </div>
              )}

              {flowMode === "manual" && (
                <TransactionManualForm
                  groupMembers={groupMembers}
                  receipt={receipt}
                  fields={fields}
                  toggleMember={toggleMember}
                  selectAll={selectAll}
                  equalSplit={equalSplit}
                />
              )}

              {flowMode === "receipt" && parsedReceipt && (
                <TransactionReceiptForm
                  groupMembers={groupMembers}
                  parsedReceipt={parsedReceipt}
                  receiptPreviewUrl={receiptPreviewUrl}
                  receiptFileName={receipt.file?.name ?? "Receipt attached"}
                  splitMode={splitMode}
                  onSplitModeChange={setSplitMode}
                  fields={fields}
                  toggleMember={toggleMember}
                  selectAll={selectAll}
                  equalSplit={equalSplit}
                  onItemizedSplitsChange={handleItemizedSplitsChange}
                  onReceiptDataChange={handleReceiptDataChange}
                />
              )}

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
        )}
      </DialogContent>
    </Dialog>
  );
}
