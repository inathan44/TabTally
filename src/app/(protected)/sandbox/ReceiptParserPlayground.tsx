"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Receipt, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import type { ReceiptData, ReceiptImageMimeType } from "~/server/contracts/receipt";
import ReceiptParserLoading from "~/components/receipt-parser-loading";

export default function ReceiptParserPlayground() {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: groupsResponse } = api.user.getGroups.useQuery();
  const groups = groupsResponse?.data ?? [];

  const parseMutation = api.group.parseReceipt.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setParsedData(null);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      // Strip data URL prefix to get raw base64
      const base64 = result.split(",")[1] ?? "";
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleParse = async () => {
    if (!imageBase64 || !mimeType || !selectedGroupId) return;

    setError(null);
    setParsedData(null);

    const result = await parseMutation.mutateAsync({
      groupId: selectedGroupId,
      imageBase64,
      mimeType: mimeType as ReceiptImageMimeType,
    });

    if (result.error) {
      setError(result.error.message);
    } else {
      setParsedData(result.data);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setImageBase64(null);
    setMimeType(null);
    setParsedData(null);
    setError(null);
    parseMutation.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Receipt Parser Playground
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Group selector */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Group</label>
          <select
            className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={selectedGroupId ?? ""}
            onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select a group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Upload area */}
        <div className={cn("space-y-2", { hidden: parseMutation.isPending })}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleFileSelect}
            className="hidden"
          />

          {!preview ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-border hover:border-primary/50 hover:bg-muted/30 flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors"
            >
              <Upload className="text-muted-foreground h-8 w-8" />
              <p className="text-sm font-medium">Upload a receipt image</p>
              <p className="text-muted-foreground text-xs">JPEG, PNG, WebP, or HEIC</p>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="border-border max-h-64 w-full rounded-lg border object-contain"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleClear}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleParse}
                  disabled={parseMutation.isPending || !selectedGroupId}
                  className="flex-1"
                >
                  {parseMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    "Parse Receipt"
                  )}
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Change Image
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Loading state */}
        {parseMutation.isPending && <ReceiptParserLoading />}

        {/* Error */}
        {(error ?? parseMutation.error) && (
          <div className="border-destructive/20 bg-destructive/5 rounded-md border p-3">
            <p className="text-destructive text-sm">
              {error ?? parseMutation.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
        )}

        {/* Parsed results */}
        {parsedData && (
          <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-4">
            {parsedData.merchantName && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">Merchant</p>
                <p className="text-sm font-semibold">{parsedData.merchantName}</p>
              </div>
            )}
            {parsedData.date && (
              <div>
                <p className="text-muted-foreground text-xs font-medium">Date</p>
                <p className="text-sm">{parsedData.date}</p>
              </div>
            )}

            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">Items</p>
              <div className="space-y-1">
                {parsedData.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>
                      {item.name}
                      {item.quantity > 1 && (
                        <span className="text-muted-foreground"> ×{item.quantity}</span>
                      )}
                    </span>
                    <span className="font-medium">${item.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-border space-y-1 border-t pt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${parsedData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${parsedData.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tip</span>
                <span>${parsedData.tip.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span>${parsedData.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Raw JSON toggle */}
            <details className="text-xs">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                Raw JSON
              </summary>
              <pre className="bg-muted mt-2 overflow-auto rounded p-2">
                {JSON.stringify(parsedData, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
