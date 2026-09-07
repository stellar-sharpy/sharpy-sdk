import { describe, it, expect } from "vitest";
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
  CallerNotCreatorError,
  StreamingNotFoundError,
} from "../../src/errors";

describe("0.3.0 error taxonomy", () => {
  it("names match class names for instanceof narrowing", () => {
    const cases: Array<[Error, string]> = [
      [new DeadlineNotReachedError(1), "DeadlineNotReachedError"],
      [new PayerNotWhitelistedError(2), "PayerNotWhitelistedError"],
      [new InvoiceFrozenError(3), "InvoiceFrozenError"],
      [new InvoiceNotArchivableError(4), "InvoiceNotArchivableError"],
      [new TrancheCapExceededError(5), "TrancheCapExceededError"],
      [new BpsOutOfRangeError("fee bps out of range"), "BpsOutOfRangeError"],
      [new RouteCycleError(7), "RouteCycleError"],
      [new NotApproverError(8), "NotApproverError"],
    ];
    for (const [err, name] of cases) {
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(name);
    }
  });

  it("messages carry the invoice id", () => {
    expect(new DeadlineNotReachedError(41).message).toContain("41");
    expect(new PayerNotWhitelistedError(42).message).toContain("42");
    expect(new TrancheCapExceededError(43).message).toContain("43");
    expect(new RouteCycleError(44).message).toContain("44");
    expect(new NotApproverError(45).message).toContain("45");
  });

  it("existing errors still construct", () => {
    expect(new InvoiceNotFoundError(1).name).toBe("InvoiceNotFoundError");
    expect(new CallerNotCreatorError(2).name).toBe("CallerNotCreatorError");
    expect(new StreamingNotFoundError(3).name).toBe("StreamingNotFoundError");
  });
});
