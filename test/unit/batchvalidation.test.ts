import { describe, it, expect } from "vitest";
import { validatePoolPayments, validateBatchInvoices, chunkArray, MAX_BATCH_SIZE } from "../../src/batchvalidation";

describe("validatePoolPayments", () => {
  it("accepts sane payments", () => {
    expect(() => validatePoolPayments([{ invoiceId: 1, amount: 10n }])).not.toThrow();
  });
  it("rejects empty and oversized", () => {
    expect(() => validatePoolPayments([])).toThrow(/non-empty/);
    expect(() => validatePoolPayments(Array.from({ length: 26 }, (_, i) => ({ invoiceId: i, amount: 1n })))).toThrow(/at most/);
  });
  it("rejects duplicates and bad amounts", () => {
    expect(() => validatePoolPayments([{ invoiceId: 1, amount: 1n }, { invoiceId: 1, amount: 2n }])).toThrow(/Duplicate/);
    expect(() => validatePoolPayments([{ invoiceId: 2, amount: 0n }])).toThrow(/Invalid amount/);
  });
});

describe("validateBatchInvoices", () => {
  it("accepts up to MAX_BATCH_SIZE", () => {
    const inv = { recipients: [{ address: "GAAA", amount: 1n }], deadline: 9999, token: "T" };
    expect(() => validateBatchInvoices([inv] as any)).not.toThrow();
    expect(MAX_BATCH_SIZE).toBe(10);
  });
  it("rejects empty recipients and bad deadline", () => {
    expect(() => validateBatchInvoices([{ recipients: [], deadline: 1 }] as any)).toThrow(/recipient/);
    expect(() => validateBatchInvoices([{ recipients: [{ address: "G", amount: 1n }], deadline: 0 }] as any)).toThrow(/deadline/);
  });
  it("chunks arrays", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

import { validateRefundBatch } from "../../src/batchvalidation";
import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("validateRefundBatch", () => {
  it2("accepts sane ids", () => {
    ex2(() => validateRefundBatch([1, 2, 3])).not.toThrow();
  });
  it2("rejects empty/oversized/bad ids", () => {
    ex2(() => validateRefundBatch([])).toThrow(/non-empty/);
    ex2(() => validateRefundBatch(Array.from({ length: 11 }, (_, i) => i))).toThrow(/at most/);
    ex2(() => validateRefundBatch([-1])).toThrow(/Invalid/);
  });
});
