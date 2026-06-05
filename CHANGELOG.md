# Changelog

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
