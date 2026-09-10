/**
 * @module useInvoiceViews — React hooks for fee-preview, TTL-hint and paged views.
 *
 * Wraps `SharpyClient.previewFeeForInvoice/getTtlHint/getInvoicesByCreatorPaginated`
 * with loading/error/refresh state, following the `useInvoice` patterns.
 */
import { useCallback, useEffect, useState } from "react";
import type { SharpyClient } from "@stellar-sharpy/sdk";

export interface UseFeePreviewResult {
  fee: bigint | null;
  net: bigint | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** Live fee preview for a hypothetical payment amount. */
export function useFeePreview(
  client: SharpyClient,
  invoiceId: number | null | undefined,
  amount: bigint,
  feeBps = 30
): UseFeePreviewResult {
  const [fee, setFee] = useState<bigint | null>(null);
  const [net, setNet] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (invoiceId == null) return;
    setLoading(true);
    setError(null);
    try {
      const r = await client.previewFeeForInvoice(invoiceId, amount, feeBps);
      setFee(r.fee);
      setNet(r.net);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setFee(null);
      setNet(null);
    } finally {
      setLoading(false);
    }
  }, [client, invoiceId, amount, feeBps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { fee, net, loading, error, refresh };
}

export interface UseTtlHintResult {
  expired: boolean | null;
  expiresInSec: number | null;
  needsBump: boolean | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** TTL hint for an invoice deadline with auto-refresh support. */
export function useTtlHint(
  client: SharpyClient,
  invoiceId: number | null | undefined,
  opts: { refreshInterval?: number } = {}
): UseTtlHintResult {
  const { refreshInterval } = opts;
  const [state, setState] = useState<{ expired: boolean | null; expiresInSec: number | null; needsBump: boolean | null }>({
    expired: null,
    expiresInSec: null,
    needsBump: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (invoiceId == null) return;
    setLoading(true);
    setError(null);
    try {
      const hint = await client.getTtlHint(invoiceId);
      setState({ expired: hint.expired, expiresInSec: hint.expiresInSec, needsBump: hint.needsBump });
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [client, invoiceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!refreshInterval || invoiceId == null) return;
    const t = setInterval(() => void refresh(), refreshInterval);
    return () => clearInterval(t);
  }, [refresh, refreshInterval, invoiceId]);

  return { ...state, loading, error, refresh };
}

export interface UsePagedInvoicesResult {
  ids: number[];
  total: number | null;
  hasMore: boolean;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/** Paged creator invoices via `getInvoicesByCreatorPaginated`. */
export function usePagedInvoices(
  client: SharpyClient,
  creator: string | null | undefined,
  opts: { limit?: number; offset?: number; refreshInterval?: number } = {}
): UsePagedInvoicesResult {
  const { limit, offset, refreshInterval } = opts;
  const [ids, setIds] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!creator) return;
    setLoading(true);
    setError(null);
    try {
      const page = await client.getInvoicesByCreatorPaginated(creator, { limit, offset });
      setIds(page.ids);
      setTotal(page.total);
      setHasMore(page.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setIds([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  }, [client, creator, limit, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!refreshInterval || !creator) return;
    const t = setInterval(() => void refresh(), refreshInterval);
    return () => clearInterval(t);
  }, [refresh, refreshInterval, creator]);

  return { ids, total, hasMore, loading, error, refresh };
}
