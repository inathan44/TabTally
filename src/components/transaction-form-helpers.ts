import type { TransactionFlowMode } from "./transaction-flow-picker";

export function getDialogDescription(isEditMode: boolean, flowMode: TransactionFlowMode): string {
  if (isEditMode) return "Update the transaction details";

  switch (flowMode) {
    case "picker":
      return "Choose how you want to add this expense";
    case "manual":
      return "Enter the expense details and split manually";
    case "parsing":
      return "Analyzing your receipt...";
    case "receipt":
      return "Review the parsed receipt and split items";
  }
}

export function getUploadErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to process receipt. Please try again.";

  // tRPC Zod validation errors come as JSON arrays in the message
  try {
    const parsed: unknown = JSON.parse(err.message);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0] as { code?: string; received?: string };
      if (first.code === "invalid_enum_value" && first.received) {
        return `Unsupported file type: ${first.received}. Please use JPG, PNG, WebP, or HEIC.`;
      }
      return "Invalid file. Please upload a JPG, PNG, WebP, or HEIC image.";
    }
  } catch {
    // Not JSON — use the message directly
  }

  return err.message;
}
