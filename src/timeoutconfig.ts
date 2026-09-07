/**
 * Timeout and polling configuration.
 * `normalizePollConfig` clamps caller input the same way `normalizePageOpts`
 * clamps pagination — intervals stay positive, attempt counts stay bounded.
 */

export interface PollConfig {
  intervalMs?: number;
  maxAttempts?: number;
}

export interface NormalizedPoll {
  intervalMs: number;
  maxAttempts: number;
}

export const DEFAULT_INTERVAL_MS = 5_000;
export const DEFAULT_MAX_ATTEMPTS = 60;
export const MAX_ATTEMPTS_CAP = 600;

export function normalizePollConfig(opts?: PollConfig): NormalizedPoll {
  let intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  let maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) intervalMs = DEFAULT_INTERVAL_MS;
  if (!Number.isFinite(maxAttempts) || maxAttempts <= 0) maxAttempts = DEFAULT_MAX_ATTEMPTS;
  return {
    intervalMs: Math.floor(intervalMs),
    maxAttempts: Math.min(Math.floor(maxAttempts), MAX_ATTEMPTS_CAP),
  };
}

export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
