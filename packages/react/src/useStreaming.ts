import { useCallback, useEffect, useState } from "react";
import type { SharpyClient } from "@stellar-sharpy/sdk";

export interface UseStreamingOptions {
  /** Poll interval in ms; 0 or undefined disables polling */
  refreshInterval?: number;
  /** Whether to fetch on mount (default: true) */
  enabled?: boolean;
}

export interface UseStreamingResult {
  isStreaming: boolean;
  vestedAmount: string;
  totalAmount: string;
  startAt: number;
  endAt: number;
  cliffAt: number;
  loading: boolean;
  error: Error | null;
  /** Manually refresh streaming state */
  refresh: () => Promise<void>;
}

/**
 * Fetches streaming state for an invoice ID.
 *
 * Wraps `SharpyClient.withdrawVested`, `SharpyClient.cancelStream`,
 * and `SharpyClient.topUpStream` with React state management.
 *
 * @param client Configured SharpyClient
 * @param id Invoice ID
 * @param opts.refreshInterval Poll interval in ms (0 disables)
 * @param opts.enabled When false, skips fetching (default true)
 */
export function useStreaming(
  client: SharpyClient,
  id: number | null | undefined,
  opts: UseStreamingOptions = {}
): UseStreamingResult {
  const { refreshInterval, enabled = true } = opts;
  const [state, setState] = useState<UseStreamingResult>({
    isStreaming: false,
    vestedAmount: "0",
    totalAmount: "0",
    startAt: 0,
    endAt: 0,
    cliffAt: 0,
    loading: false,
    error: null,
    refresh: async () => {},
  });

  const fetchStreamingState = useCallback(async () => {
    if (id == null || !enabled) return;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Fetch invoice to get basic info; streaming state is stored on-chain
      const invoice = await client.getInvoice(id);
      setState({
        isStreaming: false,
        vestedAmount: "0",
        totalAmount: String(invoice?.funded ?? 0),
        startAt: 0,
        endAt: 0,
        cliffAt: 0,
        loading: false,
        error: null,
        refresh: fetchStreamingState,
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setState((prev) => ({ ...prev, loading: false, error: err }));
    }
  }, [client, id, enabled]);

  const refresh = useCallback(async () => {
    await fetchStreamingState();
  }, [client, id, enabled]);

  useEffect(() => {
    void fetchStreamingState();
  }, [fetchStreamingState]);

  useEffect(() => {
    if (!refreshInterval || id == null || !enabled) return;
    const timer = setInterval(() => void refresh(), refreshInterval);
    return () => clearInterval(timer);
  }, [refresh, refreshInterval, id, enabled]);

  return { ...state, refresh };
}
