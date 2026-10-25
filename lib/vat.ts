import Decimal from "decimal.js";

// Ethiopian standard VAT rate. The API now computes and returns VAT on every
// sale (net / vatAmount / grossTotal); this rate is only for previews on forms.
export const VAT_RATE_PERCENT = 15;
const VAT_RATE = new Decimal(VAT_RATE_PERCENT).div(100);

export interface VatBreakdown {
  net: Decimal;
  vat: Decimal;
  gross: Decimal;
}

function toDecimal(value: string | number | null | undefined): Decimal {
  try {
    return new Decimal(value ?? 0);
  } catch {
    return new Decimal(0);
  }
}

// Preview of what the server will compute: VAT rounded half-up per sale line.
export function withVat(net: string | number | null | undefined, exempt = false): VatBreakdown {
  const n = toDecimal(net).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vat = exempt ? new Decimal(0) : n.times(VAT_RATE).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { net: n, vat, gross: n.plus(vat) };
}

interface SaleLike {
  totalCost?: string | number | null;
  movementCost?: string | null;
  vatAmount?: string | null;
  grossTotal?: string | null;
}

// A sale's real figures from the server. Before the backfill has run
// `grossTotal` is null: the sale is VAT-free, so gross equals net.
export function saleAmounts(m: SaleLike): VatBreakdown {
  const net = toDecimal(m.totalCost ?? m.movementCost);
  if (m.grossTotal == null) return { net, vat: new Decimal(0), gross: net };
  const gross = toDecimal(m.grossTotal);
  return { net, vat: m.vatAmount != null ? toDecimal(m.vatAmount) : gross.minus(net), gross };
}

// Account totals (site payables / warehouse bySite). `sold` is gross. When the
// response has no net/VAT split, `known` is false so screens show "—" rather
// than a made-up 0% VAT.
export function accountAmounts(a: {
  sold: string;
  soldNet?: string;
  soldVat?: string;
}): VatBreakdown & { known: boolean } {
  const gross = toDecimal(a.sold);
  if (a.soldNet == null || a.soldVat == null) return { net: gross, vat: new Decimal(0), gross, known: false };
  return { net: toDecimal(a.soldNet), vat: toDecimal(a.soldVat), gross, known: true };
}

// A purchase's price is VAT-inclusive and unchanged; the server records the
// VAT contained in it. net = paid - VAT. With no record yet (grossTotal null)
// no VAT is counted.
export function purchaseAmounts(m: SaleLike): VatBreakdown {
  const gross = toDecimal(m.grossTotal ?? m.totalCost ?? m.movementCost);
  const vat = m.grossTotal == null ? new Decimal(0) : toDecimal(m.vatAmount);
  return { net: gross.minus(vat), vat, gross };
}

// ---- Form entry: "amount includes VAT" -------------------------------------
// Frontend only. The API wants a sale price ex-VAT and a purchase price
// VAT-inclusive; the toggle lets the user type either and converts here.

export type CostKind = "sale" | "purchase";

const two = (d: Decimal): Decimal => d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

// Typed amount -> the value the API expects. null if not a number.
export function amountToSend(kind: CostKind, typed: string, includesTax: boolean, noVat: boolean): string | null {
  let value: Decimal;
  try {
    value = new Decimal(typed.trim());
  } catch {
    return null;
  }
  if (!value.isFinite()) return null;
  if (noVat || includesTax === (kind === "purchase")) return value.toString();
  // Sale typed with VAT -> ex-VAT; purchase typed without VAT -> inclusive.
  return two(kind === "sale" ? value.div(VAT_RATE.plus(1)) : value.times(VAT_RATE.plus(1))).toFixed(2);
}

// What will be recorded for a quantity of units at the API-side price.
export function costSummary(kind: CostKind, sendPrice: string, quantity: string | number, noVat: boolean): VatBreakdown | null {
  try {
    const qty = new Decimal(String(quantity).trim() || "0");
    const price = new Decimal(sendPrice);
    if (!price.gt(0) || !qty.gt(0)) return null;
    const line = two(price.times(qty));
    if (kind === "sale") return withVat(line.toFixed(2), noVat);
    if (noVat) return { net: line, vat: new Decimal(0), gross: line };
    const net = two(line.div(VAT_RATE.plus(1)));
    return { net, vat: line.minus(net), gross: line };
  } catch {
    return null;
  }
}
