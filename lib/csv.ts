export type CsvCell = string | number | boolean | null | undefined;

// A text cell starting with one of these is read as a formula by Excel and
// Sheets (CSV injection). Prefixing a quote keeps it as text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell, kind: "text" | "number"): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : String(value);
  // Numbers (incl. negative margins) are data, not formulas.
  if (kind === "text" && typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export interface CsvColumn {
  header: string;
  // "number" cells are written as-is; "text" cells are formula-guarded.
  kind?: "text" | "number";
}

// RFC 4180: comma separated, CRLF line ends, quotes doubled, one header row.
export function toCsv(columns: CsvColumn[], rows: CsvCell[][]): string {
  const lines = [columns.map((c) => cell(c.header, "text")).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c, i) => cell(row[i], c.kind ?? "text")).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// UTF-8 with a byte order mark so Excel reads non-ASCII names correctly.
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeFilePart(text: string | null | undefined): string {
  return (text ?? "").trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "export";
}
