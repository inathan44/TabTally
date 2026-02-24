import { describe, it, expect } from "vitest";
import {
  calculateGroupBalances,
  generateSettlementPlan,
} from "./balanceCalculation";
import type { UserBalance } from "~/server/contracts/balances";

// Helper: verify all balances are settled after applying settlements
function verifySettlements(
  balances: Record<string, UserBalance>,
  settlements: ReturnType<typeof generateSettlementPlan>,
) {
  const netAfter: Record<string, number> = {};
  Object.entries(balances).forEach(([id, b]) => {
    netAfter[id] = b.netBalance;
  });
  settlements.forEach((s) => {
    netAfter[s.fromUserId] = (netAfter[s.fromUserId] ?? 0) + s.amount;
    netAfter[s.toUserId] = (netAfter[s.toUserId] ?? 0) - s.amount;
  });
  Object.values(netAfter).forEach((val) => {
    expect(Math.abs(val)).toBeLessThan(0.02);
  });
}

describe("Balance Calculation", () => {
  describe("calculateGroupBalances", () => {
    it("calculates basic payer/recipient balances", () => {
      const result = calculateGroupBalances([
        { payerId: "A", amount: 30, transactionDetails: [{ recipientId: "A", amount: 10 }, { recipientId: "B", amount: 10 }, { recipientId: "C", amount: 10 }] },
      ]);
      expect(result.userBalances["A"]!.netBalance).toBeCloseTo(20);
      expect(result.userBalances["B"]!.netBalance).toBeCloseTo(-10);
      expect(result.userBalances["C"]!.netBalance).toBeCloseTo(-10);
    });
  });

  describe("generateSettlementPlan", () => {
    it("handles simple chain: A owes B, B owes C → A pays C", () => {
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 5, netBalance: -5 },
        B: { totalPaid: 5, totalOwed: 5, netBalance: 0 },
        C: { totalPaid: 5, totalOwed: 0, netBalance: 5 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({ fromUserId: "A", toUserId: "C", amount: 5 });
    });

    it("handles two independent pairs optimally", () => {
      // A owes B $10, C owes D $20 → 2 transactions (not 3)
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 10, netBalance: -10 },
        B: { totalPaid: 10, totalOwed: 0, netBalance: 10 },
        C: { totalPaid: 0, totalOwed: 20, netBalance: -20 },
        D: { totalPaid: 20, totalOwed: 0, netBalance: 20 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    });

    it("finds fewer transactions than greedy for complex case", () => {
      // Classic case where greedy gives 3 but optimal gives 2:
      // A=-5, B=-5, C=3, D=7
      // Greedy (largest first): D gets 5 from A (D left: 2), D gets 2 from B (B left: 3), C gets 3 from B → 3 transactions
      // Optimal: find subsets {A,B,D} sums to -5+-5+7=-3 nope
      // Let me construct a proper case:
      // A=-3, B=-4, C=3, D=4 → subsets {A,C} and {B,D} each sum to 0 → 2 transactions
      // Greedy: D gets 3 from A (D left: 1), D gets 1 from B (B left: 3), C gets 3 from B → 3 transactions
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 3, netBalance: -3 },
        B: { totalPaid: 0, totalOwed: 4, netBalance: -4 },
        C: { totalPaid: 3, totalOwed: 0, netBalance: 3 },
        D: { totalPaid: 4, totalOwed: 0, netBalance: 4 },
      };
      const settlements = generateSettlementPlan(balances);
      // Optimal: A→C ($3) and B→D ($4) = 2 transactions
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    });

    it("handles all balances already settled", () => {
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 10, totalOwed: 10, netBalance: 0 },
        B: { totalPaid: 5, totalOwed: 5, netBalance: 0 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(0);
    });

    it("handles single debtor single creditor", () => {
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 50, netBalance: -50 },
        B: { totalPaid: 50, totalOwed: 0, netBalance: 50 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({ fromUserId: "A", toUserId: "B", amount: 50 });
    });

    it("handles complex 5-person scenario", () => {
      // A=-10, B=-5, C=8, D=2, E=5
      // Subsets: {B,E} → 0, {A,C,D} → 0 → 3 transactions total (1 + 2)
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 10, netBalance: -10 },
        B: { totalPaid: 0, totalOwed: 5, netBalance: -5 },
        C: { totalPaid: 8, totalOwed: 0, netBalance: 8 },
        D: { totalPaid: 2, totalOwed: 0, netBalance: 2 },
        E: { totalPaid: 5, totalOwed: 0, netBalance: 5 },
      };
      const settlements = generateSettlementPlan(balances);
      // Optimal: 3 transactions (2 subsets: {B,E} needs 1, {A,C,D} needs 2)
      // Greedy would also give 3 here, but the partitioning is different
      expect(settlements).toHaveLength(3);
      verifySettlements(balances, settlements);
    });

    it("handles penny rounding correctly", () => {
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 33.33, netBalance: -33.33 },
        B: { totalPaid: 0, totalOwed: 33.34, netBalance: -33.34 },
        C: { totalPaid: 66.67, totalOwed: 0, netBalance: 66.67 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    });
  });
});
