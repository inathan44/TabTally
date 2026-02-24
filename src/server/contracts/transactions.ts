import type { Transaction } from "@prisma/client";
import type { SafeTransactionDetail } from "./transactionDetail";
import type { SafeUser } from "./users";

export type SafeTransaction = Omit<
  Pick<
    Transaction,
    "createdAt" | "createdById" | "description" | "id" | "payerId" | "updatedAt" | "transactionDate"
  >,
  "amount"
> & {
  amount: number; // Convert Decimal to number for client serialization
  transactionDetails: SafeTransactionDetail[];
  payer: SafeUser;
  createdBy: SafeUser;
};
