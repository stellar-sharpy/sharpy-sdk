/**
 * Treasury dashboard scan: summarize claimable balances across accounts/tokens.
 *
 * Run:  npx tsx examples/treasury-dashboard.ts
 * Env:  ACCOUNTS (comma-separated G…), TOKENS (comma-separated C…)
 */
import { SharpyClient, NETWORKS, summarizeClaimables, topClaimables, formatClaimRow } from "../src/index.js";

const ACCOUNTS = (process.env.ACCOUNTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TOKENS = (process.env.TOKENS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

async function main(): Promise<void> {
  if (ACCOUNTS.length === 0 || TOKENS.length === 0) {
    throw new Error("Set ACCOUNTS and TOKENS env vars (comma-separated)");
  }
  const client = new SharpyClient(NETWORKS.testnet);
  const rows: { account: string; token: string; balance: bigint }[] = [];
  for (const account of ACCOUNTS) {
    for (const token of TOKENS) {
      const balance = await client.getClaimableBalance(account, token);
      rows.push({ account, token, balance });
    }
  }
  const summary = summarizeClaimables(rows);
  console.log(`scanned ${summary.count} pairs: ${summary.positive} claimable, total ${summary.total.toString()}`);
  for (const row of topClaimables(rows, 10)) {
    console.log(` - ${formatClaimRow(row)}`);
  }
}

void main();
