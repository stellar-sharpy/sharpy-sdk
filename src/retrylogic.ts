/**
 * Retry helpers for transient Stellar RPC failures.
 * Backoff is exponential (`baseDelayMs * 2^attempt`) with a `maxDelayMs` cap
 * and optional jitter-free determinism for tests (`sleep` injectable).
 */

export interface RetryOpts {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryable?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function backoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
}

export async function withRetries<T>(fn: () => Promise<T>, opts?: RetryOpts): Promise<T> {
  const maxAttempts = opts?.maxAttempts ?? 3;
  const baseDelayMs = opts?.baseDelayMs ?? 500;
  const maxDelayMs = opts?.maxDelayMs ?? 8_000;
  const retryable = opts?.retryable ?? (() => true);
  const sleep = opts?.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!retryable(err) || attempt === maxAttempts - 1) throw err;
      await sleep(backoffDelayMs(attempt, baseDelayMs, maxDelayMs));
    }
  }
  throw lastErr;
}
