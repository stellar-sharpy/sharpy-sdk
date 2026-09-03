import { useCallback, useState } from "react";
import type { SharpyClient, CreateStreamParams } from "@stellar-sharpy/sdk";

/**
 * Shared mutation state for streaming actions.
 */
export interface StreamActionOptions {
  /** Called on successful submission with tx hash */
  onSuccess?: (txHash: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface StreamMutationResult<T> {
  /** Execute the mutation */
  run: (args: T) => Promise<{ txHash: string } & Partial<{ streamId: number }>>;
  loading: boolean;
  error: Error | null;
  txHash: string | null;
}

export type CreateStreamArgs = CreateStreamParams;

/**
 * Mutation hook for `SharpyClient.createStream`.
 * @param client Configured SharpyClient with signing capability
 * @param opts onSuccess/onError callbacks
 */
export function useCreateStream(
  client: SharpyClient,
  opts: StreamActionOptions = {}
): {
  create: (args: CreateStreamArgs) => Promise<{ streamId: number; txHash: string }>;
  loading: boolean;
  error: Error | null;
  data: { streamId: number; txHash: string } | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{ streamId: number; txHash: string } | null>(null);

  const create = useCallback(
    async (args: CreateStreamArgs) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.createStream(args);
        setData(result);
        opts.onSuccess?.(result.txHash);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        opts.onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, opts.onSuccess, opts.onError]
  );

  return { create, loading, error, data };
}

/**
 * Mutation hook for `SharpyClient.withdrawVested`.
 * @param client Configured SharpyClient with signing capability
 */
export function useWithdrawVested(
  client: SharpyClient,
  opts: StreamActionOptions = {}
): {
  withdraw: (caller: string, streamId: number) => Promise<{ txHash: string }>;
  loading: boolean;
  error: Error | null;
  txHash: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const withdraw = useCallback(
    async (caller: string, streamId: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await client.withdrawVested(caller, streamId);
        setTxHash(result.txHash);
        opts.onSuccess?.(result.txHash);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        opts.onError?.(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, opts.onSuccess, opts.onError]
  );

  return { withdraw, loading, error, txHash };
}
