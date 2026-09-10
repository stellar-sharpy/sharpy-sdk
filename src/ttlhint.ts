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

export function ttlHint(deadline: number, atSec?: number): TtlHint {
  const t = Math.floor(atSec ?? nowSec());
  const d = Math.floor(deadline);
  const diff = d - t;
  return {
    expired: diff <= 0,
    expiresInSec: diff,
    needsBump: diff > 0 && diff < TTL_BUMP_THRESHOLD_SEC,
    deadline: d,
    nowSec: t,
  };
}

export function needsTtlBump(deadline: number, atSec?: number): boolean {
  return ttlHint(deadline, atSec).needsBump;
}

export function formatTtl(hint: TtlHint): string {
  if (hint.expired) return "expired";
  const s = hint.expiresInSec;
  const days = Math.floor(s / 86400);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(s / 3600);
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.floor(s / 60);
  if (mins >= 1) return `${mins}m left`;
  return `${s}s left`;
}
