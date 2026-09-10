import { describe, it, expect } from "vitest";
import { validateCreateStreamParams, vestedAmountLinear } from "../../src/streamhelpers";

describe("validateCreateStreamParams", () => {
  it("accepts a sane schedule", () => {
    expect(() => validateCreateStreamParams({ totalAmount: 100n, startAt: 1000, endAt: 2000 })).not.toThrow();
  });
  it("rejects non-positive amount", () => {
    expect(() => validateCreateStreamParams({ totalAmount: 0n, startAt: 1, endAt: 2 })).toThrow(/positive/);
  });
  it("rejects end before start", () => {
    expect(() => validateCreateStreamParams({ totalAmount: 1n, startAt: 5, endAt: 5 })).toThrow(/after start/);
  });
  it("rejects cliff outside window", () => {
    expect(() => validateCreateStreamParams({ totalAmount: 1n, startAt: 10, endAt: 20, cliffAt: 99 })).toThrow(/cliff/);
  });
});

describe("vestedAmountLinear", () => {
  it("is zero before cliff and full after end", () => {
    expect(vestedAmountLinear(1000n, 1000, 2000, 900, 1200)).toBe(0n);
    expect(vestedAmountLinear(1000n, 1000, 2000, 999)).toBe(0n);
    expect(vestedAmountLinear(1000n, 1000, 2000, 2000)).toBe(1000n);
    expect(vestedAmountLinear(1000n, 1000, 2000, 9999)).toBe(1000n);
  });
  it("vests linearly mid-schedule", () => {
    expect(vestedAmountLinear(1000n, 1000, 2000, 1500)).toBe(500n);
  });
});
