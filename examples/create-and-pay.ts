/**
 * Create an invoice and pay it in full.
 *
 * Run:  npx tsx examples/create-and-pay.ts
 * Env:  CREATOR_SECRET, PAYER_SECRET, TOKEN (SAC address), RECIPIENT (default: creator)
 *
 * Uses the pre-configured testnet contract CAEWQX36 via NETWORKS.testnet.
 */
import { SharpyClient, NETWORKS } from "../src/index.js";

const CREATOR = process.env.CREATOR_PUBLIC_KEY ?? "";
const RECIPIENT = process.env.RECIPIENT ?? CREATOR;
const PAYER = process.env.PAYER_PUBLIC_KEY ?? "";
const TOKEN = process.env.TOKEN ?? "";

async function main(): Promise<void> {
  if (!CREATOR || !PAYER || !TOKEN) {
    throw new Error("Set CREATOR_PUBLIC_KEY, PAYER_PUBLIC_KEY and TOKEN env vars");
  }
  const signTransaction = async (xdr: string): Promise<string> => {
    void xdr;
    throw new Error("Wire a wallet signer here (Freighter signTransaction)");
  };
  const client = new SharpyClient({ ...NETWORKS.testnet, signTransaction });

  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
  const { invoiceId, txHash } = await client.createInvoice({
    creator: CREATOR,
    recipients: [{ address: RECIPIENT, amount: 10_0000000n }],
    token: TOKEN,
    deadline,
  });
  console.log(`created invoice #${invoiceId}: ${txHash}`);

  const payout = await client.previewPayout(invoiceId, 10_0000000n);
  console.log(`payout preview: ${payout.map(String).join(", ")}`);

  const paid = await client.pay(PAYER, invoiceId, 10_0000000n);
  console.log(`paid: ${paid.txHash}`);
}

void main();
