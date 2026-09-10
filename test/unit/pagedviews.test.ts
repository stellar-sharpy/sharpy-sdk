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

import { describe as d2, it as it2, expect as ex2 } from "vitest";

d2("pagedviews edges", () => {
  it2("handles invalid limits", async () => {
    const { normalizePagedViewOpts: n } = await import("../../src/pagedviews");
    ex2(n({ limit: NaN }).limit).toBeUndefined();
    ex2(n({ limit: 0 }).limit).toBeUndefined();
    ex2(n({ offset: 2.9 }).offset).toBe(2);
  });
  it2("merges empty pages", async () => {
    const { mergePagedIds: m } = await import("../../src/pagedviews");
    ex2(m([])).toEqual([]);
    ex2(m([{ ids: [] }])).toEqual([]);
  });
});
