import { describe, it, expect, vi, afterEach } from "vitest";
import { SharpyClient } from "../../src/client";

const TESTNET = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: "CAEWQX36RLGP2WY6ACOREDJEIGELYV3HWWUPGV3CJMC27OWGQWZHTH6T",
};

function stubFetch(responses: Array<{ ok: boolean; messages?: unknown[] }>): void {
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const r = responses[Math.min(calls, responses.length - 1)]!;
      calls += 1;
      return { ok: r.ok, json: async () => ({ messages: r.messages ?? [] }) };
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pollCctpAttestation latency tracking", () => {
  it("reports attempts and elapsedMs on success", async () => {
    stubFetch([
      { ok: true, messages: [] },
      { ok: true, messages: [{ status: "pending" }] },
      { ok: true, messages: [{ status: "complete", message: "0xabc", attestation: "0xdef" }] },
    ]);
    const client = new SharpyClient(TESTNET);
    const seen: Array<[number, number]> = [];
    const res = await client.pollCctpAttestation("0xhash", 0, {
      intervalMs: 1,
      maxAttempts: 5,
      onAttempt: (a, m) => seen.push([a, m]),
    });
    expect(res.message).toBe("0xabc");
    expect(res.attestation).toBe("0xdef");
    expect(res.attempts).toBe(3);
    expect(res.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(seen).toEqual([
      [1, 5],
      [2, 5],
    ]);
  });

  it("timeout error reports attempts and elapsed ms", async () => {
    stubFetch([{ ok: true, messages: [] }]);
    const client = new SharpyClient(TESTNET);
    await expect(
      client.pollCctpAttestation("0xhash", 0, { intervalMs: 1, maxAttempts: 2 })
    ).rejects.toThrow(/after 2 attempts \([0-9]+ms elapsed\)/);
  });
});
