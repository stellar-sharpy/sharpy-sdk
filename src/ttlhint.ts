/**
 * TTL + expiry helpers — offline pure math for `ttl_hint` / `is_invoice_expired`.
 * Deadlines are unix seconds; `nowSec` defaults to `Date.now()/1000`.
 */

export interface TtlHint {
  expired: boolean;
  expiresInSec: number;
  needsBump: boolean;
  deadline: number;
  nowSec: number;
}

export const TTL_BUMP_THRESHOLD_SEC = 3 * 24 * 3600;

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function expiresInSec(deadline: number, atSec?: number): number {
  const t = atSec ?? nowSec();
  return Math.floor(deadline) - Math.floor(t);
}

export function isInvoiceExpired(deadline: number, atSec?: number): boolean {
  return expiresInSec(deadline, atSec) <= 0;
}
