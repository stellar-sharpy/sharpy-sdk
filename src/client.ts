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
import { signTransaction } from "./wallet.js";

export interface SharpyClientConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
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
    args: xdr.ScVal[]
  ): Promise<{ txHash: string; result: xdr.ScVal }> {
    const account = await this.server.getAccount(sourcePublicKey);
    const contract = new Contract(this.config.contractId);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simResult = await this.server.simulateTransaction(tx);
    if ("error" in simResult) throw new Error(`Simulation failed: ${simResult.error}`);

    const { assembleTransaction } = await import("@stellar/stellar-sdk/rpc");
    const assembled = assembleTransaction(tx, simResult) as any;
    const signed = await signTransaction(assembled.toXDR(), this.config.networkPassphrase);

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
      throw new Error(`Transaction failed: ${getResult?.status}`);
    }

    return {
      txHash: sendResult.hash,
      result: (getResult as any).returnValue ?? xdr.ScVal.scvVoid(),
    };
  }

  async createInvoice(params: CreateInvoiceParams): Promise<{ invoiceId: number; txHash: string }> {
    const args = [
      new Address(params.creator).toScVal(),
      nativeToScVal(params.recipients.map((r) => new Address(r.address).toScVal()), { type: "vec" }),
      nativeToScVal(params.recipients.map((r) => r.amount), { type: "vec" }),
      new Address(params.token).toScVal(),
      nativeToScVal(params.deadline, { type: "u64" }),
      buildInvoiceOptions(params),
    ];
    const { txHash, result } = await this.buildAndSubmit(params.creator, "create_invoice", args);
    return { invoiceId: Number(scValToNative(result)), txHash };
  }

  async createRecurring(params: CreateRecurringParams): Promise<{ invoiceId: number; txHash: string }> {
    const args = [
      new Address(params.creator).toScVal(),
      nativeToScVal(params.recipients.map((r) => new Address(r.address).toScVal()), { type: "vec" }),
      nativeToScVal(params.recipients.map((r) => r.amount), { type: "vec" }),
      new Address(params.token).toScVal(),
      nativeToScVal(params.deadline, { type: "u64" }),
      nativeToScVal(params.recurrenceInterval, { type: "u64" }),
      nativeToScVal(params.maxRecurrences, { type: "u32" }),
    ];
    const { txHash, result } = await this.buildAndSubmit(params.creator, "create_recurring", args);
    return { invoiceId: Number(scValToNative(result)), txHash };
  }

  async pay(payer: string, invoiceId: number, amount: bigint): Promise<{ txHash: string }> {
    const args = [
      new Address(payer).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
      nativeToScVal(amount, { type: "i128" }),
    ];
    const { txHash } = await this.buildAndSubmit(payer, "pay", args);
    return { txHash };
  }

  async releaseEscrow(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "release_escrow", args);
    return { txHash };
  }

  async refund(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [nativeToScVal(invoiceId, { type: "u64" })];
    const { txHash } = await this.buildAndSubmit(caller, "refund", args);
    return { txHash };
  }

  async cancelInvoice(caller: string, invoiceId: number): Promise<{ txHash: string }> {
    const args = [
      new Address(caller).toScVal(),
      nativeToScVal(invoiceId, { type: "u64" }),
    ];
    const { txHash } = await this.buildAndSubmit(caller, "cancel_invoice", args);
    return { txHash };
  }

  async getInvoice(invoiceId: number): Promise<Invoice> {
    const account = await this.server.getAccount(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN" // read-only placeholder
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
    if ("error" in sim) throw new Error(`Simulation failed: ${sim.error}`);
    const raw = scValToNative((sim as any).result.retval) as any;
    return mapInvoice(raw);
  }

  async createBatch(creator: string, invoices: BatchInvoiceParams[]): Promise<{ invoiceIds: number[]; txHash: string }> {
    const batchArg = xdr.ScVal.scvVec(
      invoices.map((inv) =>
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amounts"), val: nativeToScVal(inv.recipients.map((r) => r.amount), { type: "vec" }) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("deadline"), val: nativeToScVal(inv.deadline, { type: "u64" }) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("recipients"), val: nativeToScVal(inv.recipients.map((r) => new Address(r.address).toScVal()), { type: "vec" }) }),
          new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("token"), val: new Address(inv.token).toScVal() }),
        ])
      )
    );
    const args = [new Address(creator).toScVal(), batchArg];
    const { txHash, result } = await this.buildAndSubmit(creator, "create_batch", args);
    const ids = (scValToNative(result) as any[]).map(Number);
    return { invoiceIds: ids, txHash };
  }

  async getAuditLog(invoiceId: number): Promise<AuditEntry[]> {
    const account = await this.server.getAccount("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");
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

  async getNextRecurring(invoiceId: number): Promise<number | null> {
    const account = await this.server.getAccount(
      "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN"
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
}

function buildInvoiceOptions(params: CreateInvoiceParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
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
      val: params.escrowReleaseDelay
        ? xdr.ScVal.scvVec([nativeToScVal(params.escrowReleaseDelay, { type: "u64" })])
        : xdr.ScVal.scvVec([]),
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
  return {
    version: raw.version,
    creator: raw.creator,
    recipients: raw.recipients,
    amounts: raw.amounts,
    tokens: raw.tokens,
    deadline: Number(raw.deadline),
    funded: BigInt(raw.funded),
    status: raw.status,
    escrowEnabled: raw.escrow_enabled,
    escrowReleaseDelay: Number(raw.escrow_release_delay),
    completionTime: raw.completion_time ? Number(raw.completion_time) : undefined,
  };
}
