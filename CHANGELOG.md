# Changelog

## [Unreleased]
- Streaming lifecycle parity helpers — `validateCreateStreamParams/vestedAmountLinear/streamStatus` linear-vest math with cliff/cancelled handling plus lifecycle state; barrel exports + unit tests — feat/sdk-stream-parity (closes #134)
- TTL + expiry helpers — `ttlHint/expiresInSec/isInvoiceExpired/needsTtlBump/formatTtl` pure math plus `getTtlHint/isInvoiceExpiredById` view wrappers with offline fallback; barrel exports + unit tests — feat/sdk-ttl-hint (closes #133)
- Fee-preview helpers — `estimateProtocolFee/previewFeeSplit/feeWithinTolerance/validateFeeBps` pure math plus `previewFeeForInvoice` view wrapper with offline fallback; barrel exports + unit tests — feat/sdk-fee-preview (closes #132)
- Retry, timeout and fee helper polish — `withRetries` exponential backoff, `normalizePollConfig`/`withTimeout`/`TimeoutError`, pure `xlmToStroops`/`stroopsToXlm`/`addFeeMargin`/`feeWithinBudget` fee math; barrel exports + 11 unit tests — feat/sdk-resilience-polish (closes #123)
- CCTP attestation latency tracking — `pollCctpAttestation` returns `attempts`/`elapsedMs`, timeouts report actual elapsed ms, `onAttempt` progress callback; covered by stubbed-fetch unit tests — feat/sdk-cctp-latency (closes #120)
- Copy-paste example snippets — `examples/` (create-and-pay, stream-lifecycle, CCTP inbound, paginated dashboard) with real client signatures, `examples:typecheck` script, README pointer — docs/sdk-examples (closes #121)
- Unit tests for 0.3.0 methods — `test/unit` vitest suite (pagination bounds, error taxonomy, `mapContractError` routing table, multi-page walks); `mapContractError` exported for testability; `npm test` runs offline, `test:e2e` stays testnet-gated — test/sdk-030-coverage (closes #125)
- Pagination wrappers for creator/payer indexes — `normalizePageOpts/paginateIds/MAX_PAGE_SIZE`, `{ids,total,offset,limit,hasMore}` page info on `getInvoicesByCreatorPaginated/getInvoicesByPayerPaginated`, `iterateInvoicesByCreator/iterateInvoicesByPayer` async generators; negative offsets can no longer wrap `slice` — feat/sdk-pagination (closes #122)
- Typed error mapping for 0.3.0 modules — `DeadlineNotReachedError`, `PayerNotWhitelistedError`, `InvoiceFrozenError`, `InvoiceNotArchivableError`, `TrancheCapExceededError`, `BpsOutOfRangeError`, `RouteCycleError`, `NotApproverError`; `mapContractError` now covers all `only creator can` guards and fixes `deadline has not passed` mis-typing — feat/sdk-error-mapping (closes #124)

## [0.3.0] - 2026-09-07

### Added
- `createStream/withdrawVested/cancelStream/topUpStream` — linear-vesting token streams with cliff and cancelable flag
- `buildCctpHookData/pollCctpAttestation/completeCctpInbound` — CCTP EVM to Stellar inbound flow
- `useCreateStream/useWithdrawVested/useCancelStream/useTopUpStream` — React mutation hooks for streams
- `useCctpHookData/useCctpAttestation/useCompleteCctpInbound` — React hooks for CCTP inbound flows
- `useInvoice` invoiceId tracking + refreshOnIdChange; `useInvoicesByCreator` creator/total + polling
- Testnet contract `CAEWQX36RLGP2WY6ACOREDJEIGELYV3HWWUPGV3CJMC27OWGQWZHTH6T` pre-configured via `NETWORKS.testnet`
- Docs — copy-paste streaming lifecycle and CCTP end-to-end examples verified against `SharpyClient` signatures

### Changed
- Bump `@stellar-sharpy/sdk` 0.2.0 to 0.3.0 and `@stellar-sharpy/react` to 0.3.0 for aligned release
- Publish config reviewed: ESM + CJS + DTS via tsup, `files` includes dist/README/LICENSE/CHANGELOG, `publishConfig` public

## [Unreleased]
- feat(react): invoice hooks — useInvoice invoiceId tracking + refreshOnIdChange, useInvoicesByCreator creator/total/pagination
- feat(react): CCTP hooks — useCctpHookData/useCctpAttestation/useCompleteCctpInbound
- feat(react): streaming hooks — useCreateStream/useWithdrawVested/useCancelStream/useTopUpStream
- feat(sdk): streaming client — createStream/withdrawVested/cancelStream/topUpStream + streaming errors
- feat(sdk): archival — archive/isArchived/unarchive
- feat(sdk): approval — set/approve/getApproval
- feat(sdk): template — create/getTemplate
- feat(sdk): recurring pause — pause/resume
- feat(sdk): discount — get/setDiscount
- feat(sdk): metadata — get/setInvoiceMetadata
- feat(sdk): extend deadline — extendDeadline
- feat(sdk): batch refund — refundBatch
- feat(sdk): memo ext — get/setInvoiceMemoExt

### Added
- `previewPayout(invoiceId, amount)` — preview exact per-recipient payouts with dust-correct rounding (Protocol 25/26 CAP-82)
- `getInvoicesByCreator(creator)` — fetch all invoice IDs created by an address using on-chain creator index
- `claim(account, token)` — withdraw credited balance after failed recipient transfer (fallback recovery)
- `getClaimableBalance(account, token)` — query internal credited balance for account/token pair
- `createStream/withdrawVested/cancelStream/topUpStream` — linear-vesting token streams with cliff and cancelable flag
- `useCreateStream/useWithdrawVested/useCancelStream/useTopUpStream` — React mutation hooks for streams
- `useCctpHookData/useCctpAttestation/useCompleteCctpInbound` — React hooks for CCTP inbound flows
- `useInvoice` invoiceId tracking + refreshOnIdChange; `useInvoicesByCreator` creator/total + polling
- Docs polish — quickstart streaming, CCTP end-to-end, API reference, typed error docs

## [0.2.0] - 2026-07-18

### Added
- `bumpInvoiceTtl(caller, invoiceId)` — Protocol 26 CAP-78 TTL extension
- `getInvoiceFingerprint(invoiceId)` — Protocol 25/26 SHA-256 content hash
- `poolPay(payer, payments[])` — pay multiple invoices in one call
- `getPayerTotal(invoiceId, payer)` — total paid by specific address
- `getInvoiceStats(invoiceId)` — funded/total/completion_bps/unique_payers
- `createBatch(creator, invoices[])` — create up to 10 invoices
- `disputeRelease` and `resolveDispute` — escrow dispute methods
- Typed error classes: `InvoiceNotFoundError`, `DeadlinePassedError`, `OverpaymentError`, `InvoiceNotPendingError`
- Optional `signTransaction` override in `SharpyClientConfig` via signerRegistry

### Changed
- stellar-sdk upgraded to 16.0.1 (Protocol 27 ready)
- Updated testnet contract ID: `CBJ7WNBHCO5LKM7LW33D7HUT7WZI5OROVPC7IJL3A6NT6HMVJ4XUWPHJ`

## [0.1.0] - 2026-06-01

### Added
- `SharpyClient` class — wraps all contract methods via `@stellar/stellar-sdk`
- `createInvoice` — create single invoice with escrow and split rule options
- `createRecurring` — create recurring invoice
- `pay` — pay toward an invoice
- `releaseEscrow` — release escrow-held funds
- `refund` — trigger refund after deadline
- `cancelInvoice` — creator cancels invoice
- `getInvoice` — fetch invoice state
- `getNextRecurring` — get next recurring invoice ID
- Wallet helpers: `connectWallet`, `getWalletPublicKey`, `signTransaction` (Freighter v3)
- Utilities: `parseAmount`, `formatAmount`, `deadlineFromDays`, `isExpired`, `isValidAddress`, `truncateAddress`, `explorerUrl`
- `NETWORKS` constant with testnet and mainnet config
- ESM + CJS + TypeScript declaration output via tsup

## [Unreleased]
- feat(sdk): archival — archive/isArchived/unarchive
- feat(sdk): approval — set/approve/getApproval
- feat(sdk): template — create/getTemplate
- feat(sdk): recurring pause — pause/resume
- feat(sdk): discount — get/setDiscount
- feat(sdk): metadata — get/setInvoiceMetadata
- feat(sdk): extend deadline — extendDeadline
- feat(sdk): batch refund — refundBatch
- feat(sdk): memo ext — get/setInvoiceMemoExt - Invoice Tags
- feat(sdk): add InvoiceTags and get/setInvoiceTags
