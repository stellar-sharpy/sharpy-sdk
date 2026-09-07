import { describe, it, expect } from "vitest";
import { paginateIds, MAX_PAGE_SIZE } from "../../src/paginationhelpers";

describe("multi-page walks", () => {
  it("walks a 250-id index in capped pages", () => {
    const ids = Array.from({ length: 250 }, (_, i) => i + 1);
    const seen: number[] = [];
    let offset = 0;
    let pages = 0;
    for (;;) {
      const page = paginateIds(ids, { limit: 500, offset });
      seen.push(...page.ids);
      pages += 1;
      if (!page.hasMore) break;
      offset += page.ids.length;
      if (pages > 10) throw new Error("page walk did not terminate");
    }
    expect(seen).toEqual(ids);
    expect(pages).toBe(3); // 100 + 100 + 50 under MAX_PAGE_SIZE cap
  });

  it("single-item index yields one page", () => {
    const page = paginateIds([7], { limit: 10 });
    expect(page).toEqual({ ids: [7], total: 1, offset: 0, limit: 10, hasMore: false });
  });

  it("empty index yields an empty page", () => {
    expect(paginateIds([], { limit: 10 })).toEqual({
      ids: [],
      total: 0,
      offset: 0,
      limit: 10,
      hasMore: false,
    });
  });

  it("MAX_PAGE_SIZE cap is exported and sane", () => {
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});
