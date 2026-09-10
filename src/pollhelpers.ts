/**
 * Poll / budget retry edge helpers — beyond `withRetries`/`withTimeout`.
 * All timers injectable (`sleep`, `clock`) for deterministic unit tests.
 */
import { TimeoutError } from "./timeoutconfig.js";

export interface PollOpts {
  intervalMs?: number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function pollUntil(
  check: () => Promise<boolean>,
  opts?: PollOpts
): Promise<{ attempts: number }> {
  const intervalMs = opts?.intervalMs ?? 100;
  const maxAttempts = opts?.maxAttempts ?? 10;
  const sleep = opts?.sleep ?? defaultSleep;
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? Math.floor(intervalMs) : 100;
  const attempts = Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.floor(maxAttempts) : 10;
  for (let i = 1; i <= attempts; i++) {
    if (await check()) return { attempts: i };
    if (i < attempts) await sleep(interval);
  }
  throw new Error(`pollUntil: condition not met after ${attempts} attempts`);
}
