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
