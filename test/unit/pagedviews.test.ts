import { describe, it, expect } from "vitest";
import { normalizePagedViewOpts, mergePagedIds } from "../../src/pagedviews";

describe("normalizePagedViewOpts", () => {
  it("defaults offset to zero", () => {
    expect(normalizePagedViewOpts()).toEqual({ limit: undefined, offset: 0 });
  });
  it("clamps negative offsets", () => {
    expect(normalizePagedViewOpts({ offset: -5 }).offset).toBe(0);
  });
  it("caps limit at 100", () => {
    expect(normalizePagedViewOpts({ limit: 5000 }).limit).toBe(100);
  });
});

describe("mergePagedIds", () => {
  it("dedupes across pages", () => {
    expect(mergePagedIds([{ ids: [1, 2] }, { ids: [2, 3] }])).toEqual([1, 2, 3]);
  });
});
