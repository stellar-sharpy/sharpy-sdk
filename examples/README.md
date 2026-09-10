# SDK examples

Runnable copy-paste snippets against testnet contract
`CAEWQX36RLGP2WY6ACOREDJEIGELYV3HWWUPGV3CJMC27OWGQWZHTH6T`.

| File | Flow |
| ---- | ---- |
| `create-and-pay.ts` | `createInvoice` + `previewPayout` + `pay` |
| `stream-lifecycle.ts` | `createStream` + `topUpStream` + `withdrawVested` + `cancelStream` |
| `cctp-inbound.ts` | `buildCctpHookData` + `pollCctpAttestation` + `completeCctpInbound` |
| `paginated-dashboard.ts` | `iterateInvoicesByCreator` + `getInvoice` status scan |
| `cctp-resilient.ts` | `buildCctpHookData` + resilient `pollCctpAttestation` with latency + `completeCctpInbound` |
| `treasury-dashboard.ts` | `getClaimableBalance` scan + `summarizeClaimables/topClaimables` |
| `invoice-walk.ts` | `iterateInvoicesByCreator` + `getInvoice` + `ttlHint` walk |

Run with `npx tsx examples/<file>.ts` after setting the env vars listed at
the top of each file. Every snippet throws until a real wallet signer is
wired into `signTransaction` — plug in Freighter's `signTransaction`.
Read-only snippets (`paginated-dashboard.ts`) need no signer.
