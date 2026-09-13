export function etb(amount: number | string | null | undefined): string {
  const numeric = typeof amount === "number" ? amount : Number(amount);
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export function qty(n: number | string | null | undefined, unit = "pcs"): string {
  const numeric = typeof n === "number" ? n : Number(n);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return `${new Intl.NumberFormat("en-ET", { maximumFractionDigits: 1 }).format(safe)} ${unit}`;
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

