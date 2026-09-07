export class InvoiceNotFoundError extends Error {
  constructor(invoiceId: number) {
    super(`Invoice #${invoiceId} not found`);
    this.name = "InvoiceNotFoundError";
  }
}

export class DeadlinePassedError extends Error {
  constructor(invoiceId: number) {
    super(`Invoice #${invoiceId} deadline has passed`);
    this.name = "DeadlinePassedError";
  }
}

export class InvoiceNotPendingError extends Error {
  constructor(invoiceId: number) {
    super(`Invoice #${invoiceId} is not pending`);
    this.name = "InvoiceNotPendingError";
  }
}

export class OverpaymentError extends Error {
  constructor(invoiceId: number) {
    super(`Payment exceeds remaining balance for invoice #${invoiceId}`);
    this.name = "OverpaymentError";
  }
}

export class CallerNotCreatorError extends Error {
  constructor(invoiceId: number) {
    super(`Only the creator can cancel invoice #${invoiceId}`);
    this.name = "CallerNotCreatorError";
  }
}

/**
 * Typed errors for streaming flows.
 * Catch these instead of parsing raw contract messages.
 */
export class StreamingNotFoundError extends Error {
  constructor(streamId: number) {
    super(`Stream #${streamId} not found`);
    this.name = "StreamingNotFoundError";
  }
}

export class StreamingInvalidArgsError extends Error {
  constructor(reason: string) {
    super(`Invalid streaming args: ${reason}`);
    this.name = "StreamingInvalidArgsError";
  }
}

export class StreamingPausedError extends Error {
  constructor(streamId: number) {
    super(`Stream #${streamId} is paused`);
    this.name = "StreamingPausedError";
  }
}

export class StreamingNotInitializedError extends Error {
  constructor() {
    super("Streaming module not initialized for this contract");
    this.name = "StreamingNotInitializedError";
  }
}

/**
 * Typed errors for the 0.3.0 modules (whitelist, tranche, fee, archival,
 * routing, approval). Thrown by `mapContractError` in client.ts — catch
 * these instead of parsing raw contract messages.
 */
export class DeadlineNotReachedError extends Error {
  constructor(invoiceId: number) {
    super(`Invoice #${invoiceId} deadline has not passed yet (refund/dispute too early)`);
    this.name = "DeadlineNotReachedError";
  }
}

export class PayerNotWhitelistedError extends Error {
  constructor(invoiceId: number) {
    super(`Payer is not whitelisted for invoice #${invoiceId}`);
    this.name = "PayerNotWhitelistedError";
  }
}

export class InvoiceFrozenError extends Error {
  constructor(invoiceId: number) {
    super(`Invoice #${invoiceId} is frozen`);
    this.name = "InvoiceFrozenError";
  }
}

export class InvoiceNotArchivableError extends Error {
  constructor(invoiceId: number) {
    super(`Only terminal invoices can be archived (invoice #${invoiceId} is still pending)`);
    this.name = "InvoiceNotArchivableError";
  }
}

export class TrancheCapExceededError extends Error {
  constructor(invoiceId: number) {
    super(`Tranche releases exceed 100% for invoice #${invoiceId}`);
    this.name = "TrancheCapExceededError";
  }
}

export class BpsOutOfRangeError extends Error {
  constructor(detail: string) {
    super(`Basis points out of range: ${detail}`);
    this.name = "BpsOutOfRangeError";
  }
}

export class RouteCycleError extends Error {
  constructor(invoiceId: number) {
    super(`Composable route cycle detected at invoice #${invoiceId}`);
    this.name = "RouteCycleError";
  }
}

export class NotApproverError extends Error {
  constructor(invoiceId: number) {
    super(`Caller is not an approver for invoice #${invoiceId}`);
    this.name = "NotApproverError";
  }
}
