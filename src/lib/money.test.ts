import { describe, it, expect } from "vitest";
import {
  M,
  toCents,
  formatDollars,
  splitCentsEvenly,
  dollarsToCents,
  parseDollarsToCents,
  centsToFormValue,
  centsToDollarFloat,
} from "./money";
import type { Money } from "./money";

describe("M (Money utilities)", () => {
  describe("factory methods", () => {
    it("fromCents creates correctly", () => {
      const m = M.fromCents(1050);
      expect(m.cents).toBe(1050);
      expect(M.toDollarFloat(m)).toBe(10.5);
    });

    it("fromDollars converts correctly", () => {
      const m = M.fromDollars(10.5);
      expect(m.cents).toBe(1050);
    });

    it("fromDollars rounds to nearest cent", () => {
      const m = M.fromDollars(10.555);
      expect(m.cents).toBe(1056);
    });

    it("fromDollars handles $10/3 correctly", () => {
      const m = M.fromDollars(10 / 3);
      expect(m.cents).toBe(333);
    });

    it("tryFromInput parses dollar strings", () => {
      const ok = M.tryFromInput("10.50");
      expect(ok.success).toBe(true);
      if (ok.success) expect(ok.money.cents).toBe(1050);

      const zero = M.tryFromInput("0");
      expect(zero.success).toBe(true);
      if (zero.success) expect(zero.money.cents).toBe(0);

      expect(M.tryFromInput("abc").success).toBe(false);
      expect(M.tryFromInput("").success).toBe(false);
      expect(M.tryFromInput("Infinity").success).toBe(false);
    });

    it("zero creates zero money", () => {
      expect(M.zero().cents).toBe(0);
    });

    it("handles negative amounts", () => {
      const m = M.fromDollars(-5.5);
      expect(m.cents).toBe(-550);
    });
  });

  describe("display", () => {
    it("displays positive amounts", () => {
      expect(M.toDisplay(M.fromCents(1050))).toBe("$10.50");
      expect(M.toDisplay(M.fromCents(1000))).toBe("$10.00");
      expect(M.toDisplay(M.fromCents(5))).toBe("$0.05");
      expect(M.toDisplay(M.fromCents(0))).toBe("$0.00");
    });

    it("displays negative amounts", () => {
      expect(M.toDisplay(M.fromCents(-333))).toBe("-$3.33");
      expect(M.toDisplay(M.fromCents(-1050))).toBe("-$10.50");
    });

    it("displays large amounts", () => {
      expect(M.toDisplay(M.fromCents(100000))).toBe("$1000.00");
    });

    it("toDollarString for form values", () => {
      expect(M.toDollarString(M.fromCents(1050))).toBe("10.50");
      expect(M.toDollarString(M.fromCents(500))).toBe("5.00");
    });
  });

  describe("arithmetic", () => {
    it("adds correctly", () => {
      const a = M.fromCents(1050);
      const b = M.fromCents(333);
      expect(M.add(a, b).cents).toBe(1383);
    });

    it("subtracts correctly", () => {
      const a = M.fromCents(1050);
      const b = M.fromCents(333);
      expect(M.subtract(a, b).cents).toBe(717);
    });

    it("negates correctly", () => {
      expect(M.negate(M.fromCents(500)).cents).toBe(-500);
      expect(M.negate(M.fromCents(-500)).cents).toBe(500);
    });

    it("abs works correctly", () => {
      expect(M.abs(M.fromCents(-500)).cents).toBe(500);
      expect(M.abs(M.fromCents(500)).cents).toBe(500);
    });
  });

  describe("comparison", () => {
    it("isZero", () => {
      expect(M.isZero(M.zero())).toBe(true);
      expect(M.isZero(M.fromCents(1))).toBe(false);
    });

    it("isNegative / isPositive", () => {
      expect(M.isNegative(M.fromCents(-1))).toBe(true);
      expect(M.isPositive(M.fromCents(1))).toBe(true);
      expect(M.isNegative(M.zero())).toBe(false);
      expect(M.isPositive(M.zero())).toBe(false);
    });

    it("equals", () => {
      expect(M.equals(M.fromCents(100), M.fromCents(100))).toBe(true);
      expect(M.equals(M.fromCents(100), M.fromCents(101))).toBe(false);
    });
  });

  describe("splitEvenly", () => {
    it("splits evenly when divisible", () => {
      const parts = M.splitEvenly(M.fromCents(900), 3);
      expect(parts.map((p) => p.cents)).toEqual([300, 300, 300]);
    });

    it("distributes remainder for $10/3", () => {
      const parts = M.splitEvenly(M.fromCents(1000), 3);
      expect(parts.map((p) => p.cents)).toEqual([334, 333, 333]);
      expect(parts.reduce((s, p) => s + p.cents, 0)).toBe(1000);
    });

    it("distributes remainder for $1/3", () => {
      const parts = M.splitEvenly(M.fromCents(100), 3);
      expect(parts.map((p) => p.cents)).toEqual([34, 33, 33]);
      expect(parts.reduce((s, p) => s + p.cents, 0)).toBe(100);
    });

    it("handles 7-way split", () => {
      const parts = M.splitEvenly(M.fromCents(10000), 7);
      const sum = parts.reduce((s, p) => s + p.cents, 0);
      expect(sum).toBe(10000);
      expect(parts[0]!.cents).toBe(1429);
      expect(parts[6]!.cents).toBe(1428);
    });

    it("handles single person", () => {
      const parts = M.splitEvenly(M.fromCents(1050), 1);
      expect(parts.map((p) => p.cents)).toEqual([1050]);
    });

    it("throws for zero count", () => {
      expect(() => M.splitEvenly(M.fromCents(100), 0)).toThrow();
    });
  });

  describe("Money type serialization", () => {
    it("serializes to plain JSON", () => {
      const m: Money = M.fromCents(1050);
      const json = JSON.stringify(m);
      const parsed = JSON.parse(json) as Money;
      expect(parsed.cents).toBe(1050);
      expect(parsed.currency).toBe("USD");
      expect(M.toDisplay(parsed)).toBe("$10.50");
    });
  });
});

describe("standalone helpers", () => {
  it("toCents converts dollars to cents", () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents(10 / 3)).toBe(333);
    expect(toCents(0)).toBe(0);
  });

  it("formatDollars formats cents as dollar string", () => {
    expect(formatDollars(1050)).toBe("$10.50");
    expect(formatDollars(-333)).toBe("-$3.33");
    expect(formatDollars(0)).toBe("$0.00");
  });

  it("splitCentsEvenly splits and returns cent arrays", () => {
    expect(splitCentsEvenly(1000, 3)).toEqual([334, 333, 333]);
    expect(splitCentsEvenly(900, 3)).toEqual([300, 300, 300]);
  });

  it("dollarsToCents parses strings to cents", () => {
    expect(dollarsToCents("10.50")).toBe(1050);
    expect(dollarsToCents("0.01")).toBe(1);
  });

  it("dollarsToCents throws on invalid input", () => {
    expect(() => dollarsToCents("abc")).toThrow('Invalid dollar amount: "abc"');
    expect(() => dollarsToCents("")).toThrow('Invalid dollar amount: ""');
  });

  it("parseDollarsToCents returns 0 on invalid input (safe for UI)", () => {
    expect(parseDollarsToCents("10.50")).toBe(1050);
    expect(parseDollarsToCents("abc")).toBe(0);
    expect(parseDollarsToCents("")).toBe(0);
    expect(parseDollarsToCents("Infinity")).toBe(0);
  });

  it("centsToFormValue converts cents to form strings", () => {
    expect(centsToFormValue(1050)).toBe("10.50");
    expect(centsToFormValue(5000)).toBe("50.00");
    expect(centsToFormValue(-333)).toBe("3.33");
  });

  it("centsToDollarFloat converts cents to dollar numbers", () => {
    expect(centsToDollarFloat(1050)).toBe(10.5);
    expect(centsToDollarFloat(0)).toBe(0);
    expect(centsToDollarFloat(1)).toBe(0.01);
  });
});
