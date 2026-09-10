import { describe, it, expect } from "vitest";
import { pollUntil } from "../../src/pollhelpers";

describe("pollUntil", () => {
  it("resolves when condition flips", async () => {
    let n = 0;
    const sleeps: number[] = [];
    const r = await pollUntil(async () => ++n >= 3, { sleep: async (ms) => void sleeps.push(ms) });
    expect(r).toEqual({ attempts: 3 });
    expect(sleeps.length).toBe(2);
  });
  it("throws after max attempts", async () => {
    await expect(pollUntil(async () => false, { maxAttempts: 2, sleep: async () => undefined })).rejects.toThrow(/not met/);
  });
  it("normalizes bad input", async () => {
    const r = await pollUntil(async () => true, { intervalMs: -5, maxAttempts: NaN });
    expect(r.attempts).toBe(1);
  });
});

import { pollWithTimeout, retryWithBudget } from "../../src/pollhelpers";
import { TimeoutError } from "../../src/timeoutconfig";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("pollWithTimeout", () => {
  it2("returns attempts and elapsed", async () => {
    let t = 0;
    let n = 0;
    const r = await pollWithTimeout(async () => ++n >= 2, 1000, {
      sleep: async (ms) => void (t += ms),
      clock: () => t,
      intervalMs: 10,
    });
    ex2(r.attempts).toBe(2);
    ex2(r.elapsedMs).toBeGreaterThanOrEqual(0);
  });
  it2("throws TimeoutError on expiry", async () => {
    let t = 0;
    await ex2(
      pollWithTimeout(async () => false, 25, {
        sleep: async (ms) => void (t += ms),
        clock: () => t,
        intervalMs: 10,
      })
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});

d2("retryWithBudget", () => {
  it2("succeeds after retry", async () => {
    let n = 0;
    const r = await retryWithBudget(
      async () => {
        if (++n < 2) throw new Error("flaky");
        return "ok";
      },
      { sleep: async () => undefined, clock: () => 0 }
    );
    ex2(r).toEqual({ result: "ok", attempts: 2 });
  });
  it2("throws TimeoutError when budget exceeded", async () => {
    await ex2(
      retryWithBudget(async () => { throw new Error("x"); }, { budgetMs: 50, baseDelayMs: 100, sleep: async () => undefined, clock: () => 0 })
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
