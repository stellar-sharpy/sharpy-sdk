# Changelog

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
