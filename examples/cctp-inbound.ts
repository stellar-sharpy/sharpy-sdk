/**
 * CCTP end-to-end: build hook data, burn on EVM (out of scope), poll the
 * Circle attestation, then complete the inbound mint on Stellar.
 *
 * Run:  npx tsx examples/cctp-inbound.ts
 * Env:  CALLER_PUBLIC_KEY, FORWARD_RECIPIENT (strkey), SOURCE_TX_HASH, SOURCE_DOMAIN (default 0 = Ethereum)
 */
import { SharpyClient, NETWORKS } from "../src/index.js";

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
  console.log(`hook data for the EVM burn: ${hookData}`);
  console.log("...perform the EVM burn with the hook data, then polling attestation...");

  const { message, attestation } = await client.pollCctpAttestation(SOURCE_TX_HASH, SOURCE_DOMAIN, {
    intervalMs: 5_000,
    maxAttempts: 60,
  });
  console.log(`attestation ready (message ${message.length} chars)`);

  const done = await client.completeCctpInbound(CALLER, message, attestation);
  console.log(`inbound complete: ${done.txHash}`);
}

void main();
