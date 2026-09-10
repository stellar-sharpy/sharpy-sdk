import { describe, it, expect } from "vitest";
import { expiresInSec, isInvoiceExpired, needsTtlBump, formatTtl, ttlHint } from "../../src/ttlhint";

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

describe("needsTtlBump/formatTtl", () => {
  it("detects bump window", () => {
    expect(needsTtlBump(1000 + 100, 1000)).toBe(true);
    expect(needsTtlBump(1000 + 30 * 86400, 1000)).toBe(false);
    expect(needsTtlBump(500, 1000)).toBe(false);
  });

  it("formats human ttl", () => {
    expect(formatTtl(ttlHint(500, 1000))).toBe("expired");
    expect(formatTtl(ttlHint(1000 + 2 * 86400, 1000))).toBe("2d left");
    expect(formatTtl(ttlHint(1000 + 3600, 1000))).toBe("1h left");
    expect(formatTtl(ttlHint(1000 + 90, 1000))).toBe("1m left");
    expect(formatTtl(ttlHint(1000 + 10, 1000))).toBe("10s left");
  });
});
