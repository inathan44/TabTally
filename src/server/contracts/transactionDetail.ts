import type { TransactionDetail } from "@prisma/client";
import type { SafeUser } from "./users";

export type SafeTransactionDetail = Pick<
  TransactionDetail,
  "amount" | "createdAt" | "id" | "recipientId" | "updatedAt"
> & {
  recipient: SafeUser;
};
