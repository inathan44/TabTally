"use client";

import { PenLine, ScanLine } from "lucide-react";
import { Button } from "~/components/ui/button";

export type TransactionFlowMode = "picker" | "manual" | "receipt" | "parsing";

interface TransactionFlowPickerProps {
  onSelectMode: (mode: "manual" | "receipt") => void;
}

export default function TransactionFlowPicker({ onSelectMode }: TransactionFlowPickerProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
      <div className="grid w-full grid-cols-2 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelectMode("manual")}
          className="flex h-auto flex-col items-center gap-3 rounded-xl border-2 p-6"
        >
          <div className="bg-primary/10 rounded-full p-3">
            <PenLine className="text-primary h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Manual Entry</p>
            <p className="text-muted-foreground mt-1 text-xs">Enter amounts and split manually</p>
          </div>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelectMode("receipt")}
          className="flex h-auto flex-col items-center gap-3 rounded-xl border-2 p-6"
        >
          <div className="bg-primary/10 rounded-full p-3">
            <ScanLine className="text-primary h-6 w-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Scan Receipt</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Upload a receipt to auto-split items
            </p>
          </div>
        </Button>
      </div>
    </div>
  );
}
