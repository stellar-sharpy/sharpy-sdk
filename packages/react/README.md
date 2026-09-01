# @stellar-sharpy/react

React hooks for the Sharpy SDK. Wraps `SharpyClient` with React state.

## Install

```bash
npm install @stellar-sharpy/react @stellar-sharpy/sdk react
```

## Hooks

- `useInvoice(client, id, { refreshInterval })` — fetch invoice, auto-refresh
- `useInvoicesByCreator(client, creator, { limit, offset })` — paginated creator index
- `useCreateInvoice(client)` — mutation helper for `createInvoice`
- `useWallet({ autoConnect })` — Freighter wallet connection state

## Example

```tsx
import { SharpyClient, NETWORKS } from "@stellar-sharpy/sdk";
import { useInvoice, useCreateInvoice, useWallet, useInvoicesByCreator } from "@stellar-sharpy/react";

const client = new SharpyClient({ ...NETWORKS.testnet, contractId: "C..." });

function App() {
  const { publicKey, connect } = useWallet({ autoConnect: true });
  const { invoice } = useInvoice(client, 1, { refreshInterval: 10000 });
  const { create, loading } = useCreateInvoice(client);
  const { ids } = useInvoicesByCreator(client, publicKey ?? undefined);
  // ...
}
```
