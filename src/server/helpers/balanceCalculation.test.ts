import { describe, it, expect } from "vitest";
import { calculateGroupBalances, generateSettlementPlan } from "./balanceCalculation";
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
        {
          payerId: "A",
          amount: 30,
          transactionDetails: [
            { recipientId: "A", amount: 10 },
            { recipientId: "B", amount: 10 },
            { recipientId: "C", amount: 10 },
          ],
        },
      ]);
      expect(result.userBalances.A!.netBalance).toBeCloseTo(20);
      expect(result.userBalances.B!.netBalance).toBeCloseTo(-10);
      expect(result.userBalances.C!.netBalance).toBeCloseTo(-10);
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

    it("optimizes circular debt: A→B→C→A", () => {
      // A paid $20 for B, B paid $20 for C, C paid $20 for A
      // Net: A=0, B=0, C=0 → 0 transactions needed
      const result = calculateGroupBalances([
        { payerId: "A", amount: 20, transactionDetails: [{ recipientId: "B", amount: 20 }] },
        { payerId: "B", amount: 20, transactionDetails: [{ recipientId: "C", amount: 20 }] },
        { payerId: "C", amount: 20, transactionDetails: [{ recipientId: "A", amount: 20 }] },
      ]);
      expect(result.settlementPlan).toHaveLength(0);
    });

    it("optimizes partially circular debt", () => {
      // A paid $30 for B, B paid $20 for A
      // A: paid 30, owes 20, net = +10
      // B: paid 20, owes 30, net = -10
      // → 1 transaction: B pays A $10
      const result = calculateGroupBalances([
        { payerId: "A", amount: 30, transactionDetails: [{ recipientId: "B", amount: 30 }] },
        { payerId: "B", amount: 20, transactionDetails: [{ recipientId: "A", amount: 20 }] },
      ]);
      expect(result.settlementPlan).toHaveLength(1);
      expect(result.settlementPlan[0]!.amount).toBeCloseTo(10);
    });

    it("finds optimal partition with 6 people where greedy is suboptimal", () => {
      // Two independent trios that each cancel out:
      // {A=-5, B=-5, C=10} and {D=-3, E=-7, F=10}
      // Optimal: 4 transactions (2 per trio)
      // Greedy (sorted): F gets 10 from... could mix trios and produce 5
      const balances: Record<string, UserBalance> = {
        A: { totalPaid: 0, totalOwed: 5, netBalance: -5 },
        B: { totalPaid: 0, totalOwed: 5, netBalance: -5 },
        C: { totalPaid: 10, totalOwed: 0, netBalance: 10 },
        D: { totalPaid: 0, totalOwed: 3, netBalance: -3 },
        E: { totalPaid: 0, totalOwed: 7, netBalance: -7 },
        F: { totalPaid: 10, totalOwed: 0, netBalance: 10 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(4);
      verifySettlements(balances, settlements);
    });

    it("handles many small transactions between same people", () => {
      // Multiple transactions that accumulate
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 10,
          transactionDetails: [
            { recipientId: "B", amount: 5 },
            { recipientId: "C", amount: 5 },
          ],
        },
        {
          payerId: "B",
          amount: 20,
          transactionDetails: [
            { recipientId: "A", amount: 10 },
            { recipientId: "C", amount: 10 },
          ],
        },
        {
          payerId: "C",
          amount: 15,
          transactionDetails: [
            { recipientId: "A", amount: 5 },
            { recipientId: "B", amount: 10 },
          ],
        },
      ]);
      // A: paid 10, owes 15, net = -5
      // B: paid 20, owes 15, net = +5
      // C: paid 15, owes 15, net = 0
      expect(result.userBalances.A!.netBalance).toBeCloseTo(-5);
      expect(result.userBalances.B!.netBalance).toBeCloseTo(5);
      expect(result.userBalances.C!.netBalance).toBeCloseTo(0);
      expect(result.settlementPlan).toHaveLength(1);
      expect(result.settlementPlan[0]).toEqual({ fromUserId: "A", toUserId: "B", amount: 5 });
    });

    it("handles single person paying for everyone", () => {
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 100,
          transactionDetails: [
            { recipientId: "A", amount: 25 },
            { recipientId: "B", amount: 25 },
            { recipientId: "C", amount: 25 },
            { recipientId: "D", amount: 25 },
          ],
        },
      ]);
      // A: paid 100, owes 25, net = +75
      // B,C,D: each owes 25, net = -25
      expect(result.settlementPlan).toHaveLength(3);
      verifySettlements(result.userBalances, result.settlementPlan);
      result.settlementPlan.forEach((s) => {
        expect(s.toUserId).toBe("A");
        expect(s.amount).toBeCloseTo(25);
      });
    });

    it("handles uneven split with cents", () => {
      // $100 split 3 ways: 33.33, 33.33, 33.34
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 100,
          transactionDetails: [
            { recipientId: "A", amount: 33.33 },
            { recipientId: "B", amount: 33.33 },
            { recipientId: "C", amount: 33.34 },
          ],
        },
      ]);
      expect(result.settlementPlan).toHaveLength(2);
      verifySettlements(result.userBalances, result.settlementPlan);
      const totalSettled = result.settlementPlan.reduce((sum, s) => sum + s.amount, 0);
      expect(totalSettled).toBeCloseTo(66.67);
    });

    it("handles 8-person dinner scenario", () => {
      // Realistic: 3 people paid for different things, 8 people split
      const result = calculateGroupBalances([
        {
          payerId: "Alice",
          amount: 120,
          transactionDetails: [
            { recipientId: "Alice", amount: 15 },
            { recipientId: "Bob", amount: 15 },
            { recipientId: "Carol", amount: 15 },
            { recipientId: "Dave", amount: 15 },
            { recipientId: "Eve", amount: 15 },
            { recipientId: "Frank", amount: 15 },
            { recipientId: "Grace", amount: 15 },
            { recipientId: "Hank", amount: 15 },
          ],
        },
        {
          payerId: "Bob",
          amount: 40,
          transactionDetails: [
            { recipientId: "Alice", amount: 5 },
            { recipientId: "Bob", amount: 5 },
            { recipientId: "Carol", amount: 5 },
            { recipientId: "Dave", amount: 5 },
            { recipientId: "Eve", amount: 5 },
            { recipientId: "Frank", amount: 5 },
            { recipientId: "Grace", amount: 5 },
            { recipientId: "Hank", amount: 5 },
          ],
        },
        {
          payerId: "Carol",
          amount: 24,
          transactionDetails: [
            { recipientId: "Alice", amount: 3 },
            { recipientId: "Bob", amount: 3 },
            { recipientId: "Carol", amount: 3 },
            { recipientId: "Dave", amount: 3 },
            { recipientId: "Eve", amount: 3 },
            { recipientId: "Frank", amount: 3 },
            { recipientId: "Grace", amount: 3 },
            { recipientId: "Hank", amount: 3 },
          ],
        },
      ]);
      // Total per person owes: 15+5+3 = 23
      // Alice: paid 120, owes 23, net = +97
      // Bob: paid 40, owes 23, net = +17
      // Carol: paid 24, owes 23, net = +1
      // Others: paid 0, owes 23, net = -23
      verifySettlements(result.userBalances, result.settlementPlan);
      // With optimization, should find minimum transactions
      // 8 people with non-zero balances, optimal subsets reduce count
      expect(result.settlementPlan.length).toBeLessThanOrEqual(7);
    });
  });
});
