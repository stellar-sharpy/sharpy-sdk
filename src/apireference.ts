/**
 * Sharpy SDK — API reference index.
 *
 * Core: `SharpyClient` (invoices, payments, escrow, streaming, CCTP, archival).
 * Streaming: `createStream/withdrawVested/cancelStream/topUpStream` + `CreateStreamParams/StreamInfo`.
 * React: `useInvoice/useInvoicesByCreator/useCreateInvoice/useWallet/useStreaming/useStreamActions/useCCTP`.
 * Errors: `InvoiceNotFoundError/DeadlinePassedError/InvoiceNotPendingError/OverpaymentError/CallerNotCreatorError` +
 *   `StreamingNotFoundError/StreamingInvalidArgsError/StreamingPausedError/StreamingNotInitializedError` +
 *   0.3.0 modules: `DeadlineNotReachedError` ("deadline has not passed" — early refund/dispute),
 *   `PayerNotWhitelistedError`, `InvoiceFrozenError`, `InvoiceNotArchivableError`,
 *   `TrancheCapExceededError` ("tranches exceed 100%"), `BpsOutOfRangeError` (bps caps),
 *   `RouteCycleError` ("route cycle detected"/"cannot route to self"), `NotApproverError`.
 *   `mapContractError` order: "has not passed" > "not found" > "deadline" > "not pending" >
 *   tranche/bps caps > overpayment > "only creator can" > stream/whitelist/frozen/archival > route/approver.
 */

export function apireferenceHelper(input: unknown): unknown {
  // Implementation: add comprehensive API docs
  return input;
}

export { apireferenceHelper as default };
