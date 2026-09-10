/**
 * CCTP resilience helpers — pure latency math + status classification.
 * Complements `pollCctpAttestation` (which reports attempts/elapsedMs).
 */

export type AttestationStatus = "pending" | "complete" | "failed";

export function classifyAttestationStatus(status?: string): AttestationStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "complete") return "complete";
  if (s === "failed" || s === "error") return "failed";
  return "pending";
}

export function shouldRetryAttestation(status: AttestationStatus): boolean {
  return status === "pending";
}

export function formatCctpLatency(elapsedMs: number, attempts: number): string {
  const s = Math.max(0, Math.round(elapsedMs / 1000));
  return `${attempts} attempt${attempts === 1 ? "" : "s"} in ${s}s`;
}

export function estimateAttestationWaitMs(attempt: number, baseIntervalMs = 5_000): number {
  if (!Number.isFinite(attempt) || attempt < 0) return baseIntervalMs;
  return Math.floor(baseIntervalMs) * (Math.floor(attempt) + 1);
}

export function cctpExplorerUrl(sourceDomain: number, txHash: string, testnet = true): string {
  const base = testnet ? "https://iris-api-sandbox.circle.com" : "https://iris-api.circle.com";
  return `${base}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;
}
