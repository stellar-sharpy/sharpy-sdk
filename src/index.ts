export { SharpyClient } from "./client.js";
export type {
  SharpyClientConfig,
  CreateInvoiceParams,
  CreateRecurringParams,
  BatchInvoiceParams,
  RecipientAmount,
  SplitRule,
  Invoice,
  AuditEntry,
} from "./client.js";
export { InvoiceNotFoundError, DeadlinePassedError, InvoiceNotPendingError, OverpaymentError } from "./errors.js";
export { connectWallet, getWalletPublicKey, signTransaction } from "./wallet.js";
export { parseAmount, formatAmount, deadlineFromDays, isExpired, isValidAddress, truncateAddress, explorerUrl } from "./utils.js";

export const NETWORKS = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAYTIFPD6RFWVHMK5SPPUUIWWAAANHKOJB6GOAJS5SR5MBKZMEY2UODZ",
  },
  mainnet: {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "",
  },
} as const;
