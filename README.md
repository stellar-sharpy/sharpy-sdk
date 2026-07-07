# @stellar-sharpy/sdk

![npm](https://img.shields.io/npm/v/@stellar-sharpy/sdk)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![stellar-sdk](https://img.shields.io/badge/stellar--sdk-16.0.1-6C63FF)
![License](https://img.shields.io/badge/license-MIT-green)

TypeScript SDK for the **Sharpy** advanced split payment contract on Stellar Soroban.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    @stellar-sharpy/sdk                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   SharpyClient                       │   │
│  │                                                     │   │
│  │  Invoice Methods          Read Methods              │   │
│  │  ─────────────────        ────────────────          │   │
│  │  createInvoice()          getInvoice()              │   │
│  │  createBatch()            getAuditLog()             │   │
│  │  createRecurring()        getNextRecurring()        │   │
│  │  pay()                    getPayerTotal()           │   │
│  │  poolPay()                                         │   │
│  │  releaseEscrow()                                   │   │
│  │  refund()                                          │   │
│  │  cancelInvoice()                                   │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐   │
│  │              Transaction Builder                     │   │
│  │   build → simulate → sign → submit → poll           │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│        ┌─────────────────┴──────────────────┐              │
│        │                                    │              │
│  ┌─────▼──────┐                    ┌────────▼────────┐     │
│  │  wallet.ts │                    │    utils.ts     │     │
│  │            │                    │                 │     │
│  │ Freighter  │                    │ parseAmount()   │     │
│  │ connect    │                    │ formatAmount()  │     │
│  │ sign       │                    │ deadlineFrom    │     │
│  │ getAddress │                    │ isExpired()     │     │
│  └────────────┘                    │ explorerUrl()   │     │
│                                    └─────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              @stellar/stellar-sdk 16.0.1                     │
│              Stellar Soroban RPC                             │
│              Protocol 27 (Zipper) compatible                 │
└─────────────────────────────────────────────────────────────┘
```

## Protocol Compatibility

| stellar-sdk | Protocol | Status |
|-------------|----------|--------|
| 16.0.1 | Protocol 27 (Zipper) | Current |

## Install

```bash
npm install @stellar-sharpy/sdk
```

Or from GitHub:

```bash
npm install https://github.com/stellar-sharpy/sharpy-sdk.git
```

## Quick Start

```typescript
import { SharpyClient, connectWallet, deadlineFromDays, parseAmount, NETWORKS } from "@stellar-sharpy/sdk";

const publicKey = await connectWallet();
const client = new SharpyClient(NETWORKS.testnet);

const { invoiceId } = await client.createInvoice({
  creator: publicKey,
  recipients: [
    { address: "GABC...RECIPIENT1", amount: parseAmount("600") },
    { address: "GDEF...RECIPIENT2", amount: parseAmount("400") },
  ],
  token: "USDC_CONTRACT_ADDRESS",
  deadline: deadlineFromDays(7),
});

await client.pay(publicKey, invoiceId, parseAmount("1000"));

const invoice = await client.getInvoice(invoiceId);
console.log(invoice.status); // "Released"
```

## API Reference

### `SharpyClient`

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
| `createBatch(creator, invoices[])` | `Promise<{ invoiceIds, txHash }>` | Batch create up to 10 invoices |
| `createRecurring(params)` | `Promise<{ invoiceId, txHash }>` | Create recurring invoice |
| `pay(payer, invoiceId, amount)` | `Promise<{ txHash }>` | Pay toward an invoice |
| `releaseEscrow(caller, invoiceId)` | `Promise<{ txHash }>` | Release escrow-held funds |
| `refund(caller, invoiceId)` | `Promise<{ txHash }>` | Refund invoice |
| `cancelInvoice(caller, invoiceId)` | `Promise<{ txHash }>` | Cancel invoice |
| `getInvoice(id)` | `Promise<Invoice>` | Fetch invoice by ID |
| `getAuditLog(id)` | `Promise<AuditEntry[]>` | Full audit trail |
| `getNextRecurring(id)` | `Promise<number \| null>` | Next recurring invoice ID |

### Wallet Helpers

| Function | Returns | Description |
|----------|---------|-------------|
| `connectWallet()` | `Promise<string>` | Connect Freighter, return public key |
| `getWalletPublicKey()` | `Promise<string \| null>` | Get connected wallet's public key |
| `signTransaction(xdr, passphrase)` | `Promise<string>` | Sign a transaction XDR |

### Utilities

| Function | Description |
|----------|-------------|
| `parseAmount(value)` | Parse USDC string to stroops (bigint) |
| `formatAmount(stroops)` | Format stroops as USDC string |
| `deadlineFromDays(days)` | Unix timestamp N days from now |
| `isExpired(deadline)` | Check if deadline has passed |
| `isValidAddress(address)` | Validate a Stellar G... address |
| `truncateAddress(address)` | Truncate for display: `GABC...XYZ` |
| `explorerUrl(network, id, type)` | Build Stellar Expert explorer URL |

### NETWORKS Constant

```typescript
import { NETWORKS } from "@stellar-sharpy/sdk";

NETWORKS.testnet // { rpcUrl, networkPassphrase, contractId }
NETWORKS.mainnet // { rpcUrl, networkPassphrase, contractId }
```

## Build

```bash
npm run build   # tsup → ESM + CJS + TypeScript declarations
npm run lint    # tsc --noEmit
```

## Related Repos

| Repo | Description |
|------|-------------|
| [sharpy-contracts](https://github.com/stellar-sharpy/sharpy-contracts) | Soroban smart contract |
| [sharpy-app](https://github.com/stellar-sharpy/sharpy-app) | Next.js frontend |

## License

MIT
