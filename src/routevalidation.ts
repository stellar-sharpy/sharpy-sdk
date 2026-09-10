/**
 * Route / tranche / whitelist / fee validation — client-side guards that
 * mirror on-chain panics with the SDK typed-error taxonomy.
 */
import { BpsOutOfRangeError, TrancheCapExceededError, RouteCycleError, PayerNotWhitelistedError } from "./errors.js";

export const BPS_MAX = 10_000;

export function validateBps(bps: number, label = "bps"): void {
  if (!Number.isFinite(bps) || !Number.isInteger(bps) || bps < 0 || bps > BPS_MAX) {
    throw new BpsOutOfRangeError(`${label} ${String(bps)} out of range [0, ${BPS_MAX}]`);
  }
}

export function validateTranches(tranchesBps: number[], invoiceId = 0): void {
  for (const bps of tranchesBps) validateBps(bps, "tranche bps");
  const sum = tranchesBps.reduce((a, b) => a + b, 0);
  if (sum > BPS_MAX) throw new TrancheCapExceededError(invoiceId);
}
