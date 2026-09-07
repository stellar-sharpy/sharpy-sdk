import { describe, it, expect } from "vitest";
import { normalizePageOpts, paginateIds, MAX_PAGE_SIZE } from "../../src/paginationhelpers";

describe("normalizePageOpts", () => {
  it("defaults to the full range", () => {
    expect(normalizePageOpts(42)).toEqual({ offset: 0, limit: 42 });
  });

  it("clamps negative offsets to zero", () => {
    expect(normalizePageOpts(10, { offset: -5, limit: 3 })).toEqual({ offset: 0, limit: 3 });
  });

  it("clamps offsets past the end", () => {
    expect(normalizePageOpts(10, { offset: 99, limit: 5 })).toEqual({ offset: 10, limit: 5 });
  });

  it("floors fractional input", () => {
    expect(normalizePageOpts(10, { offset: 1.9, limit: 2.9 })).toEqual({ offset: 1, limit: 2 });
  });

  it("caps limits at MAX_PAGE_SIZE", () => {
    expect(normalizePageOpts(500, { limit: 5000 }).limit).toBe(MAX_PAGE_SIZE);
  });

  it("treats NaN as unset", () => {
    expect(normalizePageOpts(10, { offset: NaN, limit: NaN })).toEqual({ offset: 0, limit: 10 });
  });
});

describe("paginateIds", () => {
  const ids = [1, 2, 3, 4, 5];

  it("returns the first page with hasMore", () => {
    expect(paginateIds(ids, { limit: 2 })).toEqual({
      ids: [1, 2],
      total: 5,
      offset: 0,
      limit: 2,
      hasMore: true,
    });
  });

  it("returns the last page without hasMore", () => {
    expect(paginateIds(ids, { limit: 2, offset: 4 }).hasMore).toBe(false);
  });

  it("returns an empty page past the end", () => {
    const page = paginateIds(ids, { offset: 99 });
    expect(page.ids).toEqual([]);
    expect(page.hasMore).toBe(false);
  });
});
