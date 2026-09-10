import { describe, it, expect } from "vitest";
import { expiresInSec, isInvoiceExpired, ttlHint } from "../../src/ttlhint";

describe("expiresInSec", () => {
  it("computes positive delta", () => {
    expect(expiresInSec(2000, 1000)).toBe(1000);
  });

  it("is negative after deadline", () => {
    expect(expiresInSec(500, 1000)).toBe(-500);
  });
});

describe("isInvoiceExpired", () => {
  it("false before deadline", () => {
    expect(isInvoiceExpired(2000, 1000)).toBe(false);
  });

  it("true at and after deadline", () => {
    expect(isInvoiceExpired(1000, 1000)).toBe(true);
    expect(isInvoiceExpired(999, 1000)).toBe(true);
  });
});

describe("ttlHint", () => {
  it("flags expiry and bump window", () => {
    expect(ttlHint(500, 1000).expired).toBe(true);
    const soon = ttlHint(1000 + 3600, 1000);
    expect(soon.expired).toBe(false);
    expect(soon.needsBump).toBe(true);
    const far = ttlHint(1000 + 30 * 86400, 1000);
    expect(far.needsBump).toBe(false);
  });
});
