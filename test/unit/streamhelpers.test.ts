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

import { streamStatus } from "../../src/streamhelpers";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("streamStatus", () => {
  it2("tracks upcoming/cliff/vesting/matured", () => {
    ex2(streamStatus({ totalAmount: 1000n, startAt: 1000, endAt: 2000, cliffAt: 1200 }, 900).state).toBe("upcoming");
    ex2(streamStatus({ totalAmount: 1000n, startAt: 1000, endAt: 2000, cliffAt: 1200 }, 1100).state).toBe("cliff");
    ex2(streamStatus({ totalAmount: 1000n, startAt: 1000, endAt: 2000 }, 1500).state).toBe("vesting");
    ex2(streamStatus({ totalAmount: 1000n, startAt: 1000, endAt: 2000 }, 2500).state).toBe("matured");
  });
  it2("computes withdrawable net of withdrawn", () => {
    const s = streamStatus({ totalAmount: 1000n, startAt: 1000, endAt: 2000, withdrawn: 200n }, 1500);
    ex2(s.vested).toBe(500n);
    ex2(s.withdrawable).toBe(300n);
  });
  it2("freezes cancelled streams", () => {
    const s = streamStatus({ totalAmount: 1000n, startAt: 1000, endAt: 2000, cancelled: true }, 1500);
    ex2(s.state).toBe("cancelled");
    ex2(s.vested).toBe(500n);
  });
});
