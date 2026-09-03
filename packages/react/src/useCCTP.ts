/**
 * Shared options for CCTP hooks.
 */
export interface CctpHookOptions {
  /** Poll interval in ms for attestation (default 5000) */
  intervalMs?: number;
  /** Max polling attempts before giving up (default 60) */
  maxAttempts?: number;
  /** Called on success with tx hash */
  onSuccess?: (txHash: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface CctpAttestation {
  message: string;
  attestation: string;
}

export type CctpStatus = "idle" | "polling" | "ready" | "submitting" | "done" | "error";
