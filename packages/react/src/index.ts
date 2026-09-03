/**
 * @stellar-sharpy/react — React hooks for the Sharpy SDK.
 *
 * Each hook wraps a `SharpyClient` call with React state (loading, error,
 * data) and handles subscription / auto-refresh. Pass your own `SharpyClient`
 * instance so network / contract configuration stays in one place.
 *
 * @example
 * ```tsx
 * import { SharpyClient, NETWORKS } from "@stellar-sharpy/sdk";
 * import { useInvoice, useCreateInvoice, useWallet, useInvoicesByCreator } from "@stellar-sharpy/react";
 *
 * const client = new SharpyClient({ ...NETWORKS.testnet, signTransaction });
 * function InvoiceCard({ id }: { id: number }) {
 *   const { invoice, loading, error } = useInvoice(client, id, { refreshInterval: 10_000 });
 *   if (loading) return <p>Loading…</p>;
 *   if (error) return <p>{String(error)}</p>;
 *   return <pre>{JSON.stringify(invoice, null, 2)}</pre>;
 * }
 * ```
 */

import { useCallback, useEffect, useState } from "react";
import type { SharpyClient, Invoice } from "@stellar-sharpy/sdk";

// ---------------------------------------------------------------------------
// useInvoice — fetch single invoice with polling
// ---------------------------------------------------------------------------
export interface UseInvoiceOptions {
  /** Poll interval in ms; 0 or undefined disables polling */
  refreshInterval?: number;
  /** Whether to fetch on mount (default: true) */
  enabled?: boolean;
  /** When true (default), clears stale invoice when id changes */
  refreshOnIdChange?: boolean;
}

export interface UseInvoiceResult {
  invoice: Invoice | null;
  loading: boolean;
  error: Error | null;
  /** Currently tracked invoice ID (mirrors the `id` arg) */
  invoiceId: number | null;
  /** Manually re-fetch */
  refresh: () => Promise<void>;
}

/**
 * Fetches an invoice by ID and optionally auto-refreshes.
 *
 * Uses `SharpyClient.getInvoice` internally (read-only simulation via
 * `READ_ONLY_ACCOUNT`). Tracks `invoiceId` in the result, clears stale
 * data on id change when `refreshOnIdChange` is true, and normalizes
 * loading/error transitions for null ids.
 *
 * @param client Configured SharpyClient
 * @param id Invoice ID
 * @param opts.refreshInterval Poll interval in ms (0 disables)
 * @param opts.enabled When false, skips fetching (default true)
 * @param opts.refreshOnIdChange When true, clears stale invoice on id change (default true)
 */
export function useInvoice(
  client: SharpyClient,
  id: number | null | undefined,
  opts: UseInvoiceOptions = {}
): UseInvoiceResult {
  const { refreshInterval, enabled = true, refreshOnIdChange = true } = opts;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled && id != null);
  const [error, setError] = useState<Error | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (id == null || !enabled) {
      if (refreshOnIdChange) setInvoice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await client.getInvoice(id);
      setInvoice(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      if (refreshOnIdChange) setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [client, id, enabled, refreshOnIdChange]);

  useEffect(() => {
    void fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    if (!refreshInterval || id == null || !enabled) return;
    const timer = setInterval(() => void fetchInvoice(), refreshInterval);
    return () => clearInterval(timer);
  }, [fetchInvoice, refreshInterval, id, enabled]);

  return { invoice, loading, error, invoiceId: id ?? null, refresh: fetchInvoice };
}

// ---------------------------------------------------------------------------
// useInvoicesByCreator — paginated list via on-chain creator index
// ---------------------------------------------------------------------------
export interface UseInvoicesByCreatorOptions {
  limit?: number;
  offset?: number;
  enabled?: boolean;
  /** Poll interval in ms; 0 or undefined disables auto-refresh */
  refreshInterval?: number;
}

export interface UseInvoicesByCreatorResult {
  ids: number[];
  total: number | null;
  loading: boolean;
  error: Error | null;
  /** Echo of the creator arg for tracking */
  creator: string | null;
  refresh: () => Promise<void>;
}

/**
 * Lists invoice IDs created by `creator` using the on-chain creator index.
 *
 * Wraps `SharpyClient.getInvoicesByCreator` with optional pagination. When
 * `limit`/`offset` are provided, slicing is done client-side — the contract
 * still returns the full list; the SDK paginates in memory.
 *
 * @param client SharpyClient
 * @param creator Creator Stellar address (G…)
 * @param opts.limit Max results to return
 * @param opts.offset Offset into result set
 */
export function useInvoicesByCreator(
  client: SharpyClient,
  creator: string | null | undefined,
  opts: UseInvoicesByCreatorOptions = {}
): UseInvoicesByCreatorResult {
  const { limit, offset, enabled = true } = opts;
  const [ids, setIds] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled && !!creator);
  const [error, setError] = useState<Error | null>(null);

  const fetchIds = useCallback(async () => {
    if (!creator || !enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (limit !== undefined || offset !== undefined) {
        const all = await client.getInvoicesByCreator(creator);
        const off = offset ?? 0;
        const lim = limit ?? all.length;
        setIds(all.slice(off, off + lim));
        setTotal(all.length);
      } else {
        const data = await client.getInvoicesByCreator(creator);
        setIds(data);
        setTotal(data.length);
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setIds([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [client, creator, limit, offset, enabled]);

  useEffect(() => {
    void fetchIds();
  }, [fetchIds]);

  return { ids, total, loading, error, creator: creator ?? null, refresh: fetchIds };
}

// ---------------------------------------------------------------------------
// useCreateInvoice — mutation hook
// ---------------------------------------------------------------------------
export interface UseCreateInvoiceResult {
  /** Create a single invoice; resolves to { invoiceId, txHash } */
  create: (params: Parameters<SharpyClient["createInvoice"]>[0]) => Promise<{ invoiceId: number; txHash: string }>;
  loading: boolean;
  error: Error | null;
  data: { invoiceId: number; txHash: string } | null;
}

/**
 * Returns a mutation helper for `SharpyClient.createInvoice`.
 *
 * Manages `loading` / `error` / `data` state. The underlying client must
 * have `signTransaction` configured or calls will throw "No wallet connected".
 *
 * @param client SharpyClient with signing capability
 */
export function useCreateInvoice(client: SharpyClient): UseCreateInvoiceResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{ invoiceId: number; txHash: string } | null>(null);

  const create = useCallback(
    async (params: Parameters<SharpyClient["createInvoice"]>[0]) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.createInvoice(params);
        setData(result);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  return { create, loading, error, data };
}

// ---------------------------------------------------------------------------
// useWallet — minimal wallet connection state
// ---------------------------------------------------------------------------
export interface UseWalletOptions {
  /** Auto-connect on mount (tries Freighter) */
  autoConnect?: boolean;
}

export interface UseWalletResult {
  /** Connected Stellar public key, or null */
  publicKey: string | null;
  /** Whether a connection attempt is in flight */
  connecting: boolean;
  error: Error | null;
  /** Connect via Freighter (or configured wallet) */
  connect: () => Promise<string>;
  /** Disconnect locally (does not revoke Freighter permission) */
  disconnect: () => void;
}

/**
 * Manages wallet connection state via Freighter-compatible `connectWallet`.
 *
 * Re-uses the SDK's `connectWallet` / `getWalletPublicKey` helpers internally.
 * For WalletConnect or custom signers, construct your own `SharpyClient` with
 * `signTransaction` and manage the address separately — this hook is a
 * lightweight helper for the common Freighter path.
 *
 * @param opts.autoConnect When true, attempts to read an existing Freighter session on mount
 */
export function useWallet(opts: UseWalletOptions = {}): UseWalletResult {
  const { autoConnect = false } = opts;
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const { connectWallet } = await import("@stellar-sharpy/sdk");
      const pk = await connectWallet();
      setPublicKey(pk);
      return pk;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoConnect) return;
    let cancelled = false;
    (async () => {
      try {
        const { getWalletPublicKey } = await import("@stellar-sharpy/sdk");
        const pk = await getWalletPublicKey();
        if (!cancelled) setPublicKey(pk);
      } catch {
        // ignore auto-connect failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoConnect]);

  return { publicKey, connecting, error, connect, disconnect };
}

export { useStreaming } from "./useStreaming";
export { useCreateStream, useWithdrawVested, useCancelStream, useTopUpStream, mapStreamError } from "./useStreamActions";
export type { StreamActionOptions, StreamMutationResult, CreateStreamArgs } from "./useStreamActions";
export { useCctpAttestation, useCompleteCctpInbound, useCctpHookData, mapCctpError } from "./useCCTP";
export type { CctpHookOptions, CctpAttestation, CctpStatus } from "./useCCTP";
