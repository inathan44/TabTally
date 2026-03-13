/**
 * Money POCO — a plain data object that serializes over tRPC/JSON.
 * All amounts stored as integer cents.
 */
export type Money = {
  readonly cents: number;
  readonly currency: string;
};

export type ParseMoneyResult =
  | { success: true; money: Money }
  | { success: false };

/**
 * Static utilities for creating, formatting, and operating on Money values.
 * All conversion and formatting logic lives here — callers should never
 * do raw `/ 100`, `* 100`, `.toFixed(2)`, or `parseFloat` on money.
 */
export const M = {
  // --- Factory ---

  fromCents(cents: number, currency = "USD"): Money {
    return { cents: Math.round(cents), currency };
  },

  fromDollars(dollars: number, currency = "USD"): Money {
    return { cents: Math.round(dollars * 100), currency };
  },

  /** Parse a user-entered dollar string (e.g. "10.50") into Money. Returns failure on invalid input. */
  tryFromInput(dollarString: string, currency = "USD"): ParseMoneyResult {
    const parsed = parseFloat(dollarString);
    if (isNaN(parsed) || !isFinite(parsed)) return { success: false };
    return { success: true, money: { cents: Math.round(parsed * 100), currency } };
  },

  zero(currency = "USD"): Money {
    return { cents: 0, currency };
  },

  // --- Display ---

  /** Format as "$10.50" or "-$3.33" */
  toDisplay(m: Money): string {
    const abs = Math.abs(m.cents);
    const dollars = Math.floor(abs / 100);
    const remainderCents = abs % 100;
    const formatted = `$${dollars}.${String(remainderCents).padStart(2, "0")}`;
    return m.cents < 0 ? `-${formatted}` : formatted;
  },

  /** Convert to dollar float (for form default values only) */
  toDollarFloat(m: Money): number {
    return m.cents / 100;
  },

  /** Convert to dollar string "10.50" (for form input values) */
  toDollarString(m: Money): string {
    return (Math.abs(m.cents) / 100).toFixed(2);
  },

  // --- Arithmetic (immutable) ---

  add(a: Money, b: Money): Money {
    return { cents: a.cents + b.cents, currency: a.currency };
  },

  subtract(a: Money, b: Money): Money {
    return { cents: a.cents - b.cents, currency: a.currency };
  },

  negate(m: Money): Money {
    return { cents: -m.cents, currency: m.currency };
  },

  abs(m: Money): Money {
    return { cents: Math.abs(m.cents), currency: m.currency };
  },

  // --- Comparison ---

  isZero(m: Money): boolean {
    return m.cents === 0;
  },

  isNegative(m: Money): boolean {
    return m.cents < 0;
  },

  isPositive(m: Money): boolean {
    return m.cents > 0;
  },

  equals(a: Money, b: Money): boolean {
    return a.cents === b.cents;
  },

  // --- Splitting ---

  /** Split evenly, distributing remainder pennies to first recipients */
  splitEvenly(m: Money, count: number): Money[] {
    if (count <= 0) throw new Error("Split count must be positive");
    const base = Math.floor(m.cents / count);
    const remainder = m.cents % count;
    return Array.from({ length: count }, (_, i) => ({
      cents: base + (i < remainder ? 1 : 0),
      currency: m.currency,
    }));
  },
};

// --- Standalone convenience helpers (thin wrappers) ---

/** Convert a dollar amount to integer cents */
export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format integer cents as "$X.XX" */
export function formatDollars(cents: number): string {
  return M.toDisplay({ cents, currency: "USD" });
}

/** Split totalCents evenly, returning cent amounts */
export function splitCentsEvenly(totalCents: number, count: number): number[] {
  return M.splitEvenly({ cents: totalCents, currency: "USD" }, count).map((m) => m.cents);
}

/** Parse a dollar input string to cents (e.g. "10.50" → 1050). Throws on invalid input — use only after validation. */
export function dollarsToCents(dollarString: string): number {
  const result = M.tryFromInput(dollarString);
  if (!result.success) throw new Error(`Invalid dollar amount: "${dollarString}"`);
  return result.money.cents;
}

/** Parse a dollar input string to cents, returning 0 for invalid input. Safe for live UI (watched form values). */
export function parseDollarsToCents(dollarString: string): number {
  const result = M.tryFromInput(dollarString);
  return result.success ? result.money.cents : 0;
}

/** Convert cents to a dollar form string (e.g. 1050 → "10.50") */
export function centsToFormValue(cents: number): string {
  return M.toDollarString({ cents: Math.abs(cents), currency: "USD" });
}

/** Convert cents to a dollar float (e.g. 1050 → 10.5). For number inputs only. */
export function centsToDollarFloat(cents: number): number {
  return cents / 100;
}

/** Wrap raw integer cents as a Money POCO. Used at API response boundaries. */
export function toMoney(cents: number, currency = "USD"): Money {
  return { cents, currency };
}
