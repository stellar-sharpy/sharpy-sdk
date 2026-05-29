import {
  getAddress,
  signTransaction as freighterSign,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";

export async function connectWallet(): Promise<string> {
  const connected = await isConnected();
  if (!connected.isConnected) throw new Error("Freighter wallet not found. Please install the Freighter extension.");
  await requestAccess();
  const result = await getAddress();
  if ("error" in result) throw new Error(`Could not get address: ${result.error}`);
  return result.address;
}

export async function getWalletPublicKey(): Promise<string | null> {
  try {
    const connected = await isConnected();
    if (!connected.isConnected) return null;
    const result = await getAddress();
    if ("error" in result) return null;
    return result.address;
  } catch {
    return null;
  }
}

export async function signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
  const result = await freighterSign(xdr, { networkPassphrase });
  if ("error" in result) throw new Error(`Signing failed: ${result.error}`);
  return result.signedTxXdr;
}
