import Decimal from "decimal.js";

export function etb(amount: number | string | null | undefined): string {
  const numeric = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

// Quantities carry up to 3 decimals. Round first so float noise
// (0.1 + 0.2) never prints as 0.30000000000000004.
export function qtyNum(n: number | string | null | undefined): string {
  const numeric = typeof n === "number" ? n : Number(n);
  const safe = Number.isFinite(numeric) ? Math.round(numeric * 1000) / 1000 : 0;
  return new Intl.NumberFormat("en-ET", { maximumFractionDigits: 3 }).format(safe);
}

export function qty(n: number | string | null | undefined, unit = "pcs"): string {
  return `${qtyNum(n)} ${unit}`;
}

// Parses a quantity field. Returns the number, or an error message to show.
export function parseQuantity(raw: string | null | undefined): { value: number } | { error: string } {
  const text = (raw ?? "").trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return { error: "Quantity must be a positive number." };
  const frac = text.split(".")[1] ?? "";
  if (frac.length > 3) return { error: "Quantity can have at most 3 decimal places." };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return { error: "Quantity must be greater than 0." };
  return { value };
}

// Margin of a sale: revenue minus COGS. Null when COGS is unknown.
export function saleMargin(
  totalCost: string | number | null | undefined,
  cogsTotalCost: string | number | null | undefined,
): Decimal | null {
  if (cogsTotalCost == null || cogsTotalCost === "" || totalCost == null || totalCost === "") return null;
  try {
    return new Decimal(totalCost).minus(cogsTotalCost);
  } catch {
    return null;
  }
}

export function day(iso?: string | null | Date | number): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function stamp(value?: string | null): string {
  if (!value) return "—";
  return String(value).replaceAll("_", " ");
}
