/**
 * Full linear-vesting stream lifecycle: create, top up, withdraw, cancel.
 *
 * Run:  npx tsx examples/stream-lifecycle.ts
 * Env:  CREATOR_PUBLIC_KEY, RECIPIENT, TOKEN (SAC address)
 */
import { SharpyClient, NETWORKS } from "../src/index.js";

const CREATOR = process.env.CREATOR_PUBLIC_KEY ?? "";
const RECIPIENT = process.env.RECIPIENT ?? CREATOR;
const TOKEN = process.env.TOKEN ?? "";

async function main(): Promise<void> {
  if (!CREATOR || !TOKEN) {
    throw new Error("Set CREATOR_PUBLIC_KEY and TOKEN env vars");
  }
  const signTransaction = async (xdr: string): Promise<string> => {
    void xdr;
    throw new Error("Wire a wallet signer here (Freighter signTransaction)");
  };
  const client = new SharpyClient({ ...NETWORKS.testnet, signTransaction });

  const now = Math.floor(Date.now() / 1000);
  const { streamId, txHash } = await client.createStream({
    creator: CREATOR,
    recipient: RECIPIENT,
    token: TOKEN,
    totalAmount: 100_0000000n,
    startAt: now + 60,
    endAt: now + 30 * 24 * 3600,
    cliffAt: now + 7 * 24 * 3600,
    cancelable: true,
  });
  console.log(`created stream #${streamId}: ${txHash}`);

  const topped = await client.topUpStream(CREATOR, streamId, 50_0000000n);
  console.log(`topped up: ${topped.txHash}`);

  const withdrew = await client.withdrawVested(RECIPIENT, streamId);
  console.log(`withdrew vested: ${withdrew.txHash}`);

  const cancelled = await client.cancelStream(CREATOR, streamId);
  console.log(`cancelled: ${cancelled.txHash}`);
}

void main();
