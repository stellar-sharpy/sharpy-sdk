/**
 * Paged-view helpers — shared by React `usePagedInvoices` and dashboards.
 * Merges `{ids,total,hasMore}` pages and normalizes view options.
 */

export interface PagedViewOpts {
  limit?: number;
  offset?: number;
}

export function normalizePagedViewOpts(opts?: PagedViewOpts): { limit: number | undefined; offset: number } {
  const offset = opts?.offset ?? 0;
  const safeOffset = Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0;
  let limit = opts?.limit;
  if (limit !== undefined) {
    if (!Number.isFinite(limit) || limit <= 0) limit = undefined;
    else limit = Math.min(Math.floor(limit), 100);
  }
  return { limit, offset: safeOffset };
}

export function mergePagedIds(pages: { ids: number[] }[]): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const p of pages) {
    for (const id of p.ids) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}
