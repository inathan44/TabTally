import type {
  BalanceCalculationResult,
  Settlement,
  UserBalance,
} from "~/server/contracts/balances";

// Helper method to calculate balances from transaction data
export function calculateGroupBalances(
  transactions: Array<{
    payerId: string;
    amount: number;
    transactionDetails: Array<{
      recipientId: string;
      amount: number;
    }>;
  }>,
): BalanceCalculationResult {
  const userBalances: Record<string, UserBalance> = {};

  // Initialize user balances for all users involved
  const allUserIds = new Set<string>();
  transactions.forEach((transaction) => {
    allUserIds.add(transaction.payerId);
    transaction.transactionDetails.forEach((detail) => {
      allUserIds.add(detail.recipientId);
    });
  });

  allUserIds.forEach((userId) => {
    userBalances[userId] = {
      totalPaid: 0,
      totalOwed: 0,
      netBalance: 0,
    };
  });

  // Calculate totals for each user
  transactions.forEach((transaction) => {
    userBalances[transaction.payerId]!.totalPaid += transaction.amount;
    transaction.transactionDetails.forEach((detail) => {
      userBalances[detail.recipientId]!.totalOwed += detail.amount;
    });
  });

  // Calculate net balances
  Object.values(userBalances).forEach((balance) => {
    balance.netBalance = balance.totalPaid - balance.totalOwed;
  });

  // Generate settlement plan using debt simplification algorithm
  const settlementPlan = generateSettlementPlan(userBalances);

  return {
    userBalances,
    settlementPlan,
  };
}

// Generates a settlement plan that minimizes the number of transactions.
// Uses zero-sum subset partitioning (bitmask DP) for groups ≤ 15 non-zero balances,
// falls back to greedy for larger groups.
export function generateSettlementPlan(userBalances: Record<string, UserBalance>): Settlement[] {
  const entries: Array<{ userId: string; amount: number }> = [];

  Object.entries(userBalances).forEach(([userId, balance]) => {
    if (Math.abs(balance.netBalance) > 0.01) {
      entries.push({ userId, amount: balance.netBalance });
    }
  });

  if (entries.length === 0) return [];

  // Bitmask DP is O(3^n); practical up to ~15 people
  if (entries.length > 15) {
    return greedySettlements(entries);
  }

  return optimalSettlements(entries);
}

// Finds the minimum-transaction settlement via zero-sum subset partitioning.
// n people with non-zero balances need exactly (n - k) transactions,
// where k is the maximum number of independent zero-sum subsets.
function optimalSettlements(entries: Array<{ userId: string; amount: number }>): Settlement[] {
  const n = entries.length;

  // Use integer cents to avoid floating-point comparison issues
  const amountsCents = entries.map((e) => Math.round(e.amount * 100));

  // Compute subset sums for all 2^n subsets
  const subsetSum = new Int32Array(1 << n);
  for (let mask = 1; mask < (1 << n); mask++) {
    const lowestBit = mask & -mask;
    const bitIndex = 31 - Math.clz32(lowestBit);
    subsetSum[mask] = subsetSum[mask ^ lowestBit]! + amountsCents[bitIndex]!;
  }

  // dp[mask] = max number of independent zero-sum subsets within mask
  const dp = new Uint8Array(1 << n);
  for (let mask = 1; mask < (1 << n); mask++) {
    // Enumerate all non-empty submasks
    let sub = mask;
    while (sub > 0) {
      if (subsetSum[sub] === 0 && dp[mask ^ sub]! + 1 > dp[mask]!) {
        dp[mask] = dp[mask ^ sub]! + 1;
      }
      sub = (sub - 1) & mask;
    }
  }

  // Reconstruct the partition into zero-sum groups
  const fullMask = (1 << n) - 1;
  const groups: number[][] = [];
  let remaining = fullMask;

  while (remaining > 0) {
    let sub = remaining;
    while (sub > 0) {
      if (subsetSum[sub] === 0 && dp[remaining] === dp[remaining ^ sub]! + 1) {
        const group: number[] = [];
        let bits = sub;
        while (bits > 0) {
          const bit = bits & -bits;
          group.push(31 - Math.clz32(bit));
          bits ^= bit;
        }
        groups.push(group);
        remaining ^= sub;
        break;
      }
      sub = (sub - 1) & remaining;
    }
  }

  // Within each zero-sum group, greedy produces exactly (groupSize - 1) transactions
  const settlements: Settlement[] = [];
  for (const group of groups) {
    const groupEntries = group.map((i) => ({ userId: entries[i]!.userId, amount: entries[i]!.amount }));
    settlements.push(...greedySettlements(groupEntries));
  }

  return settlements;
}

// Greedy settlement: match largest creditor with largest debtor
function greedySettlements(entries: Array<{ userId: string; amount: number }>): Settlement[] {
  const settlements: Settlement[] = [];
  const creditors: Array<{ userId: string; amount: number }> = [];
  const debtors: Array<{ userId: string; amount: number }> = [];

  entries.forEach((entry) => {
    if (entry.amount > 0.01) {
      creditors.push({ userId: entry.userId, amount: entry.amount });
    } else if (entry.amount < -0.01) {
      debtors.push({ userId: entry.userId, amount: Math.abs(entry.amount) });
    }
  });

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const amount = Math.min(creditor.amount, debtor.amount);

    settlements.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount: parseFloat(amount.toFixed(2)),
    });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount < 0.01) ci++;
    if (debtor.amount < 0.01) di++;
  }

  return settlements;
}
