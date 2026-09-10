import { describe, it, expect } from "vitest";
import {
  estimateProtocolFee,
  previewFeeSplit,
  validateFeeBps,
  feeWithinTolerance,
  DEFAULT_PROTOCOL_FEE_BPS,
} from "../../src/feepreview";

describe("estimateProtocolFee", () => {
  it("computes 0.3% default fee", () => {
    expect(estimateProtocolFee(1_000_000n)).toBe(3_000n);
    expect(DEFAULT_PROTOCOL_FEE_BPS).toBe(30);
  });

  it("handles zero amount and zero bps", () => {
    expect(estimateProtocolFee(0n, 0)).toBe(0n);
    expect(estimateProtocolFee(1_000n, 0)).toBe(0n);
  });

  it("floors fractional stroops", () => {
    expect(estimateProtocolFee(1n, 30)).toBe(0n);
    expect(estimateProtocolFee(10_000n, 30)).toBe(30n);
  });

  it("rejects out-of-range bps", () => {
    expect(() => estimateProtocolFee(100n, -1)).toThrow();
    expect(() => estimateProtocolFee(100n, 10_001)).toThrow();
  });
});

describe("previewFeeSplit", () => {
  it("splits gross into fee and net", () => {
    const p = previewFeeSplit(1_000_000n, 100);
    expect(p).toEqual({ gross: 1_000_000n, fee: 10_000n, net: 990_000n, feeBps: 100 });
  });

  it("validates bps through BpsOutOfRangeError", () => {
    expect(() => validateFeeBps(20_000)).toThrow(/out of range/);
  });
});

describe("feeWithinTolerance", () => {
  it("accepts exact match", () => {
    expect(feeWithinTolerance(3000n, 3000n, 50)).toBe(true);
  });

  it("accepts drift inside tolerance", () => {
    expect(feeWithinTolerance(10_000n, 10_050n, 100)).toBe(true);
  });

  it("rejects drift outside tolerance", () => {
    expect(feeWithinTolerance(10_000n, 12_000n, 100)).toBe(false);
  });

  it("rejects negative inputs", () => {
    expect(feeWithinTolerance(-1n, 100n, 100)).toBe(false);
  });
});
