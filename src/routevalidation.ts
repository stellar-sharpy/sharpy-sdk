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

export function detectRouteCycle(route: number[], invoiceId = 0): void {
  const seen = new Set<number>();
  for (const id of route) {
    if (seen.has(id)) throw new RouteCycleError(invoiceId);
    seen.add(id);
  }
  for (let i = 1; i < route.length; i++) {
    if (route[i] === route[i - 1]) throw new RouteCycleError(invoiceId);
  }
}

export function validateWhitelist(payer: string, whitelist: string[], invoiceId = 0): void {
  if (whitelist.length === 0) return;
  if (!whitelist.includes(payer)) throw new PayerNotWhitelistedError(invoiceId);
}

export function normalizeFeeBps(input?: number, fallback = 30): number {
  if (input === undefined) return fallback;
  validateBps(input, "fee bps");
  return input;
}

export function sumTranchesBps(tranchesBps: number[]): number {
  return tranchesBps.reduce((a, b) => a + b, 0);
}
