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
  SubscriptionParams,
  InvoiceNotes,
  InvoiceTags,
  ApprovalState,
  InvoiceTemplate,
  DiscountConfig,
  InvoiceMetadata,
  InvoiceExtraMemo,
  DisputeState,
  InvoiceStats,
  CreateStreamParams,
  StreamInfo,
  TopUpStreamParams,
} from "./client.js";
export { InvoiceNotFoundError, DeadlinePassedError, InvoiceNotPendingError, OverpaymentError, CallerNotCreatorError, StreamingNotFoundError, StreamingInvalidArgsError, StreamingPausedError, StreamingNotInitializedError } from "./errors.js";
export { connectWallet, getWalletPublicKey, signTransaction } from "./wallet.js";
export { parseAmount, formatAmount, deadlineFromDays, isExpired, isValidAddress, truncateAddress, explorerUrl } from "./utils.js";

export const NETWORKS = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAEWQX36RLGP2WY6ACOREDJEIGELYV3HWWUPGV3CJMC27OWGQWZHTH6T",
  },
  mainnet: {
    rpcUrl: "https://mainnet.sorobanrpc.com",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    contractId: "",
  },
} as const;
