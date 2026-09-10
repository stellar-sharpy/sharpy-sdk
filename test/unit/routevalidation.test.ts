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
