"use client";

import { Button } from "~/components/ui/button";
import { FormLabel } from "~/components/ui/form";
import { FileText, Upload, Loader2, X } from "lucide-react";
import type { GroupMember } from "~/server/contracts/groups";
import type { useReceiptUpload } from "~/hooks/use-receipt-upload";
import type { UseFieldArrayReturn } from "react-hook-form";
import type { CreateTransactionForm } from "./create-transaction-modal";
import TransactionFormFields from "./transaction-form-fields";
import TransactionCustomSplit from "./transaction-custom-split";

interface TransactionManualFormProps {
  groupMembers: GroupMember[];
  receipt: ReturnType<typeof useReceiptUpload>;
  fields: UseFieldArrayReturn<CreateTransactionForm, "splits">["fields"];
  toggleMember: (memberId: string) => void;
  selectAll: () => void;
  equalSplit: () => void;
}

export default function TransactionManualForm({
  groupMembers,
  receipt,
  fields,
  toggleMember,
  selectAll,
  equalSplit,
}: TransactionManualFormProps) {
  const renderReceiptStatus = () => {
    if (receipt.url) {
      return (
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
            onClick={() => receipt.removeReceipt()}
            disabled={receipt.isPending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    if (receipt.isPending) {
      return (
        <div className="border-border flex items-center gap-2 rounded-md border p-2">
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          <span className="text-muted-foreground text-sm">Uploading...</span>
        </div>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => receipt.fileInputRef.current?.click()}
      >
        <Upload className="mr-2 h-4 w-4" />
        Upload Receipt
      </Button>
    );
  };

  return (
    <>
      <TransactionFormFields groupMembers={groupMembers} />

      {/* Receipt attachment (manual mode only) */}
      <div className="space-y-2">
        <FormLabel>Receipt</FormLabel>
        {receipt.error && <p className="text-destructive text-xs">{receipt.error}</p>}
        {renderReceiptStatus()}
      </div>

      {/* Split Section */}
      <TransactionCustomSplit
        groupMembers={groupMembers}
        fields={fields}
        toggleMember={toggleMember}
        selectAll={selectAll}
        equalSplit={equalSplit}
      />
    </>
  );
}
