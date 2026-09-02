import {
  Contract,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import { CallerNotCreatorError, DeadlinePassedError, InvoiceNotFoundError, InvoiceNotPendingError, OverpaymentError } from "./errors.js";

/**
 * Placeholder account used for read-only contract simulations.
 *
 * All `simulateTransaction` calls require a source account, even for pure reads
 * that never submit. This is the Soroban "zero" address
 * `GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF` — it is not funded
 * and never signs. The RPC accepts it for simulation because no auth is required
 * for `get_*` queries. If an RPC ever rejects it, callers can pass an explicit
 * `sourceAccount` (see `getInvoice({ sourceAccount })` overload) or fund the
 * placeholder on a local quickstart node.
 */
export const READ_ONLY_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

export interface SharpyClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  signTransaction?: (xdr: string, networkPassphrase: string) => Promise<string>;
  pollIntervalMs?: number;
  pollMaxAttempts?: number;
}

export interface RecipientAmount {
  address: string;
  amount: bigint;
}

export interface CreateInvoiceParams {
  creator: string;
  recipients: RecipientAmount[];
  token: string;
  deadline: number;
  escrowEnabled?: boolean;
  escrowReleaseDelay?: number;
  splitRules?: SplitRule[];
}

export interface CreateRecurringParams {
  creator: string;
  recipients: RecipientAmount[];
  token: string;
  deadline: number;
  recurrenceInterval: number;
  maxRecurrences: number;
}

export type SplitRule =
  | { type: "Fixed"; amount: bigint }
  | { type: "Percentage"; bps: number }
  | { type: "Tiered"; threshold: bigint; bps: number };

export interface BatchInvoiceParams {
  recipients: RecipientAmount[];
  token: string;
  deadline: number;
}

export interface SubscriptionParams {
  creator: string;
  recipients: string[];
  amounts: bigint[];
  tokens: string[];
  recurrenceInterval: number;
  maxRecurrences: number;
  numCreated: number;
}

export interface DisputeState {
  releaseAt: number;
  disputed: boolean;
  disputedAt: number;
}

export interface InvoiceStats {
  funded: bigint;
  total: bigint;
  paymentCount: number;
  uniquePayers: number;
  completionBps: number;
}


export interface InvoiceExtraMemo { memo: string; updatedAt: number; }
export interface InvoiceMetadata { entries: string[]; updatedAt: number; }
export interface DiscountConfig { discountBps: number; updatedAt: number; }
export interface InvoiceTags {
  tags: string[];
  updatedAt: number;
}
export interface InvoiceNotes {
  text: string;
  updatedAt: number;
}

export interface AuditEntry {
  action: string;
  actor: string;
  timestamp: number;
}

export interface Invoice {
  id?: number;
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
  payments?: any[]; // Payment history
  claimed?: bigint[]; // Amounts claimed per recipient
  frozen?: boolean; // Invoice frozen state
  splitRules?: any[]; // Split rules per recipient
  autoResolveRules?: any[]; // Auto-resolve rules
  arbitrator?: string | null; // Escrow arbitrator address
}

function mapContractError(message: string, invoiceId?: number): Error {
  const id = invoiceId ?? 0;
  const m = message.toLowerCase();
  if (m.includes("not found")) return new InvoiceNotFoundError(id);
  if (m.includes("deadline")) return new DeadlinePassedError(id);
  if (m.includes("not pending")) return new InvoiceNotPendingError(id);
  if (m.includes("overpayment") || m.includes("exceeds") || m.includes("remaining balance")) return new OverpaymentError(id);
  if (m.includes("only creator can cancel")) return new CallerNotCreatorError(id);
  return new Error(message);
}

export class SharpyClient {
  private server: Server;
  private config: SharpyClientConfig;

  constructor(config: SharpyClientConfig) {
    this.config = config;
    this.server = new Server(config.rpcUrl);
  }

  private async buildAndSubmit(
    sourcePublicKey: string,
    method: string,
    args: xdr.ScVal[],
    invoiceId?: number
  ): Promise<{ txHash: string; result: xdr.ScVal }> {
    const account = await this.server.getAccount(sourcePublicKey);
    const contract = new Contract(this.config.contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(300) // 5 minutes — enough time for wallet popup + user signing
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if ("error" in simResult) throw mapContractError(`Simulation failed: ${simResult.error}`, invoiceId);

    const { assembleTransaction } = await import("@stellar/stellar-sdk/rpc");
    const assembled = assembleTransaction(tx, simResult).build();

    // Use the configured signTransaction function if provided, otherwise throw clear error
    if (!this.config.signTransaction) {
      throw new Error("No wallet connected. Please connect your wallet first.");
    }
    const signed = await this.config.signTransaction(assembled.toXDR(), this.config.networkPassphrase);

    const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
    const signedTx = TB.fromXDR(signed, this.config.networkPassphrase);
    const sendResult = await this.server.sendTransaction(signedTx);

    if (sendResult.status === "ERROR") throw new Error(`Submit failed: ${JSON.stringify(sendResult.errorResult)}`);

    // Poll for confirmation (configurable interval/attempts)
    const pollIntervalMs = this.config.pollIntervalMs ?? 1500;
    const pollMaxAttempts = this.config.pollMaxAttempts ?? 20;
    let getResult;
    for (let i = 0; i < pollMaxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      getResult = await this.server.getTransaction(sendResult.hash);
      if (getResult.status !== "NOT_FOUND") break;
    }

    if (!getResult || getResult.status !== "SUCCESS") {
      throw mapContractError(`Transaction failed: ${getResult?.status}`, invoiceId);
    }

    return {
      txHash: sendResult.hash,
      result: (getResult as any).returnValue ?? xdr.ScVal.scvVoid(),
    };
  }

  /** Creates a single invoice with split rules and escrow options.
   * @param params Invoice creation parameters including recipients, token, deadline, and options
   * @returns Invoice ID and transaction hash
   */
  async createInvoice(params: CreateInvoiceParams): Promise<{ invoiceId: number; txHash: string }> {
    const args = [
      new Address(params.creator).toScVal(),
      nativeToScVal(params.recipients.map((r) => new Address(r.address).toScVal())),
      nativeToScVal(params.recipients.map((r) => r.amount), { type: "i128" }),
      nativeToScVal(params.recipients.map(() => new Address(params.token).toScVal())),
      nativeToScVal(params.deadline, { type: "u64" }),
      buildInvoiceOptions(params),
    ];
    const { txHash, result } = await this.buildAndSubmit(params.creator, "create_invoice", args);
    return { invoiceId: Number(scValToNative(result)), txHash };
  }

  /** Creates a recurring invoice that auto-generates the next invoice on release.
   * @param params Recurring invoice parameters including interval and max recurrences
   * @returns Invoice ID and transaction hash
   */
  async createRecurring(params: CreateRecurringParams): Promise<{ invoiceId: number; txHash: string }> {
    const args = [
      new Address(params.creator).toScVal(),
      nativeToScVal(params.recipients.map((r) => new Address(r.address).toScVal())),
      nativeToScVal(params.recipients.map((r) => r.amount), { type: "i128" }),
      nativeToScVal(params.recipients.map(() => new Address(params.token).toScVal())),
      nativeToScVal(params.deadline, { type: "u64" }),
      nativeToScVal(params.recurrenceInterval, { type: "u64" }),
      nativeToScVal(params.maxRecurrences, { type: "u32" }),
    ];
    const { txHash, result } = await this.buildAndSubmit(params.creator, "create_recurring", args);
    return { invoiceId: Number(scValToNative(result)), txHash };
  }

  /** Pays toward a single invoice.
   * @param payer Payer address (must sign)
   * @param invoiceId Target invoice ID
   * @param amount Amount in stroops (bigint)
   * @returns Transaction hash
   */
  async pay(payer: string, invoiceId: number, amount: bigint): Promise<{ txHash: string }> {
    const args = [
      new Address(payer).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
      nativeToScVal(amount, { type: "i128" }),
    ];
    const { txHash } = await this.buildAndSubmit(payer, "pay", args, invoiceId);
    return { txHash };
  }

  /**
   * Pay toward an invoice with an optional tip to treasury.
   * Wraps pay_with_tip (handoff #110, #51). Tip is transferred directly to treasury
   * and does NOT count toward funded/total. Set tip=0 to behave like pay().
   * @param payer Payer address (must sign)
   * @param invoiceId Target invoice ID
   * @param amount Amount in stroops
   * @param tip Gratuity in stroops (non-negative, default 0)
   */
  async payWithTip(payer: string, invoiceId: number, amount: bigint, tip: bigint = 0n): Promise<{ txHash: string }> {
    const args = [
      new Address(payer).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(tip, { type: "i128" }),
    ];
    const { txHash } = await this.buildAndSubmit(payer, "pay_with_tip", args, invoiceId);
    return { txHash };
  }

  /** Releases escrow-held funds once the delay period has passed.
   * @param caller Caller address
   * @param invoiceId Invoice ID with escrow enabled
   */
  async releaseEscrow(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "release_escrow", args, invoiceId);
    return { txHash };
  }

  /**
   * Refunds all payers after deadline has passed and invoice is not fully funded.
   *
   * Preconditions (enforced on-chain):
   * - Invoice status is `Pending`
   * - `ledger.timestamp > deadline` — deadline has passed
   * - `funded < total` — not fully funded (if fully funded, funds are in escrow or already released)
   *
   * Permissionless — any address can trigger the refund; the caller only pays the transaction fee.
   *
   * @param caller Any address that will sign and pay the fee
   * @param invoiceId Invoice ID that has passed its deadline
   * @returns Transaction hash of the `refund` invocation
   * @throws {InvoiceNotFoundError} If invoice does not exist
   */
  async refund(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "refund", args, invoiceId);
    return { txHash };
  }

  /**
   * Release an invoice directly — distributes funds to recipients.
   *
   * Preconditions (enforced on-chain):
   * - Invoice status is `Pending`
   * - `funded == total` — invoice is fully funded
   * - Escrow is **not** enabled (for escrow invoices use {@link releaseEscrow})
   * - Deadline has not been exceeded for the release path
   *
   * On `_release`, the contract iterates recipients, transfers `amount` per
   * split rule, falls back to `credit_account` if a transfer fails, and emits
   * `invoice_released`. Funds are held in the contract's vault prior to this call.
   *
   * @param caller Caller address (must sign; typically a payer or the creator)
   * @param invoiceId Invoice ID to release — must be fully funded
   * @returns Transaction hash
   * @throws {InvoiceNotFoundError} If invoice does not exist
   */
  async release(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "release", args, invoiceId);
    return { txHash };
  }

  /**
   * Dispute an escrow release — blocks automatic release until arbitrated.
   *
   * Only the invoice `creator` (or optional `arbitrator` if set in
   * {@link InvoiceOptions}) may call this. The escrow must be in `Pending`
   * hold and `timestamp < release_at`; otherwise the transaction panics.
   *
   * On success, `DisputeState.disputed` is set to `true` and an `audit`
   * entry with action `"dispute"` is appended. Funds remain locked until
   * {@link resolveDispute} is called.
   *
   * @param caller Creator/arbitrator address — must sign and be the invoice creator
   * @param invoiceId Escrow invoice ID to dispute — must be fully funded and in escrow hold
   * @returns Transaction hash
   */
  async disputeRelease(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "dispute_release", args, invoiceId);
    return { txHash };
  }

  /**
   * Resolve a disputed escrow — either release to recipients or refund payers.
   *
   * Only the contract `admin` (or arbitrator with auth) may call this.
   * Requires that {@link disputeRelease} has already been called and
   * `DisputeState.disputed == true`.
   *
   * @param caller Admin/arbitrator address — must sign
   * @param invoiceId Disputed invoice ID — must be in disputed escrow state
   * @param shouldRelease `true` to release funds to recipients, `false` to refund all payers
   * @returns Transaction hash
   */
  async resolveDispute(caller: string, invoiceId: number, shouldRelease: boolean): Promise<{ txHash: string }> {
    const args = [
      nativeToScVal(invoiceId, { type: "u64" }),
      xdr.ScVal.scvBool(shouldRelease),
    ];
    const { txHash } = await this.buildAndSubmit(caller, "resolve_dispute", args, invoiceId);
    return { txHash };
  }

  /**
   * Cancels an invoice and refunds all payments.
   *
   * **Creator-only:** the contract asserts `invoice.creator == caller`
   * and panics with `"only creator can cancel"` if violated. The SDK maps
   * this to {@link CallerNotCreatorError} via {@link mapContractError}.
   *
   * Behavior:
   * - If `funded == 0` the invoice becomes `Cancelled`.
   * - If `funded > 0` all payers are refunded and status becomes `Refunded`.
   * - Only `Pending` invoices can be cancelled.
   *
   * @param caller Creator address — must be the invoice's `creator`; must sign the transaction
   * @param invoiceId Invoice ID to cancel
   * @throws {CallerNotCreatorError} When `caller` is not the invoice creator
   * @throws {InvoiceNotPendingError} When invoice is not in `Pending` status
   * @throws {InvoiceNotFoundError} When invoice does not exist
   */
  async cancelInvoice(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [
      new Address(caller).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
    ];
    const { txHash } = await this.buildAndSubmit(caller, "cancel_invoice", args, invoiceId);
    return { txHash };
  }

  /**
   * Fetches full invoice state by ID.
   *
   * Uses {@link READ_ONLY_ACCOUNT} (`G…WHF`) as the simulation source account.
   * This placeholder is unfunded and never signs — it exists only because
   * `simulateTransaction` requires a source account even for pure reads that
   * require no auth. The RPC accepts it for `get_*` queries. If your RPC
   * rejects unknown accounts, pass a funded `sourceAccount` instead.
   *
   * @param invoiceId Invoice ID to fetch
   * @param opts.sourceAccount Optional funded account to use as simulation source (defaults to {@link READ_ONLY_ACCOUNT})
   * @throws InvoiceNotFoundError if the invoice does not exist
   */
  async getInvoice(invoiceId: number, opts?: { sourceAccount?: string }): Promise<Invoice> {
    const source = opts?.sourceAccount ?? READ_ONLY_ACCOUNT;
    const account = await this.server.getAccount(source);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("get_invoice", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    return mapInvoice(raw);
  }

  /** Creates up to 10 invoices in a single transaction.
   * @param creator Creator address
   * @param invoices Array of invoice parameters (max 10)
   * @returns Array of invoice IDs and transaction hash
   */
  async createBatch(creator: string, invoices: BatchInvoiceParams[]): Promise<{ invoiceIds: number[]; txHash: string }> {
    const batchArg = xdr.ScVal.scvVec(
      invoices.map((inv) =>
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amounts"), val: nativeToScVal(inv.recipients.map((r) => r.amount)) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("deadline"), val: nativeToScVal(inv.deadline, { type: "u64" }) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("recipients"), val: nativeToScVal(inv.recipients.map((r) => new Address(r.address).toScVal())) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("token"), val: new Address(inv.token).toScVal() }),
        ])
      )
    );
    const args = [new Address(creator).toScVal(), batchArg];
    const { txHash, result } = await this.buildAndSubmit(creator, "create_batch", args);
    const ids = (scValToNative(result) as any[]).map(Number);
    return { invoiceIds: ids, txHash };
  }

  /** Fetches the full audit trail for an invoice.
   * @param invoiceId Invoice ID
   * @returns Array of audit entries with action, actor, and timestamp
   */
  async getAuditLog(invoiceId: number): Promise<AuditEntry[]> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_audit_log", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any[];
    return raw.map((e) => ({ action: e.action, actor: e.actor, timestamp: Number(e.timestamp) }));
  }

  /** Returns the next invoice ID in a recurring chain, or null if none.
   * @param invoiceId Current invoice ID
   */
  async getNextRecurring(invoiceId: number): Promise<number | null> {
    const account = await this.server.getAccount(
      READ_ONLY_ACCOUNT
    );
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call("get_next_recurring", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval);
    return raw ?? null;
  }

  /**
   * Returns recurring subscription params for a recurring invoice (handoff #112).
   * Returns null for non-recurring invoices.
   * @param invoiceId Recurring invoice ID
   */
  async getRecurringParams(invoiceId: number): Promise<SubscriptionParams | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_recurring_params", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return {
      creator: raw.creator,
      recipients: raw.recipients,
      amounts: (raw.amounts as any[]).map((v: any) => BigInt(v)),
      tokens: raw.tokens,
      recurrenceInterval: Number(raw.recurrence_interval ?? raw.recurrenceInterval ?? 0),
      maxRecurrences: Number(raw.max_recurrences ?? raw.maxRecurrences ?? 0),
      numCreated: Number(raw.num_created ?? raw.numCreated ?? 0),
    };
  }

  /**
   * Attach or replace free-text notes on an invoice. Only creator can call (handoff #113/#114).
   * @param caller Creator address (must sign)
   * @param invoiceId Target invoice
   * @param text Free-form notes text
   */
  async setInvoiceNotes(caller: string, invoiceId: number, text: string): Promise<{ txHash: string }> {
    const args = [
      new Address(caller).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
      nativeToScVal(text, { type: "string" }),
    ];
    const { txHash } = await this.buildAndSubmit(caller, "set_invoice_notes", args, invoiceId);
    return { txHash };
  }

  /**
   * Returns notes attached to an invoice, or null if none set (handoff #113/#114).
   * @param invoiceId Invoice ID
   */
  async getInvoiceNotes(invoiceId: number): Promise<InvoiceNotes | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoice_notes", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return { text: String(raw.text ?? raw), updatedAt: Number(raw.updated_at ?? raw.updatedAt ?? 0) };
  }

  /** Pays toward multiple invoices in a single transaction. All invoices must use the same token.
   * @param payer Payer address (must sign)
   * @param payments Array of { invoiceId, amount } pairs
   * @returns Transaction hash
   */
  async poolPay(payer: string, payments: { invoiceId: number; amount: bigint }[]): Promise<{ txHash: string }> {
    const paymentsArg = xdr.ScVal.scvVec(
      payments.map((p) =>
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amount"), val: nativeToScVal(p.amount, { type: "i128" }) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("invoice_id"), val: nativeToScVal(p.invoiceId, { type: "u64" }) }),
        ])
      )
    );
    const args = [new Address(payer).toScVal(), paymentsArg];
    const { txHash } = await this.buildAndSubmit(payer, "pool_pay", args);
    return { txHash };
  }

  /** Returns the total amount paid toward an invoice by a specific address.
   * @param invoiceId Invoice ID
   * @param payer Payer address to query
   * @returns Total paid in stroops
   */
  async getPayerTotal(invoiceId: number, payer: string): Promise<bigint> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call(
        "get_payer_total",
        nativeToScVal(invoiceId, { type: "u64" }),
        new Address(payer).toScVal(),
      ))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    return BigInt(scValToNative((sim as any).result.retval) ?? 0);
  }

  /**
   * Returns funding stats for an invoice: funded, total, payment_count, unique_payers, completion_bps.
   * @param invoiceId Invoice ID
   * @returns {@link InvoiceStats} with completion in basis points (10000 = fully funded)
   */
  async getInvoiceStats(invoiceId: number): Promise<InvoiceStats> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoice_stats", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any;
    return {
      funded: BigInt(raw.funded ?? 0),
      total: BigInt(raw.total ?? 0),
      paymentCount: Number(raw.payment_count ?? 0),
      uniquePayers: Number(raw.unique_payers ?? 0),
      completionBps: Number(raw.completion_bps ?? 0),
    };
  }

  /**
   * Freeze an invoice — blocks further pay() calls. Admin-only (handoff #111, #45).
   * @param caller Admin address (must sign)
   * @param invoiceId Invoice to freeze
   */
  async freezeInvoice(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "freeze_invoice", args, invoiceId);
    return { txHash };
  }

  /**
   * Unfreeze a previously frozen invoice — re-enables payments. Admin-only.
   * @param caller Admin address (must sign)
   * @param invoiceId Invoice to unfreeze
   */
  async unfreezeInvoice(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "unfreeze_invoice", args, invoiceId);
    return { txHash };
  }

  /**
   * Returns escrow/dispute state for an escrow-enabled invoice.
   *
   * Reads `DisputeState { release_at, disputed, disputed_at }` stored when a
   * fully-funded escrow invoice enters hold. The state is created on
   * `pay()` when `funded == total` and `escrowEnabled` is true, and is
   * removed after {@link releaseEscrow} or {@link resolveDispute}.
   *
   * @param invoiceId Invoice ID to query
   * @returns {@link DisputeState} if escrow is active, or `null` if no escrow
   *   state exists (never entered or already resolved)
   * @throws {InvoiceNotFoundError} If the invoice does not exist
   */
  async getEscrowState(invoiceId: number): Promise<DisputeState | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_escrow_state", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return {
      releaseAt: Number(raw.release_at ?? raw.releaseAt ?? 0),
      disputed: Boolean(raw.disputed ?? false),
      disputedAt: Number(raw.disputed_at ?? raw.disputedAt ?? 0),
    };
  }

  /**
   * Bump TTL for an entire recurring chain starting from a given invoice.
   * Walks via getNextRecurring and calls bump_invoice_ttl for each invoice
   * in the chain. Useful to prevent archival of long-lived subscription chains
   * (Protocol 26 CAP-78).
   * @param caller Address paying fees (anyone can call)
   * @param startInvoiceId Head of the recurring chain
   * @param maxHops Safety cap to avoid infinite walks (default 50)
   * @returns Array of { invoiceId, txHash } for each bumped invoice
   */
  async bumpInvoiceTtlChain(
    caller: string,
    startInvoiceId: number,
    maxHops: number = 50
  ): Promise<{ invoiceId: number; txHash: string }[]> {
    const results: { invoiceId: number; txHash: string }[] = [];
    let current: number | null = startInvoiceId;
    let hops = 0;
    while (current !== null && hops < maxHops) {
      const { txHash } = await this.bumpInvoiceTtl(caller, current);
      results.push({ invoiceId: current, txHash });
      current = await this.getNextRecurring(current);
      hops++;
    }
    return results;
  }

  /**
   * Convenience helper matching the issue spec: follows the recurring chain via
   * `getNextRecurring` and bumps TTL for each invoice. Stops when
   * `getNextRecurring` returns null and returns the count of invoices bumped.
   *
   * This is a thin wrapper around {@link bumpInvoiceTtlChain} that returns a
   * simple count, matching the `bumpRecurringChain(startInvoiceId, caller)` spec.
   *
   * @param startInvoiceId Head of the recurring chain
   * @param caller Address paying fees (anyone can call)
   * @param maxHops Safety cap to avoid infinite walks (default 50)
   * @returns Number of invoices whose TTL was bumped
   */
  async bumpRecurringChain(
    startInvoiceId: number,
    caller: string,
    maxHops: number = 50
  ): Promise<number> {
    const results = await this.bumpInvoiceTtlChain(caller, startInvoiceId, maxHops);
    return results.length;
  }

  /**
   * Extend the TTL of an invoice entry to prevent archival.
   * Protocol 26 CAP-78: anyone can call this to keep long-lived or recurring
   * invoices accessible without a full state restore operation.
   * @param caller - The address submitting the transaction (pays fees)
   * @param invoiceId - The invoice to bump
   */
  async bumpInvoiceTtl(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "bump_invoice_ttl", args);
    return { txHash };
  }

  /**
   * Get a deterministic SHA-256 fingerprint of an invoice's immutable fields.
   * Protocol 25 (X-Ray) / Protocol 26 crypto host functions: tamper-evident
   * content hash committing to invoice_id, deadline, recipient count, and total.
   * Use for off-chain verification, receipt generation, and audit trails.
   * @param invoiceId - The invoice to fingerprint
   * @returns 32-byte hex string (SHA-256 hash)
   */
  async getInvoiceFingerprint(invoiceId: number): Promise<string> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoice_fingerprint", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any;
    // Convert bytes to hex string for easy use in JS
    if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
      return Buffer.from(raw).toString("hex");
    }
    return String(raw);
  }

  /**
   * Returns the schema version of an invoice.
   * Useful for forward-compatibility checks when multiple contract versions coexist.
   * @param invoiceId Invoice ID
   * @returns version number (currently 1)
   */
  async getInvoiceVersion(invoiceId: number): Promise<number> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoice_version", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    return Number(scValToNative((sim as any).result.retval));
  }

  /**
   * Returns the treasury address configured during initialize.
   * Admin query for dashboards and protocol analytics (handoff #109).
   * @returns Treasury Stellar address (strkey)
   */
  async getTreasury(): Promise<string> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_treasury"))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    return String(scValToNative((sim as any).result.retval));
  }

  /**
   * Preview exact per-recipient payout distribution for a given payment amount.
   * Pure read operation that simulates the split logic with dust-correct rounding.
   * Handles proportional splits, fixed amounts, percentage rules, and tiered rules.
   * @param invoiceId - Invoice ID to preview
   * @param amount - Hypothetical payment amount in stroops
   * @returns Array of bigint amounts per recipient (same order as invoice.recipients)
   */
  async previewPayout(invoiceId: number, amount: bigint): Promise<bigint[]> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call(
        "preview_payout",
        nativeToScVal(invoiceId, { type: "u64" }),
        nativeToScVal(amount, { type: "i128" })
      ))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any[];
    return raw.map((v) => BigInt(v));
  }

  /**
   * Fetch all invoice IDs created by a specific address using the on-chain creator index.
   * Enables efficient dashboard pagination without scanning all invoice IDs.
   * The contract returns the full list; slicing is done client-side in the SDK.
   *
   * @param creator - Creator address to query
   * @param opts.offset - Offset into result set (default: 0)
   * @param opts.limit - Max results to return (default: all — backwards compatible)
   * @returns Array of invoice IDs created by this address (sliced if pagination opts provided)
   */
  async getInvoicesByCreator(
    creator: string,
    opts?: { offset?: number; limit?: number }
  ): Promise<number[]> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoices_by_creator", new Address(creator).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any[];
    const ids = raw.map(Number);
    if (opts?.offset !== undefined || opts?.limit !== undefined) {
      const offset = opts.offset ?? 0;
      const limit = opts.limit ?? ids.length;
      return ids.slice(offset, offset + limit);
    }
    return ids;
  }

  /**
   * Withdraw credited balance after a failed recipient transfer during invoice release.
   * Fallback recovery mechanism: if a recipient's transfer fails during `_release`,
   * funds are credited to their internal balance and can be claimed with this method.
   * Permissionless — anyone can trigger the claim for any account/token pair; the
   * contract transfers from vault to `account`.
   *
   * Supports both signatures for backwards compatibility:
   * - `claim(account, token)` — `account` signs (self-claim)
   * - `claim(caller, account, token)` — `caller` signs, funds go to `account` (permissionless relay)
   *
   * @param accountOrCaller - Account holder address, or caller when using 3-arg form
   * @param tokenOrAccount - Token contract address (2-arg form) or account holder (3-arg form)
   * @param tokenOpt - Token contract address (only for 3-arg form)
   * @returns Claimed amount and transaction hash
   */
  async claim(accountOrCaller: string, tokenOrAccount: string, tokenOpt?: string): Promise<{ amount: bigint; txHash: string }>;
  async claim(account: string, token: string): Promise<{ amount: bigint; txHash: string }>;
  async claim(caller: string, account: string, token: string): Promise<{ amount: bigint; txHash: string }>;
  async claim(a: string, b: string, c?: string): Promise<{ amount: bigint; txHash: string }> {
    let caller: string;
    let account: string;
    let token: string;
    if (c !== undefined) {
      // 3-arg form: claim(caller, account, token)
      caller = a;
      account = b;
      token = c;
    } else {
      // 2-arg form: claim(account, token) — caller is the holder
      caller = a;
      account = a;
      token = b;
    }
    const args = [new Address(account).toScVal(), new Address(token).toScVal()];
    const { txHash, result } = await this.buildAndSubmit(caller, "claim", args);
    return { amount: BigInt(scValToNative(result)), txHash };
  }

  /**
   * Returns the total number of invoices ever created on-chain.
   * Reads the global counter directly — O(1), no iteration required.
   * Useful for landing page stats, dashboards, and protocol analytics.
   * @returns Total invoice count
   */
  async getInvoiceCount(): Promise<number> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoice_count"))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    return Number(scValToNative((sim as any).result.retval) ?? 0);
  }

  /**
   * Fetch all invoice IDs that a given address has paid toward.
   * Indexed on every pay() call with deduplication — each invoice appears at most once.
   * Use this to build a payer's payment history or "Invoices Paid" tab.
   * The contract returns the full list; slicing is done client-side in the SDK.
   *
   * @param payer - Payer address to query
   * @param opts.offset - Offset into result set (default: 0)
   * @param opts.limit - Max results to return (default: all — backwards compatible)
   * @returns Array of invoice IDs paid by this address (sliced if pagination opts provided)
   */
  async getInvoicesByPayer(
    payer: string,
    opts?: { offset?: number; limit?: number }
  ): Promise<number[]> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoices_by_payer", new Address(payer).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any[];
    const ids = raw.map(Number);
    if (opts?.offset !== undefined || opts?.limit !== undefined) {
      const offset = opts.offset ?? 0;
      const limit = opts.limit ?? ids.length;
      return ids.slice(offset, offset + limit);
    }
    return ids;
  }

  /**
   * Paginated wrapper for getInvoicesByCreator. Fetches all IDs then slices client-side.
   * For large creators, use limit/offset to page through results efficiently.
   * @param creator Creator address
   * @param opts.limit Max results to return (default: all)
   * @param opts.offset Offset into result set (default: 0)
   */
  async getInvoicesByCreatorPaginated(
    creator: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<{ ids: number[]; total: number }> {
    const all = await this.getInvoicesByCreator(creator);
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? all.length;
    return { ids: all.slice(offset, offset + limit), total: all.length };
  }

  /**
   * Paginated wrapper for getInvoicesByPayer. Fetches all IDs then slices client-side.
   * @param payer Payer address
   * @param opts.limit Max results to return (default: all)
   * @param opts.offset Offset into result set (default: 0)
   */
  async getInvoicesByPayerPaginated(
    payer: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<{ ids: number[]; total: number }> {
    const all = await this.getInvoicesByPayer(payer);
    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? all.length;
    return { ids: all.slice(offset, offset + limit), total: all.length };
  }

  /**
   * Query claimable balance for an account/token pair.
   * Returns the internal credited balance available for withdrawal via `claim()`.
   * @param account - Account address
   * @param token - Token contract address
   * @returns Claimable balance in stroops
   */
  async getClaimableBalance(account: string, token: string): Promise<bigint> {
    const acc = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call(
        "get_claimable_balance",
        new Address(account).toScVal(),
        new Address(token).toScVal()
      ))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    return BigInt(scValToNative((sim as any).result.retval) ?? 0);
  }
  /**
   * Builds the hookData buffer for a CCTP `depositForBurnWithHook` call targeting Stellar.
   *
   * Hook data layout (per Circle spec):
   *   bytes  0–23: reserved magic bytes (all zero)
   *   bytes 24–27: hook data version (uint32 BE, currently 0)
   *   bytes 28–31: forwardRecipient byte length (uint32 BE)
   *   bytes 32+  : forwardRecipient as UTF-8 encoded Stellar strkey (G…, C…, or M…)
   *
   * Both `mintRecipient` and `destinationCaller` on the EVM burn call must be set to
   * the CctpForwarder contract address (bytes32 encoded), NOT the forwardRecipient.
   *
   * @param forwardRecipientStrkey - Stellar strkey of the final recipient (G…, C…, or M…)
   * @returns Hex string (no 0x prefix) — pass as hookData to EVM depositForBurnWithHook
   */
  buildCctpHookData(forwardRecipientStrkey: string): string {
    const isValid =
      new Address(forwardRecipientStrkey) !== null; // will throw if invalid
    void isValid;

    const recipientBytes = Buffer.from(forwardRecipientStrkey, "utf8");
    const hookData = Buffer.alloc(32 + recipientBytes.length);
    // bytes 0–23: zeroed (reserved)
    hookData.writeUInt32BE(0, 24);                  // hook version = 0
    hookData.writeUInt32BE(recipientBytes.length, 28); // recipient byte length
    recipientBytes.copy(hookData, 32);              // recipient strkey UTF-8
    return hookData.toString("hex");
  }

  /**
   * Polls the Circle CCTP attestation API until the transfer is fully attested.
   * Returns the raw message hex and attestation hex needed to call completeCctpInbound.
   *
   * Circle attestation API endpoint:
   *   GET https://iris-api-sandbox.circle.com/v2/messages/{sourceDomain}?transactionHash={txHash}
   *
   * @param sourceTxHash - EVM transaction hash of the depositForBurn call
   * @param sourceDomain - CCTP domain of the source chain (e.g. 0=Ethereum, 3=Arbitrum, 6=Base)
   * @param opts.intervalMs - Polling interval in ms (default 5000)
   * @param opts.maxAttempts - Max polling attempts before giving up (default 60 = 5 minutes)
   * @returns { message: string, attestation: string } — both hex strings
   */
  async pollCctpAttestation(
    sourceTxHash: string,
    sourceDomain: number,
    opts?: { intervalMs?: number; maxAttempts?: number }
  ): Promise<{ message: string; attestation: string }> {
    const intervalMs = opts?.intervalMs ?? 5_000;
    const maxAttempts = opts?.maxAttempts ?? 60;
    const isTestnet = this.config.networkPassphrase.includes("Test SDF");
    const apiBase = isTestnet
      ? "https://iris-api-sandbox.circle.com"
      : "https://iris-api.circle.com";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(
        `${apiBase}/v2/messages/${sourceDomain}?transactionHash=${sourceTxHash}`
      );
      if (res.ok) {
        const data = await res.json() as any;
        const messages: any[] = data?.messages ?? [];
        const complete = messages.find((m: any) => m.status === "complete");
        if (complete) {
          return {
            message: complete.message,
            attestation: complete.attestation,
          };
        }
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    throw new Error(
      `CCTP attestation not complete after ${maxAttempts} attempts (${(maxAttempts * intervalMs) / 1000}s). ` +
      `Check status at: https://iris-api${isTestnet ? "-sandbox" : ""}.circle.com/v2/messages/${sourceDomain}?transactionHash=${sourceTxHash}`
    );
  }

  /**
   * Completes an inbound CCTP transfer by calling `mint_and_forward` on the
   * CctpForwarder contract on Stellar.
   *
   * Prerequisites:
   *  - The EVM `depositForBurnWithHook` was submitted with mintRecipient = destinationCaller = CctpForwarder
   *  - The hook data encodes forwardRecipient as the invoice recipient / Sharpy contract
   *  - Circle has attested the message (use pollCctpAttestation to wait for this)
   *
   * @param caller - Stellar address that will sign and submit the transaction
   * @param message - Raw CCTP message hex from Circle attestation API
   * @param attestation - Raw attestation hex from Circle attestation API
   * @returns Transaction hash of the mint_and_forward invocation
   */
  async completeCctpInbound(
    caller: string,
    message: string,
    attestation: string
  ): Promise<{ txHash: string }> {
    const isTestnet = this.config.networkPassphrase.includes("Test SDF");
    const forwarderAddress = isTestnet
      ? "CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ"
      : "CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T";

    // CctpForwarder.mint_and_forward(message: Bytes, attestation: Bytes)
    const messageBytes = Buffer.from(message.replace(/^0x/, ""), "hex");
    const attestationBytes = Buffer.from(attestation.replace(/^0x/, ""), "hex");

    const account = await this.server.getAccount(caller);
    const contract = new Contract(forwarderAddress);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(
        contract.call(
          "mint_and_forward",
          nativeToScVal(messageBytes, { type: "bytes" }),
          nativeToScVal(attestationBytes, { type: "bytes" })
        )
      )
      .setTimeout(300)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if ("error" in simResult) {
      throw new Error(`CCTP mint_and_forward simulation failed: ${simResult.error}`);
    }

    const { assembleTransaction } = await import("@stellar/stellar-sdk/rpc");
    const assembled = assembleTransaction(tx, simResult).build();

    if (!this.config.signTransaction) {
      throw new Error("No wallet connected. Please connect your wallet first.");
    }
    const signed = await this.config.signTransaction(assembled.toXDR(), this.config.networkPassphrase);
    const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
    const signedTx = TB.fromXDR(signed, this.config.networkPassphrase);
    const sendResult = await this.server.sendTransaction(signedTx);

    if (sendResult.status === "ERROR") {
      throw new Error(`CCTP inbound tx failed: ${JSON.stringify(sendResult.errorResult)}`);
    }

    let getResult;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      getResult = await this.server.getTransaction(sendResult.hash);
      if (getResult.status !== "NOT_FOUND") break;
    }

    if (!getResult || getResult.status !== "SUCCESS") {
      throw new Error(`CCTP inbound tx did not confirm: ${getResult?.status}`);
    }

    return { txHash: sendResult.hash };
  }

/**
   * Get tags for an invoice.
   * @param invoiceId Invoice ID
   */
  async getInvoiceTags(invoiceId: number): Promise<InvoiceTags | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoice_tags", nativeToScVal(invoiceId, { type: "u64" })))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return { tags: (raw.tags as any[]).map(String), updatedAt: Number(raw.updated_at ?? raw.updatedAt ?? 0) };
  }

  /**
   * Set tags for an invoice — creator only.
   */
  async setInvoiceTags(caller: string, invoiceId: number, tags: string[]): Promise<{ txHash: string }> {
    const tagsArg = xdr.ScVal.scvVec(tags.map(t => nativeToScVal(t, { type: "string" })));
    const args = [new Address(caller).toScVal(), nativeToScVal(invoiceId, { type: "u64" }), tagsArg];
    const { txHash } = await this.buildAndSubmit(caller, "set_invoice_tags", args, invoiceId);
    return { txHash };
  }

async getInvoiceMemoExt(invoiceId: number): Promise<InvoiceExtraMemo | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase }).addOperation(contract.call("get_invoice_memo_ext", nativeToScVal(invoiceId, {type:"u64"}))).setTimeout(30).build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return { memo: String(raw.memo), updatedAt: Number(raw.updated_at ?? 0) };
  }
  async setInvoiceMemoExt(caller: string, invoiceId: number, memo: string): Promise<{txHash:string}> {
    const args=[new Address(caller).toScVal(), nativeToScVal(invoiceId,{type:"u64"}), nativeToScVal(memo,{type:"string"})];
    const {txHash}=await this.buildAndSubmit(caller,"set_invoice_memo_ext",args,invoiceId);
    return {txHash};
  }

async refundBatch(caller: string, invoiceIds: number[]): Promise<{count:number; txHash:string}> {
    const idsArg = xdr.ScVal.scvVec(invoiceIds.map(id=> nativeToScVal(id,{type:"u64"})));
    const {txHash, result}=await this.buildAndSubmit(caller,"refund_batch",[new Address(caller).toScVal(), idsArg]);
    return {count: Number(scValToNative(result)), txHash};
  }

async extendDeadline(caller: string, invoiceId: number, newDeadline: number): Promise<{txHash:string}> {
    const args=[new Address(caller).toScVal(), nativeToScVal(invoiceId,{type:"u64"}), nativeToScVal(newDeadline,{type:"u64"})];
    const {txHash}=await this.buildAndSubmit(caller,"extend_deadline",args,invoiceId);
    return {txHash};
  }

async getInvoiceMetadata(invoiceId: number): Promise<InvoiceMetadata | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase }).addOperation(contract.call("get_invoice_metadata", nativeToScVal(invoiceId,{type:"u64"}))).setTimeout(30).build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return { entries: (raw.entries as any[]).map(String), updatedAt: Number(raw.updated_at ?? 0) };
  }
  async setInvoiceMetadata(caller: string, invoiceId: number, entries: string[]): Promise<{txHash:string}> {
    const entriesArg = xdr.ScVal.scvVec(entries.map(e=> nativeToScVal(e,{type:"string"})));
    const args=[new Address(caller).toScVal(), nativeToScVal(invoiceId,{type:"u64"}), entriesArg];
    const {txHash}=await this.buildAndSubmit(caller,"set_invoice_metadata",args,invoiceId);
    return {txHash};
  }

async getDiscount(invoiceId: number): Promise<DiscountConfig | null> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase }).addOperation(contract.call("get_discount", nativeToScVal(invoiceId,{type:"u64"}))).setTimeout(30).build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw mapContractError(`Simulation failed: ${sim.error}`, invoiceId);
    const raw = scValToNative((sim as any).result.retval) as any;
    if (!raw) return null;
    return { discountBps: Number(raw.discount_bps ?? 0), updatedAt: Number(raw.updated_at ?? 0) };
  }
  async setDiscount(caller: string, invoiceId: number, discountBps: number): Promise<{txHash:string}> {
    const args=[new Address(caller).toScVal(), nativeToScVal(invoiceId,{type:"u64"}), nativeToScVal(discountBps,{type:"u32"})];
    const {txHash}=await this.buildAndSubmit(caller,"set_discount",args,invoiceId);
    return {txHash};
  }

async pauseRecurring(caller: string, invoiceId: number): Promise<{txHash:string}> {
    const args=[new Address(caller).toScVal(), nativeToScVal(invoiceId,{type:"u64"})];
    const {txHash}=await this.buildAndSubmit(caller,"pause_recurring",args,invoiceId);
    return {txHash};
  }
  async resumeRecurring(caller: string, invoiceId: number): Promise<{txHash:string}> {
    const args=[new Address(caller).toScVal(), nativeToScVal(invoiceId,{type:"u64"})];
    const {txHash}=await this.buildAndSubmit(caller,"resume_recurring",args,invoiceId);
    return {txHash};
  }
  async isRecurringPaused(invoiceId: number): Promise<boolean> {
    const account = await this.server.getAccount(READ_ONLY_ACCOUNT);
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase }).addOperation(contract.call("is_recurring_paused", nativeToScVal(invoiceId,{type:"u64"}))).setTimeout(30).build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    return Boolean(scValToNative((sim as any).result.retval));
  }
}

function buildInvoiceOptions(params: CreateInvoiceParams): xdr.ScVal {
  // Soroban encodes Option<T> as: None → scvVoid(), Some(v) → the value directly (not wrapped).
  // ScMap keys must be in lexicographic order to match the Rust #[contracttype] struct layout.
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("arbitrator"),
      // Option<Address>: None = scvVoid(), Some(addr) = address ScVal
      val: xdr.ScVal.scvVoid(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("auto_resolve_rules"),
      val: xdr.ScVal.scvVec([]),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("escrow_enabled"),
      val: xdr.ScVal.scvBool(params.escrowEnabled ?? false),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("escrow_release_delay"),
      // Option<u64>: None = scvVoid(), Some(v) = the u64 value directly
      val: params.escrowReleaseDelay
        ? nativeToScVal(params.escrowReleaseDelay, { type: "u64" })
        : xdr.ScVal.scvVoid(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("split_rules"),
      val: xdr.ScVal.scvVec(
        (params.splitRules ?? []).map((r) => encodeSplitRule(r))
      ),
    }),
  ]);
}

function encodeSplitRule(rule: SplitRule): xdr.ScVal {
  if (rule.type === "Fixed") {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Fixed"),
      nativeToScVal(rule.amount, { type: "i128" }),
    ]);
  }
  if (rule.type === "Percentage") {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Percentage"),
      nativeToScVal(rule.bps, { type: "u32" }),
    ]);
  }
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Tiered"),
    nativeToScVal(rule.threshold, { type: "i128" }),
    nativeToScVal(rule.bps, { type: "u32" }),
  ]);
}

function mapInvoice(raw: any): Invoice {
  // Handle status enum - scValToNative might return {tag: "Pending", values: void} or just "Pending"
  let status: "Pending" | "Released" | "Refunded" | "Cancelled";
  if (typeof raw.status === "string") {
    status = raw.status as any;
  } else if (raw.status?.tag) {
    status = raw.status.tag;
  } else {
    status = "Pending"; // fallback
  }

  return {
    version: raw.version,
    creator: raw.creator,
    recipients: raw.recipients,
    amounts: raw.amounts,
    tokens: raw.tokens,
    deadline: Number(raw.deadline),
    funded: BigInt(raw.funded),
    status,
    escrowEnabled: raw.escrow_enabled,
    escrowReleaseDelay: Number(raw.escrow_release_delay),
    completionTime: raw.completion_time ? Number(raw.completion_time) : undefined,
    payments: raw.payments || [],
    claimed: raw.claimed?.map((c: any) => BigInt(c)) || [],
    frozen: raw.frozen || false,
    splitRules: raw.split_rules || [],
    autoResolveRules: raw.auto_resolve_rules || [],
    arbitrator: raw.arbitrator || null,
  };
}