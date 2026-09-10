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
