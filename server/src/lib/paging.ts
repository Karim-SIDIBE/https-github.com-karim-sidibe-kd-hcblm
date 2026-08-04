/**
 * paging.ts — shared server-side pagination/sort plumbing for admin lists.
 *
 * Every paged endpoint returns the same envelope: { data, total, page, pageSize }
 * so the admin can render real pagers instead of slicing full tables client-side.
 */
import { z } from "zod";

export const pageQuery = z.object({
  q: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().optional(), // "field:asc" | "field:desc"
});
export type PageQuery = z.infer<typeof pageQuery>;

export type SortSpec = { field: string; dir: "asc" | "desc" };

/** Parse a "field:dir" sort against a whitelist; unknown fields fall back. */
export function sortSpec(raw: string | undefined, allowed: readonly string[], fallback: SortSpec): SortSpec {
  if (!raw) return fallback;
  const [field, dir] = raw.split(":");
  if (!field || !allowed.includes(field)) return fallback;
  return { field, dir: dir === "asc" ? "asc" : "desc" };
}

export function envelope<T>(data: T[], total: number, page: number, pageSize: number, extra: Record<string, unknown> = {}) {
  return { data, total, page, pageSize, ...extra };
}
