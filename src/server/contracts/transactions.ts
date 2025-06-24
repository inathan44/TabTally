import type { Transaction } from "@prisma/client";
import type { SafeTransactionDetail } from "./transactionDetail";
import type { SafeUser } from "./users";

export type SafeTransaction = Pick<Transaction, "amount" | "createdAt" | "createdById" | "description" | "id" | "payerId" | "updatedAt"> & {
  transactionDetails: SafeTransactionDetail[];
  payer: SafeUser;
  createdBy: SafeUser;
};
