import type { Money } from "~/lib/money";

// API-facing balance types — all amounts as Money POCOs
export interface UserBalance {
  totalPaid: Money;
  totalOwed: Money;
  netBalance: Money;
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: Money;
}

export interface BalanceCalculationResult {
  userBalances: Record<string, UserBalance>;
  settlementPlan: Settlement[];
}

// Internal types used by balance calculation (raw integer cents)
export interface RawUserBalance {
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface RawSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface RawBalanceCalculationResult {
  userBalances: Record<string, RawUserBalance>;
  settlementPlan: RawSettlement[];
}
