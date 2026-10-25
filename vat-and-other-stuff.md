# Backend changes for the frontend

Covers: **decimal quantities**, **editing a sale's price**, **COGS fields on sales**, **VAT on sales**, and **VAT on purchases / tax on transactions** (§6). All responses are inside the usual `{ success, data }` envelope. Money values are **strings with 2 decimals**; quantities are **numbers**.

Who may call what is in [`frontend-access-control.md`](./frontend-access-control.md).

---

## 1. Decimal quantities

`quantity` on inventory movements and balances can now be a decimal with **up to 3 places** (`2.5`, `0.125`). It applies to every quantity-tracked item (materials and bulk equipment). It is still a JSON **number**, so response shapes did not change.

- `POST /api/inventory-movements`: send `quantity` as a positive number with at most 3 decimal places (integers still work). More than 3 places → `400` validation error ("quantity supports at most 3 decimal places").
- Allow decimal input in quantity fields (`step="any"` / `step="0.001"`).
- Do not `parseInt` / `Math.round` quantities. Format balances, totals and stock counts to show up to 3 decimals.
- Aggregated quantities (`totalQuantity`, `materialQuantityTotal`, …) can now be fractional too.
- Money fields (`unitCost`, `totalCost`, `paidAmount`, …) are unchanged.

---

## 2. Editing the selling price of a sale

`PATCH /api/inventory-movements/:id`

```json
{ "unitCost": "12.50", "reason": "Agreed discount" }
```

`unitCost` is the **VAT-exclusive** unit price (see §4). `reason` is optional. The response is the updated movement.

- **Who:** admin / superadmin only (others get `403`). Hide the button for other roles.
- **Which movements:** sales only, not reversed (`isReversed`) and not reversal rows (`isReversal`). Show the button only when `movementType === "sale" && !isReversed && !isReversal`.
- **What changes:** `unitCost`, `totalCost` (= `unitCost × quantity`, net), `vatAmount`, `grossTotal`, and `saleStatus`. A fully paid sale whose price goes up becomes `partially_paid`. For a sale to a site, the site's account balance and the site's ledger entry follow the new price.
- **Unchanged:** stock, the COGS fields and existing payments.
- **History:** every edit is appended to `metadata.priceHistory` as `{ from, to, by, at, reason }` (oldest first).
- Refetch the movement, sold-items lists, site payables and analytics after an edit.

Errors to show:

| Case                                                                        | Status    | Tell the user                                           |
| --------------------------------------------------------------------------- | --------- | ------------------------------------------------------- |
| New total **including VAT** is below what was already paid (client sale)    | 422       | "Reverse a payment first, then edit the price."         |
| Site sale: the new total would leave the site's payments above what it owes | 409       | "Reverse a site payment first, then edit the price."    |
| Price ≤ 0 or not a number                                                   | 400 / 422 | validation message                                      |
| Not a sale / reversed / reversal                                            | 422       | "Only the price of a sale movement can be edited." etc. |

---

## 3. COGS on sales

COGS = what the stock **cost** when it was sold. Compare it to the revenue for margin.

| Field                    | Meaning                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `unitCost` / `totalCost` | **Revenue**: selling price per unit / total, **VAT-exclusive**                           |
| `cogsUnitCost`           | cost per unit of the stock sold                                                          |
| `cogsTotalCost`          | `cogsUnitCost × quantity`                                                                |
| `cogsEstimated`          | `true` if backfilled from history rather than captured at sale time, show as "estimated" |

Where it is returned:

- `GET /api/warehouses/:id/sold-items/materials`: every row.
- `GET /api/inventory-movements`: every row.
- `GET /api/warehouses/:id/sold-items` (overview): totals only, no per-row COGS.

Margin per sale = `totalCost − cogsTotalCost` (both net of sales VAT). COGS is `null` on non-sales. COGS does **not** change when the sale price is edited.

> Known limitation: purchases are entered VAT-inclusive, so COGS is VAT-inclusive while revenue is net. Margins are understated by input VAT. Decided to leave purchases alone for now.

---

## 4. VAT on sales

Standard rate **15%** (Ethiopia). Applies to material sales, bulk-equipment sales and individual-equipment sales, **including sales to sites**. Purchases are untouched (their prices already include VAT). Rentals are out of scope.

### 4.1 The model: net / VAT / gross

- **Inputs are always VAT-exclusive** (what the frontend sends): `unitCost` (materials) and `movementCost` (equipment).
- `totalCost` / `movementCost` on a sale stays the **net** (VAT-exclusive) amount. Revenue and profit use it.
- New fields on every movement row (inventory and equipment movements):

| Field        | Type                    | Meaning                                                                                                                        |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `vatRate`    | string, e.g. `"0.1500"` | rate snapshotted on the sale (`"0.0000"` if exempt)                                                                            |
| `vatAmount`  | string                  | VAT in money, 2 dp                                                                                                             |
| `grossTotal` | string \| null          | net + VAT, what the buyer owes and pays. **`null` only before the backfill has run, then treat it as equal to the net amount** |
| `vatExempt`  | boolean                 | this sale was flagged VAT-free by the user                                                                                     |

- **What the buyer owes / pays is the gross.** `paidAmount`, `saleStatus` (`unpaid` / `partially_paid` / `paid`), payment limits, receivables and collection rates are all measured against `grossTotal`.
- Rounding: `vatAmount = round(net × rate, 2)` per sale line.

Example: net `1000.00` → `vatAmount 150.00`, `grossTotal 1150.00`.

### 4.2 Showing prices on forms

Show the user three lines when they enter a sale: **net**, **VAT (15%)**, **total**. The backend computes the real figures; any preview you compute should mirror: `vat = round(net × 0.15, 2)`, `gross = net + vat` (0% if the item or sale is exempt).

### 4.3 Creating a sale

Same endpoints as before, with one optional field:

- `POST /api/inventory-movements` (`movementType: "sale"`): `unitCost` (net), `quantity`, `sourceInventoryId`, `clientName` **or** `buyerSiteId`, `fullyPaid`, `paidAmount`, **`vatExempt?: boolean`**.
- `POST /api/equipment-movements` (`movementType: "sale"`): `movementCost` (net), `licenseId`, `clientName`, `fullyPaid`, `paidAmount`, **`vatExempt?: boolean`**.

Behaviour:

- `vatExempt: true` → this sale is charged 0% regardless of the item. Omit or `false` → rate comes from the **item** (see §4.4).
- `fullyPaid: true` (the default) → the recorded payment and `paidAmount` are the **gross** amount.
- `paidAmount` is compared with gross: paying only the net amount leaves the sale `partially_paid`.
- Sales to a site (`buyerSiteId`) have no per-sale payment state (unchanged), they are paid through the site account.
- The created sale (even while still pending approval) already carries `vatExempt` / `vatRate` / `vatAmount` / `grossTotal`.

### 4.4 Item VAT-exempt flag

`inventory_items` has a new boolean **`vatExempt`** (default `false`). Send it on `POST /api/inventory-items` and `PATCH /api/inventory-items/:id`; it is returned on item responses. Sales of an exempt item are 0% VAT. Individually tracked equipment uses its catalog item's flag. Exempt and zero-rated are treated the same (0%).

### 4.5 Payments

- `POST /api/inventory-movements/:id/payments` and `/api/equipment-movements/:id/payments`: the amount may be up to **gross − paid**. Over-paying → 422 "exceeds remaining unpaid balance" (the numbers in the message are gross).
- Payment reversal recomputes `saleStatus` against gross.
- Site account payments (`POST /api/warehouses/:id/site-payments`) are VAT-inclusive too: the limit is the account's `outstanding` (gross).

### 4.6 Site payables / site account

`GET /api/sites/:id/payables` and the `bySite` block of the warehouse sold-items overview:

| Field                               | Meaning                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `sold`                              | what the site owes in total **including VAT** (gross) |
| `soldNet`                           | net part                                              |
| `soldVat`                           | VAT part (`soldNet + soldVat = sold`)                 |
| `paid`                              | payments received                                     |
| `outstanding`                       | `sold − paid`                                         |
| `markedPaidTotal` / `unmarkedTotal` | gross, tracking label only                            |

Show the net / VAT / total breakdown to the site and the warehouse.

### 4.7 Site spend and ledger

A sale **to** a site now counts as that site's cost, at the **gross** amount (VAT included, because the site pays it). It appears in the site's ledger (description "Bought Nx … from Warehouse (incl. VAT)"), `GET /api/ledgers`, cost breakdown, and in `materialSpend` / budget-vs-actual for the site. Reversing the sale posts the opposite entry. Editing the price updates the entry.

### 4.8 Warehouse sold items

`GET /api/warehouses/:id/sold-items` (overview):

- `soldEquipmentTotal`, `soldMaterialTotal`, `totalRevenue` are now **invoiced including VAT (gross)** so `cash`, `outstanding` and `collectionRate` compare like with like. New: `soldEquipmentVat`, `soldMaterialVat`, `totalVat`. (The field names say "revenue"/"total" but they are gross here, label them "Invoiced (incl. VAT)".)
- `.../sold-items/materials` and `.../equipment` rows include the VAT fields. `minAmount` / `maxAmount` filters now apply to the **gross** total.

### 4.9 Analytics

`GET /api/analytics/sales`:

- `totalRevenue`, `totalMaterialRevenue`, `totalEquipmentRevenue`, and every `revenue` field are **net** (unchanged meaning).
- New: `totalVat`, `totalGrossRevenue`; in `revenueVsCash.summary`, `byCategory.*` (`vat`, `grossRevenue`, also under `bulkEquipment` / `individualEquipment`) and `byStatus.*.grossRevenue`.
- `totalCashCollected`, `totalOutstanding`, `collectionRate` and all `outstanding` / `collectionRate` fields are measured against **gross**. `byStatus.unpaid.outstanding` = unpaid gross.
- `profitability`: net basis. `cashCollected` there is the net part of payments; `actualProfit` excludes the VAT collected.
- `siteSales`: `revenue` is net; new `vat`; `cashReceived` and `outstandingBalance` are gross (site payments include VAT).

`GET /api/analytics/company`:

- `income.total` and `netIncome` **exclude VAT** (VAT is a liability, not income).
- New `income.vatOutput` (VAT charged on sales in the period) and `income.vatCollected` (VAT part of what external buyers have paid).
- `netCashFlow` is cash, so it **includes** VAT collected.
- `outstandingSalesReceivables` is gross.

`GET /api/analytics/licenses`: `totalReceived` excludes the VAT inside sale payments.

### 4.10 New: VAT report

`GET /api/analytics/vat?warehouseId&licenseId&dateFrom&dateTo` (admin / superadmin):

```json
{
  "outputVat": "…", // VAT charged on all approved, non-reversed sales in range
  "taxableNet": "…", // net of sales charged VAT
  "exemptNet": "…", // net of 0% sales
  "grossInvoiced": "…",
  "byCategory": {
    "material": { "saleCount": 0, "net": "…", "vat": "…", "gross": "…" },
    "equipment": { "saleCount": 0, "net": "…", "vat": "…", "gross": "…" },
    "siteSales": { "saleCount": 0, "net": "…", "vat": "…", "gross": "…" }
  },
  "externalVatCollected": "…", // VAT part of cash paid by external buyers so far
  "externalVatOutstanding": "…",
  "notBackfilledSaleCount": 0 // sales still counted at 0% until the backfill runs
}
```

Site VAT is accrual-only (site payments are not allocated to individual sales).

### 4.11 One-time backfill of old sales (run by the backend team, no endpoint)

A script (`pnpm backfill:sale-vat`, dry run unless `-- --apply`) adds VAT to sales created before this release, **recomputes their status against gross**, and posts existing site sales to the site ledger. Nothing for the frontend to call.

Heads-up for the UI after the backfill runs:

- Some sales previously `paid` become `partially_paid` (they were paid at the old VAT-free price).
- Site balances (`sold`, `outstanding`) go up by the VAT.
- Until it runs, old sales have `grossTotal: null` and `vatAmount: "0.00"`; show them as VAT-free.

---

## 5. Quick field reference

| Where                                 | New / changed                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------ |
| Movement rows (inventory + equipment) | `vatExempt`, `vatRate`, `vatAmount`, `grossTotal`; `quantity` may be decimal         |
| Sale create bodies                    | `vatExempt?`                                                                         |
| Item create/update/response           | `vatExempt`                                                                          |
| `GET /sites/:id/payables`, `bySite`   | `sold` gross, `+soldNet`, `+soldVat`                                                 |
| Warehouse sold-items overview         | totals gross, `+soldEquipmentVat`, `+soldMaterialVat`, `+totalVat`                   |
| `GET /analytics/sales`                | `+totalVat`, `+totalGrossRevenue`, `+vat`/`grossRevenue` per bucket, `siteSales.vat` |
| `GET /analytics/company`              | `+income.vatOutput`, `+income.vatCollected`                                          |
| `GET /analytics/vat`                  | new                                                                                  |
| `PATCH /inventory-movements/:id`      | new (sale price edit, admin)                                                         |

---

## 6. VAT on purchases and tax on transactions

**Purchases work differently from sales.** A purchase price is entered **VAT-inclusive** (the invoice total) and **stays that way**: `unitCost`, `totalCost`, `movementCost`, lot value, COGS, ledger cost, `originalValue` and `bookValue` are all unchanged, because the VAT paid is treated as part of the cost/asset value. The backend only **records how much of the price is VAT**, so the VAT report can show the VAT you can reclaim.

### 6.1 Purchase movements

Same endpoints as before (`POST /api/inventory-movements`, `POST /api/equipment-movements` with `movementType: "purchase"`), one optional field:

- **`vatExempt?: boolean`**: "no VAT was charged on this purchase" (exempt goods, or a vendor that issued no VAT invoice). Default `false`. Open to every role that can create a purchase (non-admin purchases wait for admin approval as before).
- The purchase row now carries `vatExempt`, `vatRate`, `vatAmount` (the VAT _contained in_ the price) and `grossTotal` (= the price paid; net = `grossTotal − vatAmount`).
- Example: price `115.00` → `vatAmount 15.00`, net `100.00`. Price `100.00` → `vatAmount 13.04`, net `86.96`.
- The item's `vatExempt` flag (§4.4) applies to purchases too: exempt items have `vatAmount 0`.
- Show it as "of which VAT: …" next to the price. Do **not** change displayed costs, values or balances.
- Reversing a purchase copies the same VAT fields.

### 6.2 Taxes on manual transactions

`POST /api/transactions` accepts an optional list of taxes **contained in `amount`** (the amount stays the total paid/received):

```json
{
  "categoryId": "…",
  "type": "money_out",
  "amount": "1150.00",
  "taxes": [
    { "taxType": "vat", "amount": "150.00", "rate": "0.15" },
    { "taxType": "other", "label": "Withholding", "amount": "20.00" }
  ]
}
```

- `taxType`: `"vat"` counts as **input VAT** in the VAT report; `"other"` (withholding, excise, anything) is recorded and shown but does not enter the VAT report.
- `label`: required for `"other"`; defaults to `"VAT"` for `"vat"`. `rate` is optional/free. Up to 10 taxes per transaction.
- Validation (422): each tax amount > 0; the taxes together cannot exceed `amount`.
- `GET /api/transactions` and `GET /api/transactions/:id` now return `taxes: [{ id, taxType, label, rate, amount }]` on each transaction (empty array when none).
- Taxes follow the transaction: a transaction that is rejected or reversed no longer counts in reports.
- System transactions created by purchases and sales do not have tax rows (the movement carries the VAT).

### 6.3 VAT report additions

`GET /api/analytics/vat` now also returns:

```json
{
  "inputVat": {
    "materialPurchases": "…",
    "equipmentPurchases": "…",
    "transactions": "…", // VAT-type taxes on manual transactions
    "total": "…"
  },
  "netVatPayable": "…", // outputVat − inputVat; negative = refundable / carried forward
  "notBackfilledPurchaseCount": 0
}
```

`GET /api/analytics/company` gets `vat: { output, input, netPayable }`. Expenses there are unchanged (they include the VAT paid, as the costs do).

### 6.4 Backfill of old purchases (admin tool)

Run by the backend team as a script (`pnpm backfill:purchase-vat`, dry run unless `-- --apply`); no endpoint. Every past purchase is assumed VAT-inclusive at 15% (exempt items excluded): it fills `vatRate` / `vatAmount` / `grossTotal` only. **No costs, balances, COGS or values change.** Safe to run twice (the second run changes nothing). Until it runs, old purchases show `grossTotal: null` and count as 0 input VAT.

### 6.5 Known consequence

Because purchase costs keep their VAT, profit and margin on sales are still computed from VAT-inclusive cost against VAT-exclusive revenue (§3 note), and the same VAT appears both inside costs/asset values and as reclaimable input VAT in the VAT report. This is intentional for now.

---

## 7. Rollout order

1. Apply the DB migrations (decimal quantities, sale VAT, transaction taxes).
2. Deploy the backend.
3. Run `pnpm backfill:sale-vat` and `pnpm backfill:purchase-vat` as dry runs, review the output, then again with `-- --apply`.
4. Ship the frontend changes.
