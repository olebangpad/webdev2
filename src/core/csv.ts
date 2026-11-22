export type CsvCell = string | number | null | undefined;

function escapeCell(value: CsvCell): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 엑셀에서 한글이 깨지지 않도록 BOM을 붙인 CSV 문자열 */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  return `﻿${lines.join('\r\n')}`;
}
