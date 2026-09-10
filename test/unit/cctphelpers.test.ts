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
