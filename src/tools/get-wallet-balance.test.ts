import { describe, it, expect } from "vitest";
import {
  formatWalletBalance,
  findBalanceForCurrency,
  normalizeWalletBalances,
} from "./get-wallet-balance.js";

describe("normalizeWalletBalances", () => {
  it("parses the canonical balances[] shape", () => {
    const out = normalizeWalletBalances({
      balances: [
        { currency: "USD", amount: 250.5 },
        { currency: "eur", amount: 100 },
      ],
    });
    expect(out).toEqual([
      { currency: "USD", amount: 250.5 },
      { currency: "EUR", amount: 100 },
    ]);
  });

  it("falls back to {amount,currency} for single-currency accounts", () => {
    expect(normalizeWalletBalances({ amount: 50, currency: "gbp" })).toEqual([
      { currency: "GBP", amount: 50 },
    ]);
  });

  it("returns an empty list when nothing recognizable is present", () => {
    expect(normalizeWalletBalances({})).toEqual([]);
  });

  it("skips malformed entries inside balances[]", () => {
    const out = normalizeWalletBalances({
      balances: [
        { currency: "USD", amount: 10 },
        { currency: "EUR" } as never,
        { amount: 5 } as never,
      ],
    });
    expect(out).toEqual([{ currency: "USD", amount: 10 }]);
  });
});

describe("findBalanceForCurrency", () => {
  it("matches case-insensitively", () => {
    const data = { balances: [{ currency: "GBP", amount: 412.45 }] };
    expect(findBalanceForCurrency(data, "gbp")).toBe(412.45);
    expect(findBalanceForCurrency(data, "GBP")).toBe(412.45);
  });

  it("returns undefined for an unfunded currency", () => {
    expect(findBalanceForCurrency({ balances: [] }, "USD")).toBeUndefined();
  });
});

describe("formatWalletBalance", () => {
  it("renders one line per currency", () => {
    const text = formatWalletBalance({
      balances: [
        { currency: "USD", amount: 100 },
        { currency: "EUR", amount: 50 },
      ],
    });
    expect(text).toContain("100 USD");
    expect(text).toContain("50 EUR");
  });

  it("renders an empty-balance message", () => {
    expect(formatWalletBalance({})).toMatch(/empty/i);
  });
});
