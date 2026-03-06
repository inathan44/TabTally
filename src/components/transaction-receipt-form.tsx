"use client";

import { Button } from "~/components/ui/button";
import { Users } from "lucide-react";
import type { GroupMember } from "~/server/contracts/groups";
import type { ReceiptData } from "~/server/contracts/receipt";
import type { UseFieldArrayReturn } from "react-hook-form";
import type { CreateTransactionForm } from "./create-transaction-modal";
import TransactionFormFields from "./transaction-form-fields";
import TransactionCustomSplit from "./transaction-custom-split";
import TransactionReceiptPreview from "./transaction-receipt-preview";
import ItemizedSplit from "./itemized-split";

interface TransactionReceiptFormProps {
  groupMembers: GroupMember[];
  parsedReceipt: ReceiptData;
  receiptPreviewUrl: string | null;
  receiptFileName: string;
  splitMode: "custom" | "items";
  onSplitModeChange: (mode: "custom" | "items") => void;
  fields: UseFieldArrayReturn<CreateTransactionForm, "splits">["fields"];
  toggleMember: (memberId: string) => void;
  selectAll: () => void;
  equalSplit: () => void;
  onItemizedSplitsChange: (splits: { recipientId: string; amount: number }[]) => void;
  onReceiptDataChange: (updated: ReceiptData) => void;
}

export default function TransactionReceiptForm({
  groupMembers,
  parsedReceipt,
  receiptPreviewUrl,
  receiptFileName,
  splitMode,
  onSplitModeChange,
  fields,
  toggleMember,
  selectAll,
  equalSplit,
  onItemizedSplitsChange,
  onReceiptDataChange,
}: TransactionReceiptFormProps) {
  return (
    <>
      {/* Receipt image preview */}
      {receiptPreviewUrl && (
        <TransactionReceiptPreview
          previewUrl={receiptPreviewUrl}
          fileName={receiptFileName}
          itemCount={parsedReceipt.items.length}
        />
      )}

      <TransactionFormFields groupMembers={groupMembers} />

      {/* Split Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">Split Between</span>
          </div>
          <div className="flex gap-1 rounded-md border p-0.5">
            <Button
              type="button"
              variant={splitMode === "custom" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSplitModeChange("custom")}
              className="h-auto rounded-sm px-2.5 py-1 text-xs font-medium"
            >
              Custom
            </Button>
            <Button
              type="button"
              variant={splitMode === "items" ? "default" : "ghost"}
              size="sm"
              onClick={() => onSplitModeChange("items")}
              className="h-auto rounded-sm px-2.5 py-1 text-xs font-medium"
            >
              By Items
            </Button>
          </div>
        </div>

        {splitMode === "items" ? (
          <ItemizedSplit
            receiptData={parsedReceipt}
            groupMembers={groupMembers}
            onSplitsChange={onItemizedSplitsChange}
            onReceiptDataChange={onReceiptDataChange}
          />
        ) : (
          <TransactionCustomSplit
            groupMembers={groupMembers}
            fields={fields}
            toggleMember={toggleMember}
            selectAll={selectAll}
            equalSplit={equalSplit}
          />
        )}
      </div>
    </>
  );
}
