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
import { DeadlinePassedError, InvoiceNotFoundError, InvoiceNotPendingError, OverpaymentError } from "./errors.js";

export interface SharpyClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  signTransaction?: (xdr: string, networkPassphrase: string) => Promise<string>;
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

    // Poll for confirmation
    let getResult;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
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

  /** Releases escrow-held funds once the delay period has passed.
   * @param caller Caller address
   * @param invoiceId Invoice ID with escrow enabled
   */
  async releaseEscrow(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "release_escrow", args, invoiceId);
    return { txHash };
  }

  /** Refunds all payers after deadline has passed and invoice is not fully funded.
   * @param caller Any address can trigger the refund
   * @param invoiceId Invoice ID that has passed its deadline
   */
  async refund(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "refund", args, invoiceId);
    return { txHash };
  }

  /** Cancels an invoice and refunds all payments. Only the creator can cancel.
   * @param caller Creator address
   * @param invoiceId Invoice ID to cancel
   */
  /** Cancels an invoice and refunds all payments. Only the creator can cancel.
   * @param caller Creator address
   * @param invoiceId Invoice ID to cancel
   */
  async cancelInvoice(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [
      new Address(caller).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
    ];
    const { txHash } = await this.buildAndSubmit(caller, "cancel_invoice", args, invoiceId);
    return { txHash };
  }

  /** Fetches full invoice state by ID.
   * @param invoiceId Invoice ID to fetch
   * @throws InvoiceNotFoundError if the invoice does not exist
   */
  async getInvoice(invoiceId: number): Promise<Invoice> {
    const account = await this.server.getAccount(
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF" // read-only placeholder
    );
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
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
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
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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

  /** Returns funding stats for an invoice: funded, total, payment_count, unique_payers, completion_bps.
   * @param invoiceId Invoice ID
   */
  async getInvoiceStats(invoiceId: number): Promise<{ funded: bigint; total: bigint; paymentCount: number; uniquePayers: number; completionBps: number }> {
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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
   * Preview exact per-recipient payout distribution for a given payment amount.
   * Pure read operation that simulates the split logic with dust-correct rounding.
   * Handles proportional splits, fixed amounts, percentage rules, and tiered rules.
   * @param invoiceId - Invoice ID to preview
   * @param amount - Hypothetical payment amount in stroops
   * @returns Array of bigint amounts per recipient (same order as invoice.recipients)
   */
  async previewPayout(invoiceId: number, amount: bigint): Promise<bigint[]> {
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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
   * @param creator - Creator address to query
   * @returns Array of invoice IDs created by this address
   */
  async getInvoicesByCreator(creator: string): Promise<number[]> {
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoices_by_creator", new Address(creator).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any[];
    return raw.map(Number);
  }

  /**
   * Withdraw credited balance after a failed recipient transfer during invoice release.
   * Fallback recovery mechanism: if a recipient's transfer fails during `_release`,
   * funds are credited to their internal balance and can be claimed with this method.
   * @param account - Account address to claim from (must sign)
   * @param token - Token contract address
   * @returns Claimed amount and transaction hash
   */
  async claim(account: string, token: string): Promise<{ amount: bigint; txHash: string }> {
    const args = [new Address(account).toScVal(), new Address(token).toScVal()];
    const { txHash, result } = await this.buildAndSubmit(account, "claim", args);
    return { amount: BigInt(scValToNative(result)), txHash };
  }

  /**
   * Returns the total number of invoices ever created on-chain.
   * Reads the global counter directly — O(1), no iteration required.
   * Useful for landing page stats, dashboards, and protocol analytics.
   * @returns Total invoice count
   */
  async getInvoiceCount(): Promise<number> {
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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
   * @param payer - Payer address to query
   * @returns Array of invoice IDs paid by this address
   */
  async getInvoicesByPayer(payer: string): Promise<number[]> {
    const account = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
    const contract = new Contract(this.config.contractId);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: this.config.networkPassphrase })
      .addOperation(contract.call("get_invoices_by_payer", new Address(payer).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any[];
    return raw.map(Number);
  }

  /**
   * Query claimable balance for an account/token pair.
   * Returns the internal credited balance available for withdrawal via `claim()`.
   * @param account - Account address
   * @param token - Token contract address
   * @returns Claimable balance in stroops
   */
  async getClaimableBalance(account: string, token: string): Promise<bigint> {
    const acc = await this.server.getAccount("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
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
