import { describe, it, expect } from "vitest";
import { filterClaimablePositive, summarizeClaimables } from "../../src/treasuryhelpers";

describe("treasuryhelpers core", () => {
  const rows = [
    { account: "GAAA", token: "T1", balance: 100n },
    { account: "GBBB", token: "T1", balance: 0n },
    { account: "GCCC", token: "T2", balance: 50n },
  ];
  it("filters zero balances", () => {
    expect(filterClaimablePositive(rows).map((r) => r.account)).toEqual(["GAAA", "GCCC"]);
  });
  it("summarizes counts and totals", () => {
    expect(summarizeClaimables(rows)).toEqual({ count: 3, positive: 2, total: 150n });
  });
  it("handles empty input", () => {
    expect(summarizeClaimables([])).toEqual({ count: 0, positive: 0, total: 0n });
  });
});
