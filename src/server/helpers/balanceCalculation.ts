import type {
  RawBalanceCalculationResult,
  RawSettlement,
  RawUserBalance,
} from "~/server/contracts/balances";

// All amounts are in integer cents throughout.
export function calculateGroupBalances(
  transactions: Array<{
    payerId: string;
    amount: number;
    transactionDetails: Array<{
      recipientId: string;
      amount: number;
    }>;
  }>,
): RawBalanceCalculationResult {
  const userBalances: Record<string, RawUserBalance> = {};

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

  // Accumulate totals (use absolute values since settlements are stored negative)
  transactions.forEach((transaction) => {
    userBalances[transaction.payerId]!.totalPaid += Math.abs(transaction.amount);
    transaction.transactionDetails.forEach((detail) => {
      userBalances[detail.recipientId]!.totalOwed += Math.abs(detail.amount);
    });
  });

  Object.values(userBalances).forEach((balance) => {
    balance.netBalance = balance.totalPaid - balance.totalOwed;
  });

  const settlementPlan = generateSettlementPlan(userBalances);

  return {
    userBalances,
    settlementPlan,
  };
}

// Generates a settlement plan that minimizes the number of transactions.
// Uses zero-sum subset partitioning (bitmask DP) for groups ≤ 15 non-zero balances,
// falls back to greedy for larger groups.
// Input balances are already in integer cents.
export function generateSettlementPlan(userBalances: Record<string, RawUserBalance>): RawSettlement[] {
  const entries: Array<{ userId: string; cents: number }> = [];

  Object.entries(userBalances).forEach(([userId, balance]) => {
    if (Math.abs(balance.netBalance) >= 1) {
      entries.push({ userId, cents: balance.netBalance });
    }
  });

  if (entries.length === 0) return [];

  // Ensure entries are zero-sum. Rounding at input boundaries can introduce a gap.
  // Distribute the gap across the largest entries to preserve fairness.
  const totalCents = entries.reduce((s, e) => s + e.cents, 0);
  if (totalCents !== 0) {
    const step = totalCents > 0 ? -1 : 1;
    const sorted = [...entries].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
    let remaining = Math.abs(totalCents);
    for (let i = 0; remaining > 0 && i < sorted.length; i++) {
      sorted[i]!.cents += step;
      userBalances[sorted[i]!.userId]!.netBalance = sorted[i]!.cents;
      remaining--;
    }
  }

  if (entries.length > 15) {
    return greedySettlements(entries);
  }

  return optimalSettlements(entries);
}

// Finds the minimum-transaction settlement via zero-sum subset partitioning.
// n people with non-zero balances need exactly (n - k) transactions,
// where k is the maximum number of independent zero-sum subsets.
function optimalSettlements(entries: Array<{ userId: string; cents: number }>): RawSettlement[] {
  const n = entries.length;
  const amountsCents = entries.map((e) => e.cents);

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
    const prevRemaining = remaining;
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
    // Safety: if no zero-sum subset was found (rounding made total ≠ 0),
    // treat all remaining entries as one group and settle greedily
    if (remaining === prevRemaining) {
      const group: number[] = [];
      let bits = remaining;
      while (bits > 0) {
        const bit = bits & -bits;
        group.push(31 - Math.clz32(bit));
        bits ^= bit;
      }
      groups.push(group);
      break;
    }
  }

  // Within each zero-sum group, greedy produces exactly (groupSize - 1) transactions
  const settlements: RawSettlement[] = [];
  for (const group of groups) {
    const groupEntries = group.map((i) => ({ userId: entries[i]!.userId, cents: entries[i]!.cents }));
    settlements.push(...greedySettlements(groupEntries));
  }

  return settlements;
}

// Greedy settlement in integer cents: match largest creditor with largest debtor.
// Expects zero-sum input (gap already balanced by generateSettlementPlan).
function greedySettlements(entries: Array<{ userId: string; cents: number }>): RawSettlement[] {
  const settlements: RawSettlement[] = [];
  const creditors: Array<{ userId: string; cents: number }> = [];
  const debtors: Array<{ userId: string; cents: number }> = [];

  entries.forEach((entry) => {
    if (entry.cents > 0) {
      creditors.push({ userId: entry.userId, cents: entry.cents });
    } else if (entry.cents < 0) {
      debtors.push({ userId: entry.userId, cents: -entry.cents });
    }
  });

  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const cents = Math.min(creditor.cents, debtor.cents);

    if (cents > 0) {
      settlements.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: cents,
      });
    }

    creditor.cents -= cents;
    debtor.cents -= cents;

    if (creditor.cents === 0) ci++;
    if (debtor.cents === 0) di++;
  }

  return settlements;
}
