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

import { formatClaimRow, chunkScan, topClaimables } from "../../src/treasuryhelpers";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("treasuryhelpers edges", () => {
  it2("formats rows with truncation", () => {
    const s = formatClaimRow({ account: "G" + "A".repeat(55), token: "TOKEN123456", balance: 7n });
    ex2(s).toContain("...");
    ex2(s).toContain("7");
  });
  it2("chunks scans deterministically", () => {
    ex2(chunkScan([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    ex2(chunkScan([], 5)).toEqual([]);
  });
  it2("ranks top claimables", () => {
    const rows = [
      { account: "A", token: "T", balance: 5n },
      { account: "B", token: "T", balance: 20n },
      { account: "C", token: "T", balance: 10n },
    ];
    ex2(topClaimables(rows, 2).map((r) => r.account)).toEqual(["B", "C"]);
  });
});
