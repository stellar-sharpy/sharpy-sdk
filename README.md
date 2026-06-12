# @stellar-sharpy/sdk

TypeScript SDK for the Sharpy advanced split payment protocol on Stellar Soroban.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [SharpyClient](#sharpyclient)
  - [Wallet Helpers](#wallet-helpers)
  - [Utilities](#utilities)
  - [Types](#types)
- [Networks](#networks)
- [Error Handling](#error-handling)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Sharpy SDK provides a typed TypeScript interface to the Sharpy Soroban smart contract. It handles transaction construction, simulation, signing via Freighter, and submission to the Stellar network.

The SDK is designed for use in browser environments with the Freighter wallet extension. All on-chain amounts use `bigint` (stroops) to avoid floating-point precision issues.

## Installation

```bash
npm install @stellar-sharpy/sdk
```

Or directly from GitHub:

```bash
npm install https://github.com/stellar-sharpy/sharpy-sdk.git
```

## Quick Start

```typescript
import { SharpyClient, connectWallet, parseAmount, NETWORKS } from "@stellar-sharpy/sdk";

// Connect Freighter wallet
const publicKey = await connectWallet();

// Initialize client with testnet config
const client = new SharpyClient(NETWORKS.testnet);

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
await client.pay(publicKey, invoiceId, parseAmount("1000"));

// Fetch invoice status
const invoice = await client.getInvoice(invoiceId);
console.log(invoice.status); // "Released"
```

## Configuration

### SharpyClientConfig

```typescript
interface SharpyClientConfig {
  rpcUrl: string;           // Soroban RPC endpoint
  networkPassphrase: string; // Stellar network passphrase
  contractId: string;       // Deployed Sharpy contract ID
}
```

Use the pre-built `NETWORKS` constants for testnet and mainnet configuration:

```typescript
import { NETWORKS } from "@stellar-sharpy/sdk";

const client = new SharpyClient(NETWORKS.testnet);
// or
const client = new SharpyClient(NETWORKS.mainnet);
```

## API Reference

### SharpyClient

#### `createInvoice(params)`

Creates a single invoice on-chain.

```typescript
const { invoiceId, txHash } = await client.createInvoice({
  creator: string,           // Payer's public key — must sign
  recipients: RecipientAmount[],  // Array of { address, amount }
  token: string,             // Token contract address
  deadline: number,          // Unix timestamp
  escrowEnabled?: boolean,   // Default: false
  escrowReleaseDelay?: number, // Seconds to hold funds (if escrow enabled)
  splitRules?: SplitRule[],  // Per-recipient split rules (optional)
});
```

Returns: `{ invoiceId: number, txHash: string }`

#### `createBatch(creator, invoices)`

Creates up to 10 invoices in a single transaction.

```typescript
const { invoiceIds, txHash } = await client.createBatch(publicKey, [
  { recipients, token, deadline },
  { recipients, token, deadline },
]);
```

Returns: `{ invoiceIds: number[], txHash: string }`

#### `createRecurring(params)`

Creates a recurring invoice that auto-generates the next invoice upon release.

```typescript
const { invoiceId, txHash } = await client.createRecurring({
  creator: string,
  recipients: RecipientAmount[],
  token: string,
  deadline: number,
  recurrenceInterval: number, // Seconds between invoices
  maxRecurrences: number,     // 0 = infinite
});
```

Returns: `{ invoiceId: number, txHash: string }`

#### `pay(payer, invoiceId, amount)`

Pay toward an invoice. Transfers tokens from the payer's wallet to the contract.

```typescript
const { txHash } = await client.pay(publicKey, invoiceId, parseAmount("500"));
```

Returns: `{ txHash: string }`

Constraints:
- Invoice must be in `Pending` status
- Amount must not exceed the remaining unfunded balance
- Invoice must not be past its deadline

#### `releaseEscrow(caller, invoiceId)`

Releases an escrow-held invoice once the delay period has passed.

```typescript
const { txHash } = await client.releaseEscrow(publicKey, invoiceId);
```

Returns: `{ txHash: string }`

#### `refund(caller, invoiceId)`

Refunds all payers after the deadline has passed and the invoice is not fully funded.

```typescript
const { txHash } = await client.refund(publicKey, invoiceId);
```

Returns: `{ txHash: string }`

#### `cancelInvoice(caller, invoiceId)`

Creator cancels an invoice. Refunds all payments if any have been made.

```typescript
const { txHash } = await client.cancelInvoice(publicKey, invoiceId);
```

Returns: `{ txHash: string }`

#### `getInvoice(invoiceId)`

Fetches the full invoice state from the contract. Does not require a wallet.

```typescript
const invoice = await client.getInvoice(1);
console.log(invoice.status);    // "Pending" | "Released" | "Refunded" | "Cancelled"
console.log(invoice.funded);    // bigint — total stroops funded
console.log(invoice.recipients); // string[]
console.log(invoice.amounts);   // bigint[]
```

Returns: `Invoice`

#### `getAuditLog(invoiceId)`

Returns the full audit trail for an invoice.

```typescript
const log = await client.getAuditLog(1);
// [{ action: "pay", actor: "GABC...", timestamp: 1700000000 }, ...]
```

Returns: `AuditEntry[]`

#### `getNextRecurring(invoiceId)`

Returns the ID of the next invoice in a recurring chain, or `null` if none.

```typescript
const nextId = await client.getNextRecurring(1);
```

Returns: `number | null`

---

### Wallet Helpers

#### `connectWallet()`

Connects the Freighter browser extension and returns the user's public key.

```typescript
const publicKey = await connectWallet();
```

Throws if Freighter is not installed or the user denies access.

#### `getWalletPublicKey()`

Returns the connected wallet's public key, or `null` if not connected.

```typescript
const key = await getWalletPublicKey();
```

#### `signTransaction(xdr, networkPassphrase)`

Signs a transaction XDR string using Freighter and returns the signed XDR.

```typescript
const signed = await signTransaction(xdr, NETWORKS.testnet.networkPassphrase);
```

---

### Utilities

#### `parseAmount(value)`

Converts a human-readable USDC string to stroops (bigint). USDC has 7 decimal places.

```typescript
parseAmount("100")      // 1_000_000_000n
parseAmount("1.5")      // 15_000_000n
parseAmount("0.0000001") // 1n
```

#### `formatAmount(stroops)`

Converts stroops (bigint) to a human-readable USDC string.

```typescript
formatAmount(1_000_000_000n) // "100"
formatAmount(15_000_000n)    // "1.5"
```

#### `deadlineFromDays(days)`

Returns a Unix timestamp `days` days from now.

```typescript
deadlineFromDays(7) // Unix timestamp 7 days from now
```

#### `isExpired(deadline)`

Returns `true` if the deadline has already passed.

```typescript
isExpired(invoice.deadline) // boolean
```

#### `isValidAddress(address)`

Returns `true` if the string is a valid Stellar public key.

```typescript
isValidAddress("GABC...") // boolean
```

#### `truncateAddress(address)`

Truncates a Stellar address for display.

```typescript
truncateAddress("GABCDEF...XYZ") // "GABC...RXYZ"
```

#### `explorerUrl(network, id, type)`

Builds a Stellar Expert explorer URL.

```typescript
explorerUrl("testnet", txHash, "tx")
explorerUrl("mainnet", contractId, "contract")
```

---

### Types

```typescript
interface RecipientAmount {
  address: string;
  amount: bigint;  // in stroops
}

interface Invoice {
  version: number;
  creator: string;
  recipients: string[];
  amounts: bigint[];
  tokens: string[];
  deadline: number;
  funded: bigint;
  status: "Pending" | "Released" | "Refunded" | "Cancelled";
  escrowEnabled: boolean;
  escrowReleaseDelay: number;
  completionTime?: number;
}

interface AuditEntry {
  action: string;
  actor: string;
  timestamp: number;
}

interface BatchInvoiceParams {
  recipients: RecipientAmount[];
  token: string;
  deadline: number;
}

type SplitRule =
  | { type: "Fixed"; amount: bigint }
  | { type: "Percentage"; bps: number }
  | { type: "Tiered"; threshold: bigint; bps: number };
```

## Networks

```typescript
import { NETWORKS } from "@stellar-sharpy/sdk";

NETWORKS.testnet = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  contractId: "CAYTIFPD6RFWVHMK5SPPUUIWWAAANHKOJB6GOAJS5SR5MBKZMEY2UODZ",
}

NETWORKS.mainnet = {
  rpcUrl: "https://mainnet.sorobanrpc.com",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  contractId: "", // coming soon
}
```

## Error Handling

All async methods throw a standard `Error` with a descriptive message. Wrap calls in try/catch:

```typescript
try {
  const { txHash } = await client.pay(publicKey, invoiceId, amount);
} catch (err) {
  console.error(err.message);
  // Examples:
  // "invoice is not pending"
  // "payment exceeds remaining balance"
  // "Simulation failed: ..."
  // "Transaction failed: ERROR"
}
```

## Development

### Prerequisites

- Node.js 20+
- npm 9+

### Setup

```bash
git clone https://github.com/stellar-sharpy/sharpy-sdk.git
cd sharpy-sdk
npm install
```

### Build

```bash
npm run build   # Outputs ESM, CJS, and TypeScript declarations to dist/
npm run dev     # Watch mode
```

### Lint

```bash
npm run lint    # tsc --noEmit
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
