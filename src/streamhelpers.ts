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
