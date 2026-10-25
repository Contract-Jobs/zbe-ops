import Decimal from "decimal.js";
import type { CsvColumn, CsvCell } from "@/lib/csv";
import { VAT_RATE_PERCENT, purchaseAmounts, saleAmounts } from "@/lib/vat";
import type { InventoryItem, InventoryItemSubitem, InventoryMovement } from "@/types/api";

// Bill of materials for one site: one flat, dated list of everything it bought
// — from warehouses (sales to the site) and directly from suppliers (purchases
// into the site's own inventory); "Bought from" says which. A set is one priced
// line followed by its parts (3, 3.1, 3.2); parts carry quantity, not money.
// The file ends with one totals row, aligned under the amount columns.

export const DIRECT_SOURCE = "direct";

export interface BomLookups {
  items: Map<string, InventoryItem>;
  subitems: Map<string, InventoryItemSubitem[]>;
  // inventory node id -> the warehouse that node belongs to
  nodes: Map<string, { id: string; name: string }>;
  licenses: Map<string, string>;
}

export type BomMovement = InventoryMovement & { item?: InventoryItem | null };

// Which block a movement belongs to: a warehouse id, or DIRECT_SOURCE.
export function sourceOf(m: BomMovement, lookups: Pick<BomLookups, "nodes">): string {
  if (m.movementType === "purchase") return DIRECT_SOURCE;
  return (m.sourceInventoryId && lookups.nodes.get(m.sourceInventoryId)?.id) || "unknown-warehouse";
}

const vatLabel = `VAT (${VAT_RATE_PERCENT}%)`;

const COLUMNS: CsvColumn[] = [
  { header: "No." }, // 0
  { header: "Item" }, // 1
  { header: "Type" }, // 2
  { header: "Category" }, // 3
  { header: "Unit" }, // 4
  { header: "Quantity", kind: "number" }, // 5
  { header: "Quantity per set", kind: "number" }, // 6
  { header: "Price per unit before VAT", kind: "number" }, // 7
  { header: "Amount before VAT", kind: "number" }, // 8
  { header: vatLabel, kind: "number" }, // 9
  { header: "Amount with VAT", kind: "number" }, // 10
  { header: "Market price per unit", kind: "number" }, // 11
  { header: "Date" }, // 12
  { header: "How bought" }, // 13
  { header: "Bought from" }, // 14
  { header: "License" }, // 15
  { header: "Status" }, // 16
  { header: "Note" }, // 17
  { header: "Item ID" }, // 18
  { header: "Record ID" }, // 19
];

const money = (v: Decimal | string | number | null | undefined): string =>
  v === null || v === undefined || v === "" ? "" : new Decimal(v).toFixed(2);
// Quantities keep up to 3 decimals and drop trailing zeros.
const num = (v: Decimal | string | number): string => new Decimal(v).toDecimalPlaces(3).toString();
const isoDay = (iso: string): string => (iso ? iso.slice(0, 10) : "");

interface Totals {
  net: Decimal;
  vat: Decimal;
  gross: Decimal;
}
const emptyTotals = (): Totals => ({ net: new Decimal(0), vat: new Decimal(0), gross: new Decimal(0) });

export function buildBom(movements: BomMovement[], lookups: BomLookups) {
  const width = COLUMNS.length;
  const blank = (): CsvCell[] => Array<CsvCell>(width).fill("");
  const nameOf = (m: BomMovement) => m.item?.name ?? lookups.items.get(m.itemId)?.name ?? "";
  const warehouseName = (m: BomMovement) =>
    (m.sourceInventoryId && lookups.nodes.get(m.sourceInventoryId)?.name) || "Unknown warehouse";

  // Reversed entries and their reversals cancel out.
  const live = movements
    .filter((m) => (m.movementType === "sale" || m.movementType === "purchase") && !m.isReversed && !m.isReversal)
    .sort((a, b) => a.movementDate.localeCompare(b.movementDate) || nameOf(a).localeCompare(nameOf(b)));

  const rows: CsvCell[][] = [];
  const total = emptyTotals();

  live.forEach((m, index) => {
    const item = m.item ?? lookups.items.get(m.itemId) ?? null;
    const no = String(index + 1);
    const isSet = item?.compositionType === "set";
    const subs = isSet ? (lookups.subitems.get(m.itemId) ?? []) : [];
    // Both come from the server. A sale's VAT is added on top of its price; a
    // purchase's VAT is already inside the price paid (net = paid - VAT).
    const direct = m.movementType === "purchase";
    const vat = direct ? purchaseAmounts(m) : saleAmounts(m);
    total.net = total.net.plus(vat.net);
    total.vat = total.vat.plus(vat.vat);
    total.gross = total.gross.plus(vat.gross);

    const context = (r: CsvCell[]) => {
      r[12] = isoDay(m.movementDate);
      r[13] = direct ? "Direct purchase" : "From warehouse";
      r[14] = direct ? (m.clientName ?? "") : warehouseName(m);
      r[15] = m.licenseId ? (lookups.licenses.get(m.licenseId) ?? m.licenseId) : "";
      r[16] = m.isApproved ? "Approved" : "Pending";
      r[19] = m.id;
    };

    const r = blank();
    r[0] = no;
    r[1] = item?.name ?? "";
    r[2] = isSet ? "Set" : "Item";
    r[3] = item?.category ?? "";
    r[4] = item?.unit ?? "";
    r[5] = num(m.quantity);
    const qty = new Decimal(m.quantity);
    r[7] = direct && qty.gt(0) ? money(vat.net.div(qty)) : money(m.unitCost);
    r[8] = money(vat.net);
    r[9] = money(vat.vat);
    r[10] = money(vat.gross);
    r[11] = money(item?.marketValue);
    context(r);
    r[17] = m.note ?? "";
    r[18] = m.itemId;
    rows.push(r);

    subs.forEach((sub, i) => {
      const p = blank();
      p[0] = `${no}.${i + 1}`;
      p[1] = sub.name;
      p[2] = "Set part";
      p[3] = item?.category ?? "";
      p[4] = sub.unit ?? item?.unit ?? "";
      p[5] = num(new Decimal(sub.quantity).times(m.quantity));
      p[6] = num(sub.quantity);
      context(p);
      p[18] = sub.id;
      rows.push(p);
    });
  });

  // One row, so each total sits under its own column heading:
  // subtotal = Amount before VAT, tax = VAT, total = Amount with VAT.
  rows.push(blank());
  const totals = blank();
  totals[1] = "TOTAL";
  totals[8] = money(total.net);
  totals[9] = money(total.vat);
  totals[10] = money(total.gross);
  rows.push(totals);

  return { columns: COLUMNS, rows };
}
