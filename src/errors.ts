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
