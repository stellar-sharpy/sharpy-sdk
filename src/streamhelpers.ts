/**
 * Streaming lifecycle parity helpers — pure vesting math + validation.
 * Linear vesting between startAt/endAt with optional cliff; cancelled
 * streams freeze vesting at cancel time.
 */
import { StreamingInvalidArgsError } from "./errors.js";

export interface StreamSchedule {
  totalAmount: bigint;
  startAt: number;
  endAt: number;
  cliffAt?: number;
  withdrawn?: bigint;
  cancelled?: boolean;
}

export function validateCreateStreamParams(p: {
  totalAmount: bigint;
  startAt: number;
  endAt: number;
  cliffAt?: number;
}): void {
  if (p.totalAmount <= 0n) throw new StreamingInvalidArgsError("totalAmount must be positive");
  if (!Number.isFinite(p.startAt) || !Number.isFinite(p.endAt)) {
    throw new StreamingInvalidArgsError("startAt/endAt must be finite unix seconds");
  }
  if (p.endAt <= p.startAt) throw new StreamingInvalidArgsError("endAt must be after startAt");
  if (p.cliffAt !== undefined && (p.cliffAt < p.startAt || p.cliffAt > p.endAt)) {
    throw new StreamingInvalidArgsError("cliffAt must be within [startAt, endAt]");
  }
}

export function vestedAmountLinear(
  totalAmount: bigint,
  startAt: number,
  endAt: number,
  atSec: number,
  cliffAt?: number
): bigint {
  if (totalAmount < 0n) throw new StreamingInvalidArgsError("negative totalAmount");
  if (endAt <= startAt) throw new StreamingInvalidArgsError("endAt must be after startAt");
  const cliff = cliffAt ?? startAt;
  if (atSec < cliff) return 0n;
  if (atSec >= endAt) return totalAmount;
  const elapsed = BigInt(Math.floor(atSec) - Math.floor(startAt));
  const duration = BigInt(Math.floor(endAt) - Math.floor(startAt));
  return (totalAmount * elapsed) / duration;
}

export type StreamState = "upcoming" | "cliff" | "vesting" | "matured" | "cancelled";

export function streamStatus(
  s: StreamSchedule,
  atSec: number
): { state: StreamState; vested: bigint; withdrawable: bigint } {
  if (s.cancelled) {
    const vested = vestedAmountLinear(s.totalAmount, s.startAt, s.endAt, atSec, s.cliffAt);
    const withdrawn = s.withdrawn ?? 0n;
    return { state: "cancelled", vested, withdrawable: vested > withdrawn ? vested - withdrawn : 0n };
  }
  const cliff = s.cliffAt ?? s.startAt;
  let state: StreamState = "vesting";
  if (atSec < s.startAt) state = "upcoming";
  else if (atSec < cliff) state = "cliff";
  else if (atSec >= s.endAt) state = "matured";
  const vested = vestedAmountLinear(s.totalAmount, s.startAt, s.endAt, atSec, s.cliffAt);
  const withdrawn = s.withdrawn ?? 0n;
  return { state, vested, withdrawable: vested > withdrawn ? vested - withdrawn : 0n };
}
