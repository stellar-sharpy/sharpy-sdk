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
