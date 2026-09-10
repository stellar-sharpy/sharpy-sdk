export { SharpyClient } from "./client.js";
export { normalizePageOpts, paginateIds, MAX_PAGE_SIZE } from "./paginationhelpers.js";
export type { PageOpts, NormalizedPage } from "./paginationhelpers.js";
export { withRetries, backoffDelayMs } from "./retrylogic.js";
export type { RetryOpts } from "./retrylogic.js";
export { normalizePollConfig, withTimeout, TimeoutError, DEFAULT_INTERVAL_MS, DEFAULT_MAX_ATTEMPTS, MAX_ATTEMPTS_CAP } from "./timeoutconfig.js";
export type { PollConfig, NormalizedPoll } from "./timeoutconfig.js";
export { xlmToStroops, stroopsToXlm, addFeeMargin, feeWithinBudget, STROOPS_PER_XLM } from "./estimatefees.js";
export { estimateProtocolFee, previewFeeSplit, feeWithinTolerance, validateFeeBps, DEFAULT_PROTOCOL_FEE_BPS, FEE_BPS_DENOM } from "./feepreview.js";
export type { FeePreview } from "./feepreview.js";
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
export { InvoiceNotFoundError, DeadlinePassedError, InvoiceNotPendingError, OverpaymentError, CallerNotCreatorError, StreamingNotFoundError, StreamingInvalidArgsError, StreamingPausedError, StreamingNotInitializedError, DeadlineNotReachedError, PayerNotWhitelistedError, InvoiceFrozenError, InvoiceNotArchivableError, TrancheCapExceededError, BpsOutOfRangeError, RouteCycleError, NotApproverError } from "./errors.js";
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
