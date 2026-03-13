import type { TransactionDetail } from "@prisma/client";
import type { SafeUser } from "./users";
import type { Money } from "~/lib/money";
import { z } from "zod";

export type SafeTransactionDetail = Omit<
  Pick<TransactionDetail, "createdAt" | "id" | "recipientId" | "updatedAt" | "amount">,
  "amount"
> & {
  amount: Money;
  recipient: SafeUser;
};

export const createTransactionDetailSchema = z.object({
  amount: z.number().int("Amount must be a valid number").nonnegative("Amount must not be negative"),
  recipientId: z.string(),
});

export type CreateTransactionDetail = z.infer<typeof createTransactionDetailSchema>;
