// Balance calculation types
export interface UserBalance {
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface BalanceCalculationResult {
  userBalances: Record<string, UserBalance>;
  settlementPlan: Settlement[];
}
