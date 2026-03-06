"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Sparkles, ZoomIn } from "lucide-react";

interface TransactionReceiptPreviewProps {
  previewUrl: string;
  fileName: string;
  itemCount: number;
}

export default function TransactionReceiptPreview({
  previewUrl,
  fileName,
  itemCount,
}: TransactionReceiptPreviewProps) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className="border-border flex items-center gap-3 rounded-md border p-2">
        <button
          type="button"
          className="group relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md border"
          onClick={() => setShowLightbox(true)}
        >
          {/* Local blob URL from createObjectURL — next/image requires known remote hosts */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Uploaded receipt" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-4 w-4 text-white" />
          </div>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{fileName}</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            {itemCount} items parsed
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-7 w-7 shrink-0"
          onClick={() => setShowLightbox(true)}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {showLightbox && (
        <Dialog open={showLightbox} onOpenChange={setShowLightbox}>
          <DialogContent className="max-h-[90vh] max-w-lg p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>Receipt Image</DialogTitle>
              <DialogDescription>Full-size view of the uploaded receipt</DialogDescription>
            </DialogHeader>
            {/* Local blob URL from createObjectURL — next/image requires known remote hosts */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Receipt full size"
              className="max-h-[80vh] w-full rounded-md object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
