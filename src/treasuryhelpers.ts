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

export function formatClaimRow(row: ClaimRow): string {
  const short = row.account.length > 12 ? `${row.account.slice(0, 4)}...${row.account.slice(-4)}` : row.account;
  return `${short} ${row.balance.toString()} (${row.token.slice(0, 8)}…)`;
}

export function chunkScan<T>(items: T[], chunkSize: number): T[][] {
  const n = Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 10;
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
