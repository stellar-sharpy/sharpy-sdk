# Changelog

## [Unreleased]
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
