/**
 * Treasury / claim convenience helpers — pure dashboard math for
 * `getClaimableBalance` / `claim` flows. No network; composes with
 * `SharpyClient.getClaimableBalance` for scans.
 */

export interface ClaimRow {
  account: string;
  token: string;
  balance: bigint;
}

export function filterClaimablePositive(rows: ClaimRow[]): ClaimRow[] {
  return rows.filter((r) => r.balance > 0n);
}

export function summarizeClaimables(rows: ClaimRow[]): { count: number; positive: number; total: bigint } {
  const positive = rows.filter((r) => r.balance > 0n);
  return {
    count: rows.length,
    positive: positive.length,
    total: positive.reduce((a, r) => a + r.balance, 0n),
  };
}
