/**
 * csv.ts — minimal, dependency-free CSV export for the admin reports.
 *
 * Excel-friendly: ";" separator (default in FR locales), CRLF line endings, and
 * a UTF-8 BOM so accents render correctly when opened directly in Excel.
 */
const SEP = ";";

const esc = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type Col<T> = { label: string; value: (row: T) => unknown };

/** One table block (header row + data rows). No BOM — compose with downloadCsv. */
export function table<T>(cols: Col<T>[], rows: T[]): string {
  const head = cols.map((c) => esc(c.label)).join(SEP);
  const body = rows.map((r) => cols.map((c) => esc(c.value(r))).join(SEP));
  return [head, ...body].join("\r\n");
}

/** YYYY-MM-DD for filenames. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Download an arbitrary Blob (e.g. a server-generated .xlsx) as a file. */
export function downloadBlob(filename: string, blob: Blob): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Download CSV blocks as a file (BOM prepended, blocks separated by a blank line). */
export function downloadCsv(filename: string, ...blocks: string[]): void {
  const text = "﻿" + blocks.filter(Boolean).join("\r\n\r\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
