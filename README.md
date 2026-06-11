# @stellar-sharpy/sdk

![npm](https://img.shields.io/npm/v/@stellar-sharpy/sdk)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green)

TypeScript SDK for the **Sharpy** advanced split payment contract on Stellar Soroban.

## Features

- 🎯 **Recurring Invoices** — Auto-generating subscription splits
- 🔒 **Escrow Protection** — Hold funds for configurable delay before release
- 📦 **Batch Operations** — Create/pay multiple invoices efficiently
- 💰 **Advanced Split Rules** — Fixed, Percentage, and Tiered splits
- 🔗 **Wallet Integration** — Freighter, Ledger, WalletConnect support
- 📊 **Full Type Safety** — Complete TypeScript definitions

## Install

```bash
npm install @stellar-sharpy/sdk
```

## Quick Start

```typescript
import { SharpyClient, connectWallet, deadlineFromDays, parseAmount } from "@stellar-sharpy/sdk";

// Connect Freighter wallet
const publicKey = await connectWallet();

// Initialize client
const client = new SharpyClient({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: "YOUR_CONTRACT_ID",
});

// Create an invoice splitting 1000 USDC between two recipients
const { invoiceId, txHash } = await client.createInvoice({
  creator: publicKey,
  recipients: [
    { address: "GABC...RECIPIENT1", amount: parseAmount("600") },
    { address: "GDEF...RECIPIENT2", amount: parseAmount("400") },
  ],
  token: "USDC_CONTRACT_ADDRESS",
  deadline: deadlineFromDays(7),
});

console.log(`Invoice #${invoiceId} created: ${txHash}`);

// Pay toward the invoice
await client.pay({
  payer: publicKey,
  invoiceId,
  amount: parseAmount("1000"),
});

// Fetch invoice status
const invoice = await client.getInvoice(invoiceId);
console.log(invoice.status); // "Released"
```

## API Reference

### `SharpyClient`

#### Constructor

```typescript
new SharpyClient(config: SharpyClientConfig)
```

| Field | Type | Description |
|-------|------|-------------|
| `rpcUrl` | `string` | Soroban RPC endpoint |
| `networkPassphrase` | `string` | Stellar network passphrase |
| `contractId` | `string` | Deployed contract ID |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `createInvoice(params)` | `Promise<{ invoiceId, txHash }>` | Create a new invoice |
| `createBatch(params)` | `Promise<{ invoiceIds, txHash }>` | Create multiple invoices |
| `createRecurring(params)` | `Promise<{ invoiceId, txHash }>` | Create recurring invoice |
| `pay(params)` | `Promise<{ txHash }>` | Pay toward an invoice |
| `poolPay(params)` | `Promise<{ txHash }>` | Pay multiple invoices |
| `releaseEscrow(invoiceId)` | `Promise<{ txHash }>` | Release escrow-held funds |
| `refund(invoiceId)` | `Promise<{ txHash }>` | Refund invoice |
| `cancelInvoice(invoiceId)` | `Promise<{ txHash }>` | Cancel invoice |
| `getInvoice(id)` | `Promise<Invoice>` | Fetch invoice by ID |
| `getPayments(id)` | `Promise<Payment[]>` | Fetch payments for an invoice |
| `getAuditLog(id)` | `Promise<AuditEntry[]>` | Get full audit trail |

### Wallet Helpers

| Function | Returns | Description |
|----------|---------|-------------|
| `connectWallet()` | `Promise<string>` | Connect Freighter, return public key |
| `getPublicKey()` | `Promise<string>` | Get connected wallet's public key |
| `signTransaction(xdr, network)` | `Promise<string>` | Sign a transaction XDR |

### Utilities

| Function | Description |
|----------|-------------|
| `formatAmount(stroops)` | Format stroops as USDC string (7 decimals) |
| `parseAmount(value)` | Parse USDC string to stroops |
| `isValidAddress(address)` | Validate a Stellar G... address |
| `deadlineFromDays(days)` | Unix timestamp N days from now |
| `isExpired(deadline)` | Check if a deadline has passed |
| `truncateAddress(address)` | Truncate for display: "GABC...XYZ" |

## Run Tests

```bash
npm test
```

## Development

```bash
npm run dev      # Watch mode
npm run lint     # Type check
npm run build    # Build distribution
```

## License

MIT
