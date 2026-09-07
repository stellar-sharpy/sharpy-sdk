/**
 * Dashboard scan: walk every page of a creator index and print invoice status.
 *
 * Run:  npx tsx examples/paginated-dashboard.ts
 * Env:  CREATOR_PUBLIC_KEY
 */
import { SharpyClient, NETWORKS } from "../src/index.js";

const CREATOR = process.env.CREATOR_PUBLIC_KEY ?? "";

async function main(): Promise<void> {
  if (!CREATOR) {
    throw new Error("Set CREATOR_PUBLIC_KEY env var");
  }
  const client = new SharpyClient(NETWORKS.testnet);

  let total = 0;
  for await (const page of client.iterateInvoicesByCreator(CREATOR, { pageSize: 25 })) {
    for (const id of page.ids) {
      const invoice = await client.getInvoice(id);
      console.log(`#${id} status=${invoice.status} recipients=${invoice.recipients.length}`);
      total += 1;
    }
    if (!page.hasMore) break;
  }
  console.log(`scanned ${total} invoices`);
}

void main();
