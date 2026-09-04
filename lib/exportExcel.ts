"use client";

import * as XLSX from "xlsx";
import type { RiwayatExportRow } from "./data/exportRiwayat";

/**
 * Browser-side .xlsx workbook building + download trigger. Deliberately kept
 * separate from lib/data/exportRiwayat.ts's pure row-shaping — this file is
 * the thin, DOM/library-touching part that isn't worth unit-testing in
 * isolation; the row logic worth getting right lives in the pure helper.
 */

export const RIWAYAT_SHEET_NAME = "Riwayat Transaksi";

/** Hand-picked column widths (characters) matching RiwayatExportRow's field
 * order — intentionally simple, no cell styling (bold/freeze), per the
 * "jangan over-engineer styling" scope for Fase 5.1. */
const RIWAYAT_COLUMN_WIDTHS = [
  5, 16, 12, 10, 14, 18, 12, 16, 16, 10, 16, 30, 30, 12, 12, 10, 12, 12, 16, 24, 20, 20,
];

export interface ExportWorkbookResult {
  fileName: string;
  rowCount: number;
}

/**
 * Builds a real .xlsx workbook from already-shaped rows and triggers a
 * browser download via XLSX.writeFile. Throws on an empty dataset or a
 * library failure — callers must surface the error, never swallow it (see
 * app/riwayat/page.tsx's handleExportExcel for the empty-state UI message
 * and try/catch).
 */
export function downloadRiwayatExcel(rows: RiwayatExportRow[], fileName: string): ExportWorkbookResult {
  if (rows.length === 0) {
    throw new Error("Tidak ada transaksi untuk diexport.");
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = RIWAYAT_COLUMN_WIDTHS.map((wch) => ({ wch }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, RIWAYAT_SHEET_NAME);

  XLSX.writeFile(workbook, fileName);

  return { fileName, rowCount: rows.length };
}
