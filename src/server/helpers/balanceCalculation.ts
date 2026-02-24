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
    // Add to payer's totalPaid
    userBalances[transaction.payerId]!.totalPaid += transaction.amount;

    // Add to each recipient's totalOwed
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

// Helper method for debt simplification algorithm
export function generateSettlementPlan(userBalances: Record<string, UserBalance>): Settlement[] {
  const settlements: Settlement[] = [];

  // Separate creditors (net positive) and debtors (net negative)
  const creditors: Array<{ userId: string; amount: number }> = [];
  const debtors: Array<{ userId: string; amount: number }> = [];

  Object.entries(userBalances).forEach(([userId, balance]) => {
    if (balance.netBalance > 0.01) {
      // Small threshold for floating point precision
      creditors.push({ userId, amount: balance.netBalance });
    } else if (balance.netBalance < -0.01) {
      debtors.push({ userId, amount: Math.abs(balance.netBalance) });
    }
  });

  // Sort creditors and debtors by amount (largest first) for optimal matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  // Greedy algorithm to minimize number of transactions
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]!;
    const debtor = debtors[debtorIndex]!;

    // Settle the minimum of what creditor is owed and debtor owes
    const settlementAmount = Math.min(creditor.amount, debtor.amount);

    // Create settlement: debtor pays creditor
    settlements.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount: parseFloat(settlementAmount.toFixed(2)), // Round to 2 decimal places
    });

    // Reduce amounts
    creditor.amount -= settlementAmount;
    debtor.amount -= settlementAmount;

    // Move to next creditor/debtor if current one is settled
    if (creditor.amount < 0.01) creditorIndex++;
    if (debtor.amount < 0.01) debtorIndex++;
  }

  return settlements;
}
