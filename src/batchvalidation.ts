/**
 * Pool-pay / batch input validation — fail fast before submission.
 * Limits mirror on-chain caps (batch max 10) with client-side guards.
 */

export const MAX_BATCH_SIZE = 10;
export const MAX_POOL_SIZE = 25;

export function chunkArray<T>(items: T[], size: number): T[][] {
  const n = Number.isFinite(size) && size > 0 ? Math.floor(size) : MAX_BATCH_SIZE;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

export function validatePoolPayments(payments: { invoiceId: number; amount: bigint }[]): void {
  if (!Array.isArray(payments) || payments.length === 0) throw new Error("payments must be a non-empty array");
  if (payments.length > MAX_POOL_SIZE) throw new Error(`pool_pay supports at most ${MAX_POOL_SIZE} payments`);
  const seen = new Set<number>();
  for (const p of payments) {
    if (!Number.isInteger(p.invoiceId) || p.invoiceId < 0) throw new Error(`Invalid invoiceId: ${p.invoiceId}`);
    if (p.amount <= 0n) throw new Error(`Invalid amount for invoice #${p.invoiceId}: ${p.amount}`);
    if (seen.has(p.invoiceId)) throw new Error(`Duplicate invoiceId in pool_pay: ${p.invoiceId}`);
    seen.add(p.invoiceId);
  }
}
