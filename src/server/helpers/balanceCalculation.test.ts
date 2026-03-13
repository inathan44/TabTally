import { describe, it, expect } from "vitest";
import { calculateGroupBalances, generateSettlementPlan } from "./balanceCalculation";
import type { RawUserBalance } from "~/server/contracts/balances";

// Helper: verify all balances are exactly settled after applying settlements.
// All values are in integer cents — no tolerance needed.
function verifySettlements(
  balances: Record<string, RawUserBalance>,
  settlements: ReturnType<typeof generateSettlementPlan>,
) {
  const netCentsAfter: Record<string, number> = {};
  Object.entries(balances).forEach(([id, b]) => {
    netCentsAfter[id] = b.netBalance;
  });
  settlements.forEach((s) => {
    netCentsAfter[s.fromUserId] = (netCentsAfter[s.fromUserId] ?? 0) + s.amount;
    netCentsAfter[s.toUserId] = (netCentsAfter[s.toUserId] ?? 0) - s.amount;
  });
  Object.entries(netCentsAfter).forEach(([userId, cents]) => {
    expect(cents, `${userId} has ${cents}¢ remaining after settlements`).toBe(0);
  });
}

describe("Balance Calculation", () => {
  describe("calculateGroupBalances", () => {
    it("calculates basic payer/recipient balances", () => {
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 3000,
          transactionDetails: [
            { recipientId: "A", amount: 1000 },
            { recipientId: "B", amount: 1000 },
            { recipientId: "C", amount: 1000 },
          ],
        },
      ]);
      expect(result.userBalances.A!.netBalance).toBe(2000);
      expect(result.userBalances.B!.netBalance).toBe(-1000);
      expect(result.userBalances.C!.netBalance).toBe(-1000);
    });
  });

  describe("generateSettlementPlan", () => {
    it("handles simple chain: A owes B, B owes C → A pays C", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 500, netBalance: -500 },
        B: { totalPaid: 500, totalOwed: 500, netBalance: 0 },
        C: { totalPaid: 500, totalOwed: 0, netBalance: 500 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({ fromUserId: "A", toUserId: "C", amount: 500 });
    });

    it("handles two independent pairs optimally", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 1000, netBalance: -1000 },
        B: { totalPaid: 1000, totalOwed: 0, netBalance: 1000 },
        C: { totalPaid: 0, totalOwed: 2000, netBalance: -2000 },
        D: { totalPaid: 2000, totalOwed: 0, netBalance: 2000 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    });

    it("finds fewer transactions than greedy for complex case", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 300, netBalance: -300 },
        B: { totalPaid: 0, totalOwed: 400, netBalance: -400 },
        C: { totalPaid: 300, totalOwed: 0, netBalance: 300 },
        D: { totalPaid: 400, totalOwed: 0, netBalance: 400 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    });

    it("handles all balances already settled", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 1000, totalOwed: 1000, netBalance: 0 },
        B: { totalPaid: 500, totalOwed: 500, netBalance: 0 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(0);
    });

    it("handles single debtor single creditor", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 5000, netBalance: -5000 },
        B: { totalPaid: 5000, totalOwed: 0, netBalance: 5000 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(1);
      expect(settlements[0]).toEqual({ fromUserId: "A", toUserId: "B", amount: 5000 });
    });

    it("handles complex 5-person scenario", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 1000, netBalance: -1000 },
        B: { totalPaid: 0, totalOwed: 500, netBalance: -500 },
        C: { totalPaid: 800, totalOwed: 0, netBalance: 800 },
        D: { totalPaid: 200, totalOwed: 0, netBalance: 200 },
        E: { totalPaid: 500, totalOwed: 0, netBalance: 500 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(3);
      verifySettlements(balances, settlements);
    });

    it("handles penny rounding correctly", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 3333, netBalance: -3333 },
        B: { totalPaid: 0, totalOwed: 3334, netBalance: -3334 },
        C: { totalPaid: 6667, totalOwed: 0, netBalance: 6667 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    });

    it("optimizes circular debt: A→B→C→A", () => {
      const result = calculateGroupBalances([
        { payerId: "A", amount: 2000, transactionDetails: [{ recipientId: "B", amount: 2000 }] },
        { payerId: "B", amount: 2000, transactionDetails: [{ recipientId: "C", amount: 2000 }] },
        { payerId: "C", amount: 2000, transactionDetails: [{ recipientId: "A", amount: 2000 }] },
      ]);
      expect(result.settlementPlan).toHaveLength(0);
    });

    it("optimizes partially circular debt", () => {
      const result = calculateGroupBalances([
        { payerId: "A", amount: 3000, transactionDetails: [{ recipientId: "B", amount: 3000 }] },
        { payerId: "B", amount: 2000, transactionDetails: [{ recipientId: "A", amount: 2000 }] },
      ]);
      expect(result.settlementPlan).toHaveLength(1);
      expect(result.settlementPlan[0]!.amount).toBe(1000);
    });

    it("finds optimal partition with 6 people where greedy is suboptimal", () => {
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 0, totalOwed: 500, netBalance: -500 },
        B: { totalPaid: 0, totalOwed: 500, netBalance: -500 },
        C: { totalPaid: 1000, totalOwed: 0, netBalance: 1000 },
        D: { totalPaid: 0, totalOwed: 300, netBalance: -300 },
        E: { totalPaid: 0, totalOwed: 700, netBalance: -700 },
        F: { totalPaid: 1000, totalOwed: 0, netBalance: 1000 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(4);
      verifySettlements(balances, settlements);
    });

    it("handles many small transactions between same people", () => {
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 1000,
          transactionDetails: [
            { recipientId: "B", amount: 500 },
            { recipientId: "C", amount: 500 },
          ],
        },
        {
          payerId: "B",
          amount: 2000,
          transactionDetails: [
            { recipientId: "A", amount: 1000 },
            { recipientId: "C", amount: 1000 },
          ],
        },
        {
          payerId: "C",
          amount: 1500,
          transactionDetails: [
            { recipientId: "A", amount: 500 },
            { recipientId: "B", amount: 1000 },
          ],
        },
      ]);
      expect(result.userBalances.A!.netBalance).toBe(-500);
      expect(result.userBalances.B!.netBalance).toBe(500);
      expect(result.userBalances.C!.netBalance).toBe(0);
      expect(result.settlementPlan).toHaveLength(1);
      expect(result.settlementPlan[0]).toEqual({ fromUserId: "A", toUserId: "B", amount: 500 });
    });

    it("handles single person paying for everyone", () => {
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 10000,
          transactionDetails: [
            { recipientId: "A", amount: 2500 },
            { recipientId: "B", amount: 2500 },
            { recipientId: "C", amount: 2500 },
            { recipientId: "D", amount: 2500 },
          ],
        },
      ]);
      expect(result.settlementPlan).toHaveLength(3);
      verifySettlements(result.userBalances, result.settlementPlan);
      result.settlementPlan.forEach((s) => {
        expect(s.toUserId).toBe("A");
        expect(s.amount).toBe(2500);
      });
    });

    it("handles uneven split with cents", () => {
      // $100 split 3 ways: 3334¢ + 3333¢ + 3333¢ = 10000¢
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 10000,
          transactionDetails: [
            { recipientId: "A", amount: 3334 },
            { recipientId: "B", amount: 3333 },
            { recipientId: "C", amount: 3333 },
          ],
        },
      ]);
      expect(result.settlementPlan).toHaveLength(2);
      verifySettlements(result.userBalances, result.settlementPlan);
      const totalSettled = result.settlementPlan.reduce((sum, s) => sum + s.amount, 0);
      expect(totalSettled).toBe(6666);
    });

    it("does not hang on uneven 3-way split ($10 / 3) and settles exactly", () => {
      // With cents-everywhere, splits are already exact: 334 + 333 + 333 = 1000
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 1000,
          transactionDetails: [
            { recipientId: "A", amount: 334 },
            { recipientId: "B", amount: 333 },
            { recipientId: "C", amount: 333 },
          ],
        },
      ]);
      expect(result.settlementPlan).toHaveLength(2);
      verifySettlements(result.userBalances, result.settlementPlan);
    }, 2000);

    it("does not hang on uneven 3-way split ($1 / 3) and settles exactly", () => {
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 100,
          transactionDetails: [
            { recipientId: "A", amount: 34 },
            { recipientId: "B", amount: 33 },
            { recipientId: "C", amount: 33 },
          ],
        },
      ]);
      expect(result.settlementPlan).toHaveLength(2);
      verifySettlements(result.userBalances, result.settlementPlan);
    }, 2000);

    it("does not hang on uneven 7-way split", () => {
      // 10000 / 7 = 1428 * 7 = 9996, remainder 4
      // First 4 get 1429, last 3 get 1428
      const details = Array.from({ length: 7 }, (_, i) => ({
        recipientId: String.fromCharCode(65 + i),
        amount: i < 4 ? 1429 : 1428,
      }));
      const result = calculateGroupBalances([
        { payerId: "A", amount: 10000, transactionDetails: details },
      ]);
      expect(result.settlementPlan.length).toBeGreaterThan(0);
      verifySettlements(result.userBalances, result.settlementPlan);
    }, 2000);

    it("does not hang with multiple uneven transactions compounding rounding", () => {
      // $10/3: 334+333+333=1000, $7/3: 234+233+233=700
      const result = calculateGroupBalances([
        {
          payerId: "A",
          amount: 1000,
          transactionDetails: [
            { recipientId: "A", amount: 334 },
            { recipientId: "B", amount: 333 },
            { recipientId: "C", amount: 333 },
          ],
        },
        {
          payerId: "B",
          amount: 700,
          transactionDetails: [
            { recipientId: "A", amount: 234 },
            { recipientId: "B", amount: 233 },
            { recipientId: "C", amount: 233 },
          ],
        },
      ]);
      expect(result.settlementPlan.length).toBeGreaterThanOrEqual(1);
      verifySettlements(result.userBalances, result.settlementPlan);
    }, 2000);

    it("handles legacy non-zero-sum balances safely", () => {
      // Simulates legacy data where rounding gap exists.
      // The gap redistribution in generateSettlementPlan handles this.
      const balances: Record<string, RawUserBalance> = {
        A: { totalPaid: 1000, totalOwed: 333, netBalance: 667 },
        B: { totalPaid: 0, totalOwed: 333, netBalance: -333 },
        C: { totalPaid: 0, totalOwed: 333, netBalance: -333 },
      };
      const settlements = generateSettlementPlan(balances);
      expect(settlements).toHaveLength(2);
      verifySettlements(balances, settlements);
    }, 2000);

    it("handles 8-person dinner scenario", () => {
      const result = calculateGroupBalances([
        {
          payerId: "Alice",
          amount: 12000,
          transactionDetails: [
            { recipientId: "Alice", amount: 1500 },
            { recipientId: "Bob", amount: 1500 },
            { recipientId: "Carol", amount: 1500 },
            { recipientId: "Dave", amount: 1500 },
            { recipientId: "Eve", amount: 1500 },
            { recipientId: "Frank", amount: 1500 },
            { recipientId: "Grace", amount: 1500 },
            { recipientId: "Hank", amount: 1500 },
          ],
        },
        {
          payerId: "Bob",
          amount: 4000,
          transactionDetails: [
            { recipientId: "Alice", amount: 500 },
            { recipientId: "Bob", amount: 500 },
            { recipientId: "Carol", amount: 500 },
            { recipientId: "Dave", amount: 500 },
            { recipientId: "Eve", amount: 500 },
            { recipientId: "Frank", amount: 500 },
            { recipientId: "Grace", amount: 500 },
            { recipientId: "Hank", amount: 500 },
          ],
        },
        {
          payerId: "Carol",
          amount: 2400,
          transactionDetails: [
            { recipientId: "Alice", amount: 300 },
            { recipientId: "Bob", amount: 300 },
            { recipientId: "Carol", amount: 300 },
            { recipientId: "Dave", amount: 300 },
            { recipientId: "Eve", amount: 300 },
            { recipientId: "Frank", amount: 300 },
            { recipientId: "Grace", amount: 300 },
            { recipientId: "Hank", amount: 300 },
          ],
        },
      ]);
      verifySettlements(result.userBalances, result.settlementPlan);
      expect(result.settlementPlan.length).toBeLessThanOrEqual(7);
    });
  });
});
