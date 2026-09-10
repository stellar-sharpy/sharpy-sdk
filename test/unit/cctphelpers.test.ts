import { describe, it, expect } from "vitest";
import { classifyAttestationStatus, shouldRetryAttestation, formatCctpLatency } from "../../src/cctphelpers";

describe("cctphelpers core", () => {
  it("classifies statuses", () => {
    expect(classifyAttestationStatus("complete")).toBe("complete");
    expect(classifyAttestationStatus("COMPLETE")).toBe("complete");
    expect(classifyAttestationStatus("failed")).toBe("failed");
    expect(classifyAttestationStatus("pending")).toBe("pending");
    expect(classifyAttestationStatus(undefined)).toBe("pending");
  });
  it("retries only pending", () => {
    expect(shouldRetryAttestation("pending")).toBe(true);
    expect(shouldRetryAttestation("complete")).toBe(false);
    expect(shouldRetryAttestation("failed")).toBe(false);
  });
  it("formats latency", () => {
    expect(formatCctpLatency(12_000, 3)).toBe("3 attempts in 12s");
    expect(formatCctpLatency(5_000, 1)).toBe("1 attempt in 5s");
  });
});

import { estimateAttestationWaitMs, cctpExplorerUrl } from "../../src/cctphelpers";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("cctphelpers edges", () => {
  it2("estimates linear wait", () => {
    ex2(estimateAttestationWaitMs(0, 5000)).toBe(5000);
    ex2(estimateAttestationWaitMs(2, 5000)).toBe(15000);
    ex2(estimateAttestationWaitMs(-1)).toBe(5000);
  });
  it2("builds explorer urls", () => {
    ex2(cctpExplorerUrl(0, "0xabc", true)).toContain("sandbox");
    ex2(cctpExplorerUrl(0, "0xabc", false)).not.toContain("sandbox");
  });
});
