export function etb(amount: number): string {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function qty(n: number, unit = "pcs"): string {
  return `${new Intl.NumberFormat("en-ET", { maximumFractionDigits: 1 }).format(n)} ${unit}`;
}

export function day(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function stamp(value: string): string {
  return value.replaceAll("_", " ");
}
