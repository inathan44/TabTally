import { z } from "zod";

/** Coerces AI dollar floats to integer cents at the parse boundary */
const dollarsToIntCents = z.number().transform((v) => Math.round(v * 100));

export const receiptItemSchema = z.object({
  name: z.string(),
  price: dollarsToIntCents,
  quantity: z.number().int().default(1),
});

const receiptCategorySchema = z
  .enum([
    "FOOD",
    "HOUSING",
    "TRANSPORTATION",
    "ENTERTAINMENT",
    "UTILITIES",
    "SHOPPING",
    "HEALTH",
    "EDUCATION",
    "TRAVEL",
    "OTHER",
  ])
  .nullable();

export const receiptDataSchema = z.object({
  items: z.array(receiptItemSchema),
  subtotal: dollarsToIntCents,
  tax: dollarsToIntCents,
  tip: dollarsToIntCents,
  total: dollarsToIntCents,
  merchantName: z.string().nullable(),
  date: z.string().nullable(),
  category: receiptCategorySchema,
});

export type ReceiptItem = z.infer<typeof receiptItemSchema>;
export type ReceiptData = z.infer<typeof receiptDataSchema>;

export const receiptImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const receiptUploadMimeTypes = [...receiptImageMimeTypes, "application/pdf"] as const;

export type ReceiptImageMimeType = (typeof receiptImageMimeTypes)[number];
export type ReceiptUploadMimeType = (typeof receiptUploadMimeTypes)[number];

export const parseReceiptInputSchema = z.object({
  groupId: z.number().int().positive(),
  imageBase64: z.string().min(1, "Image data is required"),
  mimeType: z.enum(receiptImageMimeTypes),
});
