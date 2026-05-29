const STROOPS_PER_UNIT = 10_000_000n;

export function parseAmount(value: string): bigint {
  const parts = value.split(".");
  const whole = parts[0] ?? "0";
  const frac = (parts[1] ?? "").slice(0, 7).padEnd(7, "0");
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(frac);
}

export function formatAmount(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_UNIT;
  const frac = stroops % STROOPS_PER_UNIT;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(7, "0").replace(/0+$/, "")}`;
}

export function deadlineFromDays(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

export function isExpired(deadline: number): boolean {
  return Math.floor(Date.now() / 1000) > deadline;
}

export function isValidAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address);
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function explorerUrl(network: "testnet" | "mainnet", contractId: string, type: "contract" | "tx" = "contract"): string {
  const net = network === "testnet" ? "testnet" : "public";
  return `https://stellar.expert/explorer/${net}/${type}/${contractId}`;
}
