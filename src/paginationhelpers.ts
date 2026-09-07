/**
 * Pagination utilities for creator/payer index queries.
 * The contract returns full `Vec<u64>` indexes; the SDK slices client-side.
 * `normalizePageOpts` clamps caller input so negative offsets can't wrap
 * `Array.slice` from the end and NaN/fractions can't leak through.
 */

export const MAX_PAGE_SIZE = 100;

export interface PageOpts {
  offset?: number;
  limit?: number;
}

export interface NormalizedPage {
  offset: number;
  limit: number;
}

export function normalizePageOpts(total: number, opts?: PageOpts): NormalizedPage {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  let offset = opts?.offset ?? 0;
  let limit = opts?.limit ?? safeTotal;
  if (!Number.isFinite(offset)) offset = 0;
  if (!Number.isFinite(limit)) limit = safeTotal;
  offset = Math.max(0, Math.floor(offset));
  limit = Math.max(0, Math.floor(limit));
  if (offset > safeTotal) offset = safeTotal;
  if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
  return { offset, limit };
}

export function paginateIds(ids: number[], opts?: PageOpts): { ids: number[]; total: number; offset: number; limit: number; hasMore: boolean } {
  const total = ids.length;
  const { offset, limit } = normalizePageOpts(total, opts);
  const page = ids.slice(offset, offset + limit);
  return { ids: page, total, offset, limit, hasMore: offset + limit < total };
}
