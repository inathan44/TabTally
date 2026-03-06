"use client";

import { Receipt } from "lucide-react";

/**
 * Placeholder component for receipt parsing UI.
 * Will be fleshed out with:
 * - Image upload/camera capture
 * - Parse button that calls parseReceipt mutation
 * - Parsed receipt data display (items, tax, tip, total)
 * - Auto-fill transaction form from parsed data
 * - Entry point to itemized split mode
 */
export default function ReceiptParserPlaceholder() {
  return (
    <div className="border-border rounded-xl border-2 border-dashed px-6 py-8 text-center">
      <Receipt className="text-muted-foreground/60 mx-auto h-8 w-8" />
      <p className="text-foreground mt-3 text-sm font-medium">Receipt Parser</p>
      <p className="text-muted-foreground mt-1 text-xs">
        Upload a receipt to automatically extract line items, tax, tip, and totals.
      </p>
      <p className="text-muted-foreground/60 mt-2 text-xs">Coming soon</p>
    </div>
  );
}
