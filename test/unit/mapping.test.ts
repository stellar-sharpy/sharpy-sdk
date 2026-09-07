import { describe, it, expect } from "vitest";
import { mapContractError } from "../../src/client";
import {
  DeadlineNotReachedError,
  PayerNotWhitelistedError,
  InvoiceFrozenError,
  InvoiceNotArchivableError,
  TrancheCapExceededError,
  BpsOutOfRangeError,
  RouteCycleError,
  NotApproverError,
  InvoiceNotFoundError,
  DeadlinePassedError,
  InvoiceNotPendingError,
  OverpaymentError,
  CallerNotCreatorError,
  StreamingNotFoundError,
} from "../../src/errors";

describe("mapContractError routing table", () => {
  it("maps early-refund deadline before the generic deadline rule", () => {
    expect(mapContractError("refund failed: deadline has not passed", 1)).toBeInstanceOf(DeadlineNotReachedError);
    expect(mapContractError("invoice deadline has passed", 1)).toBeInstanceOf(DeadlinePassedError);
  });

  it("maps creator-only guards across modules", () => {
    for (const msg of [
      "only creator can cancel",
      "only creator can set whitelist",
      "only creator can edit whitelist",
      "only creator can release tranches",
      "only creator can archive",
      "only creator can set discount",
    ]) {
      expect(mapContractError(msg, 2)).toBeInstanceOf(CallerNotCreatorError);
    }
  });

  it("maps whitelist, frozen, archival and stream messages", () => {
    expect(mapContractError("payer not whitelisted", 3)).toBeInstanceOf(PayerNotWhitelistedError);
    expect(mapContractError("invoice is frozen", 3)).toBeInstanceOf(InvoiceFrozenError);
    expect(mapContractError("invoice is already frozen", 3)).toBeInstanceOf(InvoiceFrozenError);
    expect(mapContractError("only terminal invoices can be archived", 3)).toBeInstanceOf(InvoiceNotArchivableError);
    expect(mapContractError("no stream", 3)).toBeInstanceOf(StreamingNotFoundError);
  });

  it("maps cap violations before the overpayment fallback", () => {
    expect(mapContractError("tranches exceed 100%", 4)).toBeInstanceOf(TrancheCapExceededError);
    expect(mapContractError("fee bps out of range", 4)).toBeInstanceOf(BpsOutOfRangeError);
    expect(mapContractError("discount exceeds 100%", 4)).toBeInstanceOf(BpsOutOfRangeError);
    expect(mapContractError("split rules exceed 100% (10000 bps)", 4)).toBeInstanceOf(BpsOutOfRangeError);
  });

  it("maps route and approver messages", () => {
    expect(mapContractError("route cycle detected", 5)).toBeInstanceOf(RouteCycleError);
    expect(mapContractError("cannot route to self", 5)).toBeInstanceOf(RouteCycleError);
    expect(mapContractError("not approver", 5)).toBeInstanceOf(NotApproverError);
  });

  it("keeps legacy mappings intact", () => {
    expect(mapContractError("invoice not found", 6)).toBeInstanceOf(InvoiceNotFoundError);
    expect(mapContractError("invoice is not pending", 6)).toBeInstanceOf(InvoiceNotPendingError);
    expect(mapContractError("payment exceeds remaining balance", 6)).toBeInstanceOf(OverpaymentError);
  });

  it("falls back to a generic Error preserving the message", () => {
    const err = mapContractError("totally unknown failure", 7);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("totally unknown failure");
  });
});
