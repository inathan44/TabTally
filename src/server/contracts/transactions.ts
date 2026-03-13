import type { Transaction } from "@prisma/client";
import type { SafeTransactionDetail } from "./transactionDetail";
import type { SafeUser } from "./users";
import type { Money } from "~/lib/money";

export type SafeTransaction = Omit<
  Pick<
    Transaction,
    | "createdAt"
    | "createdById"
    | "title"
    | "id"
    | "isSettlement"
    | "payerId"
    | "updatedAt"
    | "transactionDate"
    | "category"
    | "receiptUrl"
    | "amount"
  >,
  "amount"
> & {
  amount: Money;
  transactionDetails: SafeTransactionDetail[];
  payer: SafeUser;
  createdBy: SafeUser;
};
