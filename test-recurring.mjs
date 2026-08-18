import { SharpyClient, NETWORKS } from "./dist/index.js";
import { Keypair } from "@stellar/stellar-sdk";
import { execSync } from "child_process";

const network = "testnet";
const net = NETWORKS[network];
const secret = execSync("cd ~/sharpy-contracts && stellar keys show freighter1", { encoding: "utf-8" }).trim();
const freighter1 = Keypair.fromSecret(secret);

const contractId = "CCMN5OYWBWVVRIB3IDE2CCODM3CMGSMYQ7EV2UVBJ23DVIH2CL6FJRXP";
const recipient = "GA4VHEP643AU3S5YQJER76W74HAEA3KEDPO6YFBWR77TXQI72GFAPM3R";
const xlmToken = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

console.log("🔧 Testing recurring invoice on NEW contract");
console.log(`   Contract: ${contractId}`);
console.log(`   Creator: ${freighter1.publicKey()}`);

const client = new SharpyClient({
  rpcUrl: net.rpcUrl,
  networkPassphrase: net.networkPassphrase,
  contractId,
  signTransaction: async (xdr) => freighter1.sign(xdr).toXDR("base64"),
});

try {
  const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const result = await client.createRecurring({
    creator: freighter1.publicKey(),
    recipients: [{ address: recipient, amount: 1_000_000n }],
    token: xlmToken,
    deadline,
    recurrenceInterval: 86400, // 1 day
    maxRecurrences: 3,
  });

  console.log(`✅ Recurring invoice created: #${result.invoiceId}`);
  console.log(`   TX: ${result.txHash}`);
  
  // Try to read it back
  console.log("\n🔍 Reading invoice back...");
  const invoice = await client.getInvoice(result.invoiceId);
  console.log(`✅ Invoice read successfully!`);
  console.log(`   Status: ${invoice.status}`);
  console.log(`   Amount: ${invoice.amounts[0]} stroops`);
  
} catch (e) {
  console.error(`❌ Failed: ${e.message}`);
  process.exit(1);
}
