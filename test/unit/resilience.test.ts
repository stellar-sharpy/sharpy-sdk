import { describe, it, expect } from "vitest";
import { withRetries, backoffDelayMs } from "../../src/retrylogic";
import { normalizePollConfig, withTimeout, TimeoutError } from "../../src/timeoutconfig";
import { xlmToStroops, stroopsToXlm, addFeeMargin, feeWithinBudget } from "../../src/estimatefees";

describe("withRetries", () => {
  it("succeeds on the third attempt without sleeping", async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const res = await withRetries(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { sleep: async (ms) => void sleeps.push(ms) }
    );
    expect(res).toBe("ok");
    expect(calls).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
  });

  it("honors a non-retryable predicate immediately", async () => {
    let calls = 0;
    await expect(
      withRetries(
        async () => {
          calls += 1;
          throw new Error("fatal");
        },
        { retryable: () => false, sleep: async () => undefined }
      )
    ).rejects.toThrow("fatal");
    expect(calls).toBe(1);
  });

  it("caps backoff at maxDelayMs", () => {
    expect(backoffDelayMs(0, 500, 8000)).toBe(500);
    expect(backoffDelayMs(10, 500, 8000)).toBe(8000);
  });
});

describe("timeout helpers", () => {
  it("normalizes bad poll input to defaults", () => {
    expect(normalizePollConfig({ intervalMs: -5, maxAttempts: NaN })).toEqual({
      intervalMs: 5000,
      maxAttempts: 60,
    });
  });

  it("caps maxAttempts", () => {
    expect(normalizePollConfig({ maxAttempts: 99999 }).maxAttempts).toBe(600);
  });

  it("withTimeout resolves fast promises", async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
  });

  it("withTimeout rejects slow promises with TimeoutError", async () => {
    const slow = new Promise<never>(() => undefined);
    await expect(withTimeout(slow, 10)).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("fee math", () => {
  it("converts XLM to stroops and back", () => {
    expect(xlmToStroops(1.5)).toBe(15_000_000n);
    expect(stroopsToXlm(15_000_000n)).toBe(1.5);
  });

  it("adds a bps margin", () => {
    expect(addFeeMargin(1000n, 1000)).toBe(1100n);
  });

  it("checks budget", () => {
    expect(feeWithinBudget(100n, 200n)).toBe(true);
    expect(feeWithinBudget(300n, 200n)).toBe(false);
  });

  it("rejects negative input", () => {
    expect(() => xlmToStroops(-1)).toThrow();
    expect(() => addFeeMargin(-5n, 100)).toThrow();
  });
});
