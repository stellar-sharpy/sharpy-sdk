/**
 * Fee-preview helpers — offline pure math for `preview_fee_for_invoice`.
 * Protocol fee is `amount * feeBps / 10_000`, net is `amount - fee`.
 * All amounts are bigint stroops; bps validation mirrors on-chain guards.
 */
import { BpsOutOfRangeError } from "./errors.js";

export const FEE_BPS_DENOM = 10_000;
export const DEFAULT_PROTOCOL_FEE_BPS = 30;

export function validateFeeBps(feeBps: number): void {
  if (!Number.isFinite(feeBps) || !Number.isInteger(feeBps) || feeBps < 0 || feeBps > FEE_BPS_DENOM) {
    throw new BpsOutOfRangeError(`fee bps ${String(feeBps)} out of range [0, ${FEE_BPS_DENOM}]`);
  }
}

export function estimateProtocolFee(amount: bigint, feeBps: number = DEFAULT_PROTOCOL_FEE_BPS): bigint {
  if (amount < 0n) throw new Error(`Invalid amount: ${amount}`);
  validateFeeBps(feeBps);
  return (amount * BigInt(feeBps)) / BigInt(FEE_BPS_DENOM);
}
