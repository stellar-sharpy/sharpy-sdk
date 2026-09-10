import { describe, it, expect } from "vitest";
import { validateBps, validateTranches } from "../../src/routevalidation";

describe("validateBps", () => {
  it("accepts bounds", () => {
    expect(() => validateBps(0)).not.toThrow();
    expect(() => validateBps(10_000)).not.toThrow();
  });
  it("rejects out of range with typed error", () => {
    expect(() => validateBps(-1)).toThrow(/out of range/);
    expect(() => validateBps(10_001)).toThrow(/out of range/);
    expect(() => validateBps(1.5)).toThrow(/out of range/);
  });
});

describe("validateTranches", () => {
  it("accepts tranches summing to 100%", () => {
    expect(() => validateTranches([5000, 5000])).not.toThrow();
  });
  it("rejects cap overflow", () => {
    expect(() => validateTranches([6000, 5000])).toThrow(/exceed 100%/);
  });
  it("validates each leg", () => {
    expect(() => validateTranches([100, -5])).toThrow(/out of range/);
  });
});

import { detectRouteCycle, validateWhitelist, normalizeFeeBps } from "../../src/routevalidation";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("detectRouteCycle", () => {
  it2("accepts acyclic routes", () => {
    ex2(() => detectRouteCycle([1, 2, 3])).not.toThrow();
  });
  it2("rejects repeats and self-loops", () => {
    ex2(() => detectRouteCycle([1, 2, 1])).toThrow(/cycle/);
    ex2(() => detectRouteCycle([4, 4])).toThrow(/cycle/);
  });
});

d2("validateWhitelist/normalizeFeeBps", () => {
  it2("allows empty whitelist (open invoice)", () => {
    ex2(() => validateWhitelist("GAAA", [])).not.toThrow();
  });
  it2("rejects non-listed payer", () => {
    ex2(() => validateWhitelist("GAAA", ["GBBB"])).toThrow(/whitelisted/);
  });
  it2("normalizes fee with fallback", () => {
    ex2(normalizeFeeBps(undefined)).toBe(30);
    ex2(normalizeFeeBps(100)).toBe(100);
    ex2(() => normalizeFeeBps(99_999)).toThrow(/out of range/);
  });
});
