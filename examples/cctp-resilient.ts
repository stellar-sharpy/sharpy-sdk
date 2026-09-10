/**
 * Resilient CCTP inbound: hook-data + attestation poll with progress,
 * latency reporting and explorer link.
 *
 * Run:  npx tsx examples/cctp-resilient.ts
 * Env:  CALLER_PUBLIC_KEY, FORWARD_RECIPIENT (default CALLER), SOURCE_TX_HASH, SOURCE_DOMAIN (default 0)
 */
import { SharpyClient, NETWORKS, formatCctpLatency, cctpExplorerUrl } from "../src/index.js";

const CALLER = process.env.CALLER_PUBLIC_KEY ?? "";
const FORWARD_RECIPIENT = process.env.FORWARD_RECIPIENT ?? CALLER;
const SOURCE_TX_HASH = process.env.SOURCE_TX_HASH ?? "";
const SOURCE_DOMAIN = Number(process.env.SOURCE_DOMAIN ?? "0");

async function main(): Promise<void> {
  if (!CALLER || !SOURCE_TX_HASH) {
    throw new Error("Set CALLER_PUBLIC_KEY and SOURCE_TX_HASH env vars");
  }
  const signTransaction = async (xdr: string): Promise<string> => {
    void xdr;
    throw new Error("Wire a wallet signer here (Freighter signTransaction)");
  };
  const client = new SharpyClient({ ...NETWORKS.testnet, signTransaction });

  const hookData = client.buildCctpHookData(FORWARD_RECIPIENT);
  console.log(`hook data: ${hookData}`);
  console.log(`status: ${cctpExplorerUrl(SOURCE_DOMAIN, SOURCE_TX_HASH, true)}`);

  const res = await client.pollCctpAttestation(SOURCE_TX_HASH, SOURCE_DOMAIN, {
    intervalMs: 5_000,
    maxAttempts: 60,
    onAttempt: (a, m) => console.log(`poll ${a}/${m}...`),
  });
  console.log(`attestation ${formatCctpLatency(res.elapsedMs, res.attempts)}`);

  const done = await client.completeCctpInbound(CALLER, res.message, res.attestation);
  console.log(`inbound complete: ${done.txHash}`);
}

void main();
