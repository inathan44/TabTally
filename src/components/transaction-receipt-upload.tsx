"use client";

import { Button } from "~/components/ui/button";
import { FileText, Loader2, ScanLine, Sparkles, X } from "lucide-react";
import type { ReceiptData } from "~/server/contracts/receipt";
import type { useReceiptUpload } from "~/hooks/use-receipt-upload";
import ReceiptParserLoading from "./receipt-parser-loading";

interface TransactionReceiptUploadProps {
  receipt: ReturnType<typeof useReceiptUpload>;
  parsedReceipt: ReceiptData | null;
  isParsing: boolean;
  onParse: () => void;
  onRemove: () => void;
}

export default function TransactionReceiptUpload({
  receipt,
  parsedReceipt,
  isParsing,
  onParse,
  onRemove,
}: TransactionReceiptUploadProps) {
  return (
    <div className="space-y-3">
      {receipt.error && <p className="text-destructive text-xs">{receipt.error}</p>}
      {receipt.url ? (
        <div className="space-y-2">
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
              onClick={onRemove}
              disabled={receipt.isPending || isParsing}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {!parsedReceipt && !isParsing && receipt.file && (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={onParse}>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Parse Receipt with AI
            </Button>
          )}
          {parsedReceipt && (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Receipt parsed — {parsedReceipt.items.length} items found
            </p>
          )}
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
          onClick={() => receipt.fileInputRef.current?.click()}
          className="flex h-auto w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8"
        >
          <div className="bg-primary/10 rounded-full p-3">
            <ScanLine className="text-primary h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Upload Receipt Image</p>
            <p className="text-muted-foreground mt-1 text-xs">
              JPG, PNG, or HEIC — we&apos;ll extract the items automatically
            </p>
          </div>
        </Button>
      )}

      {isParsing && <ReceiptParserLoading />}
    </div>
  );
}
