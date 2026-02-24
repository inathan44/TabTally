import type { TransactionDetail } from "@prisma/client";
import type { SafeUser } from "./users";
import { z } from "zod";

export type SafeTransactionDetail = Omit<
  Pick<TransactionDetail, "createdAt" | "id" | "recipientId" | "updatedAt">,
  "amount"
> & {
  amount: number; // Convert Decimal to number for client serialization
  recipient: SafeUser;
};

export const createTransactionDetailSchema = z.object({
  amount: z.number().min(0, "Amount must be a positive number"),
  recipientId: z.string(),
});

export type CreateTransactionDetail = z.infer<typeof createTransactionDetailSchema>;
