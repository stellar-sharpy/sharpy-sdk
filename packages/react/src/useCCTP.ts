/**
 * Shared options for CCTP hooks.
 * @module useCCTP — React hooks for Circle CCTP inbound flows.
 *
 * Wraps `SharpyClient.buildCctpHookData/pollCctpAttestation/completeCctpInbound`
 * with loading/status/error state for EVM→Stellar transfers.
 *
 * @example
 * ```tsx
 * const { build } = useCctpHookData(client);
 * const hookData = build(forwardRecipient); // pass to EVM depositForBurnWithHook
 * const { poll, data } = useCctpAttestation(client);
 * await poll(evmTxHash, sourceDomain);
 * const { complete } = useCompleteCctpInbound(client);
 * await complete(caller, data.message, data.attestation);
 * ```
 */
import { useCallback, useState } from "react";
import type { SharpyClient } from "@stellar-sharpy/sdk";

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

/**
 * Polls Circle attestation API via `SharpyClient.pollCctpAttestation`.
 * @param client Configured SharpyClient
 */
export function useCctpAttestation(client: SharpyClient) {
  const [data, setData] = useState<CctpAttestation | null>(null);
  const [status, setStatus] = useState<CctpStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const poll = useCallback(
    async (sourceTxHash: string, sourceDomain: number, opts?: CctpHookOptions) => {
      setLoading(true);
      setStatus("polling");
      setError(null);
      try {
        const result = await client.pollCctpAttestation(sourceTxHash, sourceDomain, {
          intervalMs: opts?.intervalMs,
          maxAttempts: opts?.maxAttempts,
        });
        setData(result);
        setStatus("ready");
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setStatus("error");
        opts?.onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  return { data, status, loading, error, poll };
}

/**
 * Completes an inbound CCTP transfer via `SharpyClient.completeCctpInbound`.
 * Call after attestation is ready (see useCctpAttestation).
 */
export function useCompleteCctpInbound(client: SharpyClient) {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [status, setStatus] = useState<CctpStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const complete = useCallback(
    async (caller: string, message: string, attestation: string, opts?: CctpHookOptions) => {
      setLoading(true);
      setStatus("submitting");
      setError(null);
      try {
        const result = await client.completeCctpInbound(caller, message, attestation);
        setTxHash(result.txHash);
        setStatus("done");
        opts?.onSuccess?.(result.txHash);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        setStatus("error");
        opts?.onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  return { txHash, status, loading, error, complete };
}

/**
 * Builds CCTP hookData for `depositForBurnWithHook` via `SharpyClient.buildCctpHookData`.
 * Pure helper — no network calls.
 */
export function useCctpHookData(client: SharpyClient) {
  const build = useCallback(
    (forwardRecipient: string) => client.buildCctpHookData(forwardRecipient),
    [client]
  );
  return { build };
}
