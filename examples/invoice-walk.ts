/**
 * Paginated invoice walk: iterate a creator index page-by-page and print TTL hints.
 *
 * Run:  npx tsx examples/invoice-walk.ts
 * Env:  CREATOR_PUBLIC_KEY
 */
import { SharpyClient, NETWORKS, ttlHint } from "../src/index.js";

const CREATOR = process.env.CREATOR_PUBLIC_KEY ?? "";

async function main(): Promise<void> {
  if (!CREATOR) throw new Error("Set CREATOR_PUBLIC_KEY env var");
  const client = new SharpyClient(NETWORKS.testnet);
  let scanned = 0;
  for await (const page of client.iterateInvoicesByCreator(CREATOR, { pageSize: 25 })) {
    for (const id of page.ids) {
      const invoice = await client.getInvoice(id);
      const hint = ttlHint(invoice.deadline);
      console.log(`#${id} status=${invoice.status} expired=${hint.expired} expiresIn=${hint.expiresInSec}s`);
      scanned += 1;
    }
    if (!page.hasMore) break;
  }
  console.log(`walked ${scanned} invoices`);
}

void main();
