/**
 * Fee estimation helpers — pure math, no network.
 * 1 XLM = 10_000_000 stroops. `addFeeMargin` pads a base inclusion fee so
 * transient surge pricing doesn't strand a submission; `feeWithinBudget`
 * guards before signing.
 */

export const STROOPS_PER_XLM = 10_000_000n;

export function xlmToStroops(xlm: number): bigint {
  if (!Number.isFinite(xlm) || xlm < 0) throw new Error(`Invalid XLM amount: ${xlm}`);
  return BigInt(Math.round(xlm * 10_000_000));
}

export function stroopsToXlm(stroops: bigint): number {
  if (stroops < 0n) throw new Error(`Invalid stroop amount: ${stroops}`);
  return Number(stroops) / 10_000_000;
}

export function addFeeMargin(baseFeeStroops: bigint, marginBps: number): bigint {
  if (baseFeeStroops < 0n) throw new Error(`Invalid base fee: ${baseFeeStroops}`);
  if (!Number.isFinite(marginBps) || marginBps < 0) throw new Error(`Invalid margin bps: ${marginBps}`);
  return baseFeeStroops + (baseFeeStroops * BigInt(Math.floor(marginBps))) / 10_000n;
}

export function feeWithinBudget(feeStroops: bigint, budgetStroops: bigint): boolean {
  return feeStroops >= 0n && budgetStroops >= 0n && feeStroops <= budgetStroops;
}
