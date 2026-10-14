# Frontend Sync — Sales to Sites, Site Account Payments, COGS & Profitability, List Filters/Sorting

Everything here is on the **v2 API** (`app/api`, `lib/v2_services`). Date of change: 2026-10-13.
Conventions are the same as `v2-route-details.md` (response wrapper, error codes, comma-separated multi-value filters).

**Quick reference of the response wrapper** — a route's result is wrapped as `{ "success": true, "data": <result> }`, *unless* the service already returns an object with its own `data` key, in which case that object is spread at the top level (`{ success, data, pagination, ... }`). Each endpoint below shows its real shape.

**Money values** are always **strings** (`"1250.00"`), never numbers. Counts are numbers. Dates are ISO strings.

---

## 0. Summary of what changed

| Area | Change |
|---|---|
| **Sale to a site** | A material sale can have a **site as the buyer** (`buyerSiteId`) instead of an external `clientName`. Treated as a sale to a third party: no stock lands at the site, no site-ledger entry. |
| **Site account (bulk payment)** | A site does **not** pay per sale. It pays its warehouse in bulk against a running **account** (one per site + warehouse): `outstanding = sales to the site − payments`. New payment endpoints. Sales to a site have **no per-sale payment state** (`saleStatus` / `paidAmount` are `null`). |
| **Paid label** | Each sale to a site has a manual `isMarkedPaid` label so staff can track which items they consider paid. **Tracking only** — it changes no balance, analytics or guard. |
| **Site payables / warehouse view** | `GET /sites/:id/payables` shows a site's accounts; `GET /warehouses/:id/sold-items` now includes site sales and a `bySite` breakdown. Individual sales come from the existing movements list. |
| **COGS snapshot** | Every sale now stores the cost of the stock it removed (`cogsUnitCost`, `cogsTotalCost`). New columns on sale movements. |
| **Sales analytics** | `GET /analytics/sales` gains a `profitability` block (external sales) and a `siteSales` block (sales to sites, accrual-based). The endpoint is now **admin/superadmin only**. |
| **Income from site sales** | Site sale revenue is income **at the sale** (no transaction exists): new `income.siteSaleRevenue` + `netIncome` on `/analytics/company`, and included in `totalReceived` on `/analytics/licenses`. Account payments are not counted again. |
| **`dateTo` filters** | A date-only `dateTo` now includes that whole day on all `/analytics/*` endpoints. |
| **Site closing / closed sites** | Closed (or deleted) sites cannot be a party to any **material** movement. A site that still owes a warehouse (account balance > 0) cannot be closed. |
| **Material transfers** | Material `transfer` to/from a site is now **rejected**. Use a sale instead. |
| **Filters & sorting** | New filters on transactions & ledgers; new `sortBy`/`sortOrder` on sites, warehouses, inventories, inventory balances, sales (movements), approvals, site payments. |

### Migration / rollout order (backend)
1. Apply migration `drizzle_v2/20261013075234_sale_to_site_cogs`.
2. Apply migration `drizzle_v2/20261013200545_site_account_payments` (account payments table, paid-label columns, nullable `transactions.license_id`).
3. A **superadmin** calls `POST /api/inventory-balances/backfill-sale-cogs` once (see §3).

> `transactions.licenseId` is now **nullable**: money received against a site account is not tied to a license. Type it as `string | null`.

---

## 1. Sale to a site

### 1.1 Create — `POST /api/inventory-movements` (`movementType: "sale"`)

Existing endpoint; **one new optional field** on the sale variant.

**Request body (sale)**

| Field | Type | Required | Notes |
|---|---|---|---|
| `movementType` | `"sale"` | yes | |
| `itemId` | uuid | yes | **Must be a material** when `buyerSiteId` is used. |
| `quantity` | int ≥ 1 | yes | |
| `sourceInventoryId` | uuid | yes | Must be a **warehouse** inventory (unchanged rule). |
| `unitCost` | string (decimal) | yes | The **sale price per unit** (revenue). Unchanged. |
| `buyerSiteId` | uuid | no | **NEW.** The site buying the material. **Mutually exclusive with `clientName`** (400 if both). |
| `clientName` | string \| null | no | External buyer. Leave out when `buyerSiteId` is set. |
| `fullyPaid` | boolean | no | **Ignored when `buyerSiteId` is set** (site sales have no per-sale payment). External buyers: default **`true`**; send `false` (+ optional `paidAmount`) for unpaid / partial. |
| `paidAmount` | string (decimal) | no | External buyers only. **A non-zero value together with `buyerSiteId` → 400.** |
| `licenseId` | uuid | no | Only needed if the warehouse holds the item under more than one license. |
| `movementDate`, `note`, `metadata` | | no | Unchanged. |

**Example** (a site buying several items = several sale movements; it pays once later, see §2)
```json
{
  "movementType": "sale",
  "itemId": "…",
  "quantity": 40,
  "sourceInventoryId": "<warehouse inventory id>",
  "unitCost": "12.50",
  "buyerSiteId": "<site id>",
  "note": "Rebar for block B"
}
```

**What the backend does**
- Validates the site: exists, not deleted, **status `active`**. Checked at stage **and again at approval/commit**.
- Stores the site's name in `clientName` (snapshot), sets `buyerSiteId` and `isInternal: true`.
- Everything else is a normal warehouse sale: warehouse balance decreases and the COGS snapshot is taken. **No transaction is created, and `saleStatus` / `paidAmount` stay `null`** — the money side is the site's warehouse account (§2).
- **Does NOT**: add stock to the site, create a purchase movement, or write to the site's `project_ledger` (site budget/spend screens are unaffected).

**Who can create**: unchanged — admin/superadmin. (A `site_manager` cannot create sales.) Admin submissions auto-approve; others stay pending until approved.

**Response**: the movement row. New fields on every inventory movement object:

| Field | Type | Meaning |
|---|---|---|
| `buyerSiteId` | uuid \| null | Buyer site for internal sales. |
| `isInternal` | boolean | `true` when `buyerSiteId` is set. |
| `isMarkedPaid` | boolean | Manual "paid" label on a sale to a site (§2.4). Tracking only. Always `false` for other sales. |
| `markedPaidAt` / `markedPaidBy` | date \| null / user id \| null | Who ticked it and when. |
| `cogsUnitCost` | string \| null | Cost per unit of the stock sold (null until committed / for non-sales). |
| `cogsTotalCost` | string \| null | Total cost of the stock sold. |
| `cogsEstimated` | boolean | `true` if backfilled by replay (an estimate), `false` if snapshotted live. |

> `unitCost` / `totalCost` on a sale remain **revenue**. COGS is the separate `cogs*` pair.

**Errors**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Both `clientName` and `buyerSiteId` sent; `buyerSiteId` on a non-sale; non-zero `paidAmount` with `buyerSiteId`; item is not a material ("Only materials can be sold to a site."); source is not a warehouse. |
| 404 | `NOT_FOUND` | `buyerSiteId` doesn't exist or is deleted ("Site not found."). |
| 409 | `CONFLICT` | Buyer site is closed ("Site is closed and cannot accept any movements."). |

### 1.2 List — `GET /api/inventory-movements`

Existing endpoint. Response shape unchanged: `{ success, data: { movements: InventoryMovement[], total } }`.

New query params:

| Param | Type | Notes |
|---|---|---|
| `buyerSiteId` | uuid | Only sales to this site. |
| `isInternal` | `true`\|`false` | Only internal (site-buyer) sales / only non-internal. |
| `isMarkedPaid` | `true`\|`false` | Sales ticked / not ticked as paid. |
| `sortBy` | see §6 | NEW. |
| `sortOrder` | `asc`\|`desc` | NEW. |

Existing params still work: `itemId`, `movementType`, `fromDate`, `toDate`, `isReversal`, `includeReversed`, `saleStatus` (comma list OK; site sales have no status so they never match), `page`, `limit`.

### 1.3 Reversing a sale to a site

`POST /api/inventory-movements/:id/reverse` (unchanged). The sale drops out of the account. **It is refused with `409` if the site's payments would then exceed what it owes that warehouse** ("Reversing this sale would leave the site's payments (…) above what it owes this warehouse (…). Reverse a payment first.") — reverse a payment first.

The per-sale payment endpoints (`/api/inventory-movements/:id/payments…`) **reject site sales** with `400` ("Sales to a site are not paid per sale…"). Use §2. They are unchanged for external-buyer sales.

---

## 2. Site account — payments and payables

### Concept
For each (site, warehouse) pair:

```
sold        = sum of the site's approved, non-reversed sales from that warehouse
paid        = sum of the site's non-reversed payments to that warehouse
outstanding = sold − paid          (computed on read, never stored)
```

A payment is **not allocated to individual sales**. The site buys cement + aluminum + copper (three sales) and pays one total (one payment). Money is managed from the **warehouse side** (admin / superadmin); a `site_manager` can only *view* their own site's payables and payments.

### 2.1 Register a payment — `POST /api/warehouses/:id/site-payments`

`:id` is the **warehouse being paid**. **RBAC**: admin / superadmin (`site_manager` → 403).

**Body**

| Field | Type | Required | Notes |
|---|---|---|---|
| `siteId` | uuid | yes | The paying site. |
| `amount` | string (decimal) > 0 | yes | **Cannot exceed the account's outstanding** (400, message shows the max). |
| `paymentDate` | ISO datetime with offset | no | Default now. |
| `note` | string | no | |
| `categoryId` | uuid | no | Transaction category for the cash entry. |
| `markPaidMovementIds` | uuid[] (≤ 500) | no | Sales to tick as paid in the same step (convenience; each must be an active sale to this site from this warehouse, otherwise the **whole call fails**). This can only tick — to unmark, use §2.4. |

**Response** `{ success, data }`
```json
{
  "payment": { "id": "…", "siteId": "…", "warehouseId": "…", "amount": "1000.00", "paymentDate": "…", "note": null, "transactionId": "…", "loggedBy": "…", "isReversed": false, "reversedAt": null, "reversedBy": null, "reversalNote": null, "createdAt": "…" },
  "markedPaid": [ { "id": "<sale id>", "isMarkedPaid": true, "markedPaidAt": "…" } ],
  "balance": { "sold": "1400.00", "paid": "1000.00", "outstanding": "400.00" }
}
```
A `money_in` transaction is created with `licenseId: null`, `warehouseId` set and `siteId: null` (a site is a third-party buyer; this is not site spend). It does not touch the site ledger.

### 2.2 List payments

- `GET /api/warehouses/:id/site-payments` — payments received by the warehouse. Optional `siteId` filter. **Not available to `site_manager`** (403).
- `GET /api/sites/:id/payables/payments` — payments the site made. Optional `warehouseId` filter. A `site_manager` can only read their own site (403 otherwise).

**RBAC**: `read:transaction`. Same params on both:

| Param | Type | Notes |
|---|---|---|
| `isReversed` | `true`\|`false` | Default: both. |
| `dateFrom`, `dateTo` | ISO date | On `paymentDate`. |
| `minAmount`, `maxAmount` | decimal string | Inclusive. |
| `sortBy` | `paymentDate` (default) \| `amount` \| `createdAt` | Unknown → 400. |
| `sortOrder` | `asc`\|`desc` | Default `desc`. |
| `page`, `limit` | | default 1 / 20 |

**Response** `{ success, data: Payment[], pagination }` — each row adds `siteName`, `warehouseName`.

### 2.3 Reverse a payment — `POST /api/warehouses/:id/site-payments/:paymentId/reverse`

`404` if the payment doesn't belong to that warehouse. Body `{ "note"?: string }`. **RBAC**: admin / superadmin. The cash entry is contra'd (`money_out` reversal) and the site owes that amount again. Returns `{ payment, reversalTransactionId, balance }`.
Errors: `409` already reversed; `409` if the site is **closed** (reopen it first — reversing would restore a debt on a closed site).

### 2.4 Tick / untick sales as paid — `POST /api/warehouses/:id/sold-items/mark-paid`

`:id` is the warehouse; only that warehouse's sold items are accepted (`400` for any other). **RBAC**: admin / superadmin.

**Body**
```json
{ "movementIds": ["<sale id>", "<sale id>"], "paid": true }
```

| Field | Type | Notes |
|---|---|---|
| `movementIds` | uuid[] (1–500) | Duplicates are ignored. |
| `paid` | boolean | `true` = mark as paid, **`false` = unmark**. The value applies to every id in the call. |

- **Marking** sets `isMarkedPaid: true` and records `markedPaidAt` / `markedPaidBy` (the current user).
- **Unmarking** sets `isMarkedPaid: false` and **clears** `markedPaidAt` / `markedPaidBy`. No history of earlier marks is kept.
- Idempotent: marking an already-marked sale (or unmarking an unmarked one) succeeds. Marking again refreshes the date and user.
- It never changes the account balance in either direction.

**Response** `{ success, data: { sales: [{ id, isMarkedPaid, markedPaidAt }] } }` — `markedPaidAt` is `null` after unmarking.

**Errors**: `400` if an id is not an **approved, non-reversed sale to a site**, or belongs to another warehouse (this also covers trying to unmark a reversed sale); `404` if an id doesn't exist. The call is all-or-nothing: one bad id fails the whole request and nothing changes.

> **This label is informational.** It never changes `outstanding`, never blocks closing a site, and is not used by analytics. It is *not* reset when payments change, so the UI should show the account balance as the source of truth and the label as a tracking aid. A sensible UI line: "Marked paid: 900 · Received: 700".

### 2.5 `GET /api/sites/:id/payables` — what a site owes

**RBAC**: `read:transaction`. A `site_manager` can only call this for **their own site** (403 otherwise).

Query param: `warehouseId` (uuid, optional) — only the account with that warehouse. Always all-time balances. No pagination: a site has one account per warehouse.

**Response**
```json
{
  "success": true,
  "siteId": "…",
  "summary": { "sold": "2500.00", "paid": "1500.00", "outstanding": "1000.00" },
  "byWarehouse": [
    { "id": "<warehouseId>", "name": "Main Warehouse", "saleCount": 3,
      "sold": "2500.00", "paid": "1500.00", "outstanding": "1000.00",
      "markedPaidTotal": "1800.00", "unmarkedTotal": "700.00" }
  ]
}
```
`markedPaidTotal` / `unmarkedTotal` split `sold` by the manual paid label (tracking only).

### 2.6 Where the rest comes from (no duplicate endpoints)

- **The individual sales** of a site: `GET /api/inventory-movements?buyerSiteId=<site>&movementType=sale` (add `isMarkedPaid=true|false`, dates, `sortBy`, … — all existing filters). A warehouse's own view adds `sourceInventoryId`/inventory filters as usual.
- **The warehouse side of the accounts** (what each site owes it): `GET /api/warehouses/:id/sold-items` → `bySite` (see §2.7).
- **Payments**: §2.2.

### 2.7 `GET /api/warehouses/:id/sold-items` — now includes sales to sites

Existing endpoint (params `dateFrom`, `dateTo`, `saleStatus`). Changes:

- **Material figures include sales to sites**: `soldMaterialTotal` / `totalRevenue` count them, `soldMaterialCash` / `totalCashCollected` include account payments received in the period (by payment date), `*Outstanding` follows.
- **New `bySite: AccountRow[]`** — one account per site that bought from this warehouse (same row shape as `byWarehouse` above, keyed by site). Always all-time; dates don't apply.
- **Outstanding** (`soldMaterialOutstanding`, `totalOutstanding`) = the period's external-sale outstanding **plus** the all-time site account balances — a site payment never cancels another period's debt. Same rule in `GET /analytics/company` (`outstandingSalesReceivables`).
- Using a **`saleStatus` filter** leaves site sales (and `bySite`, which is then `[]`) out — they have no per-sale status.
- **`site_manager`** gets the old external-only figures and `bySite: []`.

---

## 3. COGS backfill (admin tooling)

### `POST /api/inventory-balances/backfill-sale-cogs`

**RBAC**: superadmin only (others get 403 `FORBIDDEN`). No body. Safe to re-run — only sales that have no COGS snapshot are touched. Rows it fills are marked `cogsEstimated: true`.

**Response**
```json
{ "success": true, "data": { "lots": 4, "salesUpdated": 17, "errors": [] } }
```
`lots` = (item, warehouse, license) stock lots replayed. Any per-lot failure is listed in `errors` instead of failing the call.

---

## 4. Sales analytics

### `GET /api/analytics/sales`

Existing params: `warehouseId`, `licenseId`, `saleStatus` (comma list), `dateFrom`, `dateTo`.

**Behaviour changes on this endpoint**

- **RBAC: admin / superadmin only.** A `site_manager` now gets `403` (this exposes company-wide revenue, COGS, profit and every site's balance).
- The existing figures (`totalRevenue`, `revenueVsCash`, `byStatus`, …) cover **external-buyer sales only**. Sales to sites are paid through accounts, not per sale, so they live in the `siteSales` block. (`GET /api/warehouses/:id/sold-items` is the exception: it includes site sales, §2.7.)
- With a **`saleStatus` filter**, `siteSales` comes back zeroed with `cashReceived` / `outstandingBalance` = `null` (site sales have no status) — same as `sold-items`.
- **Date-only `dateTo`** (`2026-10-13`) now means *through the end of that day* (previously midnight, which dropped that day). Applies to `/analytics/sales`, `/company`, `/licenses`, `/spend` and `/inventory`. Full ISO datetimes are used as given.

### Income from sales to sites (company & license views)

A sale to a site creates **no transaction** when it happens, so its revenue is recognised as income **at the sale movement**. The site's later account payments are only settlement of that debt and are **not counted again**.

**`GET /api/analytics/company`** (admin/superadmin, `income` block)

| Field | Meaning |
|---|---|
| `materialSaleRevenue` | External material revenue **+ site sale revenue**. |
| `siteSaleRevenue` | **NEW.** Revenue from sales to sites in the period (by sale date). Included under a `licenseId` filter too — the sale carries a license. |
| `materialSaleCash` / `totalSalesCash` | Include account payments received in the period (by payment date). |
| `outstandingSalesReceivables` | External outstanding + all-time site account balances. Under `licenseId` the site balances are left out (account cash has no license). |
| `other` | Cash that is neither a sale payment nor a site account payment. |
| `total` | `cash income − site account payments + siteSaleRevenue`. |

Top level: `netCashFlow` stays **cash-based** (cash in − expense). New **`netIncome`** = `income.total − expense.total` (site sales counted when sold).

**`GET /api/analytics/licenses`** — each license's `totalReceived` (and therefore `netCashFlow`) now also includes revenue from **its sales to sites**, counted at the sale date. Account payments have no license, so they are not added again. The field names are unchanged even though this figure now mixes cash with site-sale revenue recognised at sale time.

**Not affected** (site-ledger based; a site is a third-party buyer, so sales to it write nothing to the ledger): `/analytics/spend`, `/budget`, `/budget-health`, `/sites/:id/summary`. `/analytics/inventory` is quantities/stock value only.

New top-level field **`profitability`** (external material sales; unchanged shape):

```json
"profitability": {
  "saleCount": 12, "revenue": "9000.00", "cogs": "6200.00",
  "grossProfit": "2800.00", "marginPct": "31.11%",
  "cashCollected": "7000.00", "actualProfit": "2150.00", "unrealizedProfit": "650.00",
  "estimatedCogsSaleCount": 3, "missingCogsSaleCount": 0
}
```

| Field | Definition |
|---|---|
| `revenue` | Sum of sale totals (only sales that have a COGS snapshot). |
| `cogs` | Sum of `cogsTotalCost`. |
| `grossProfit` | `revenue − cogs` (accrual — includes unpaid sales). |
| `marginPct` | `grossProfit ÷ revenue`, formatted string with `%`. |
| `cashCollected` | Cash paid on those sales. |
| `actualProfit` | Profit on the **collected portion**: per sale `cash − cogs × (cash ÷ revenue)`. |
| `unrealizedProfit` | `grossProfit − actualProfit` (profit still in receivables). |
| `estimatedCogsSaleCount` | Sales whose COGS was backfilled (an estimate). Show a "contains estimates" hint when > 0. |
| `missingCogsSaleCount` | Sales with **no** snapshot (excluded from every figure above). > 0 means the backfill hasn't run. |

New top-level field **`siteSales`** (sales to sites; profit is **accrual-based** — there is no per-sale "actual profit" because payments aren't tied to sales):

```json
"siteSales": {
  "saleCount": 9,
  "revenue": "14000.00",
  "profitability": {
    "saleCount": 9, "revenue": "14000.00", "cogs": "10400.00",
    "grossProfit": "3600.00", "marginPct": "25.71%",
    "estimatedCogsSaleCount": 0, "missingCogsSaleCount": 0
  },
  "cashReceived": "9000.00",
  "outstandingBalance": "5000.00"
}
```

| Field | Definition |
|---|---|
| `revenue` | All active sales to sites in the filter. |
| `profitability.*` | Like-for-like over sales that have a COGS snapshot (same rules as above, minus cash fields). |
| `cashReceived` | Account payments in the date range (by `paymentDate`; `warehouseId` filter applies). |
| `outstandingBalance` | What sites owe right now (all-time, ignores dates; `warehouseId` filter applies). |

Under a `licenseId` filter, `cashReceived` and `outstandingBalance` are **`null`** (account cash has no license). Equipment is not part of either block.

---

## 5. Closed sites & transfer rules

### 5.1 Closed / deleted sites (material only)
A **closed or soft-deleted site** cannot be the source, destination or buyer of a **material** movement (purchase, transfer, consume, loss, sale). Checked at stage **and** at approval. Reversals are exempt. **Equipment (bulk and individual) movements are unaffected.**

Error: `409 CONFLICT` — "Site is closed and cannot accept any movements." (or `404` "Site not found." for a deleted site).

### 5.2 Closing a site — `PATCH /api/sites/:id` with `status: "closed"`
In addition to existing checks (no stock, no active equipment, no active rental), closing is now **blocked while the site owes any warehouse** (total account balance > 0).
Error: `409 CONFLICT` — "Site cannot be closed while it still owes 1234.00 to warehouses for purchased materials."
UI hint: link the user to `GET /sites/:id/payables`. The "marked paid" label is ignored by this check.

### 5.3 Material transfers
A **material `transfer` with a site on either side is rejected** (warehouse→site, site→warehouse, site→site). Error: `400 VALIDATION_FAILED` — "Material cannot be transferred to or from a site. Sell it to the site (buyerSiteId) instead."
- Warehouse→warehouse material transfers still work. Equipment transfers are unaffected.
- **Reversing** an old transfer that involves a site is still allowed.
- Purchase directly into a site, and consume/loss at a site, are unchanged.
- UI: hide/disable "transfer" for material when either location is a site; offer "Sell to site" instead.

---

## 6. Filters & sorting additions

Multi-value filters are comma-separated (`?type=money_in,money_out`). Booleans are the strings `true`/`false`. Amounts are decimal strings. Unless stated, defaults are unchanged.

### 6.1 Transactions — `GET /api/transactions`
Returns `{ success, data: Transaction[], pagination }`. Default `limit` 20, default sort `transactionDate` desc.

| Param | Status | Notes |
|---|---|---|
| `siteId`, `categoryId`, `licenseId`, `equipmentId`, `type`, `isSystemGenerated`, `dateFrom`, `dateTo` | existing | A `site_manager` must still pass `siteId`. Account payments have `licenseId = null` and `siteId = null`, so they only show up under `warehouseId` / `buyerSiteId` / `isInternal`. |
| `warehouseId` | **new** | |
| `itemId` | **new** | |
| `inventoryMovementId` | **new** | All transactions (payments) for one external sale / inventory movement. |
| `equipmentMovementId` | **new** | Same for an equipment movement. |
| `buyerSiteId` | **new** | Payments from this site: its account payments (and their reversals). |
| `isInternal` | **new** | `true`: only payments tied to sales to sites (account payments); `false`: everything else. |
| `minAmount`, `maxAmount` | **new** | Inclusive. |
| `isApproved` | **new** | `false` = staged / awaiting approval. |
| `loggedBy` | **new** | User id. |
| `includeReversed` | **new** | `true` also returns reversed originals and reversal entries (default hides them). |
| `search` / `q` | extended | Now matches `description` **and** `note`. |
| `sortBy` | extended | `transactionDate` (default), `createdAt`, `amount`, `type`. `createdAt` is a tiebreaker. |
| `sortOrder` | existing | |

### 6.2 Ledgers — `GET /api/ledgers`
Returns `{ success, data: LedgerEntry[], pagination }`. Default `limit` 20, default sort `timestamp` desc.

| Param | Status | Notes |
|---|---|---|
| `siteId`, `licenseId`, `sourceRefType`, `isReversal` | existing | |
| `dateFrom`, `dateTo` | **new** | On the entry `timestamp` (date comparison). |
| `direction` | **new** | `debit` (amount > 0, cost added) or `credit` (amount < 0, cost removed). |
| `minAmount`, `maxAmount` | **new** | Signed amounts, inclusive. |
| `isReversed` | **new** | `true`/`false`. |
| `includeReversed` | **new** | `true` shows the full audit trail (originals + reversals). Ignored if `isReversal`/`isReversed` is given. |
| `loggedBy` | **new** | |
| `sourceRefId` | **new** | Ledger entries produced by one movement/transaction. |
| `categoryId` | **new** | Only matches entries from manual transactions (material/equipment entries have no category). |
| `search` / `q` | extended | Matches `description` **and** `note`. |
| `sortBy` | extended | `timestamp` (default), `amount`, `createdAt`. Unknown value → default. |
| `sortOrder` | existing | Applies when `sortBy` is given; the default view is newest first. |

### 6.3 Sorting-only additions

Invalid `sortBy`: **sites, inventories → 400** (strict enum); **inventory balances, inventory movements, site payments → 400** with the allowed list; **warehouses, approvals, ledgers → silently fall back to the default**.

| Endpoint | `sortBy` options | Default (no `sortBy`) |
|---|---|---|
| `GET /api/sites` | `name`, `location`, `status`, `createdAt`, `updatedAt`, `laborBudget`, `materialBudget`, `otherBudget` | `createdAt` desc *(was unordered)* |
| `GET /api/warehouses` | `name`, `location`, `createdAt`, `updatedAt`, `totalMaterials`, `totalEquipment` | `name` asc |
| `GET /api/inventories` | `name` (site/warehouse name), `inventoryType`, `createdAt`, `updatedAt` | `createdAt` desc *(was unordered)* |
| `GET /api/inventory-balances` | `quantity`, `totalValue`, `averageUnitValue`, `itemName`, `createdAt`, `updatedAt` | `createdAt` desc *(was unordered)* |
| `GET /api/inventory-movements` (sales etc.) | `movementDate`, `createdAt`, `quantity`, `unitCost`, `totalCost`, `paidAmount`, `saleStatus`, `clientName` | `movementDate` desc |
| `GET /api/approvals` | `createdAt`, `updatedAt`, `status`, `approvalType` | `createdAt` desc |
| `GET /api/warehouses/:id/site-payments`, `GET /api/sites/:id/payables/payments` | `paymentDate`, `amount`, `createdAt` | `paymentDate` desc |

All of these accept `sortOrder=asc|desc`. For sites, inventories, balances and movements: `sortBy` without `sortOrder` sorts **ascending**. Transactions, ledgers, approvals and site payments keep their descending default.

Not sortable (by design): inventories by their item counts (`materialItemCount`, etc.) — those are computed per page.

---

## 7. Frontend TODO checklist

- [ ] Sale form: add a "Buyer" toggle — external client (`clientName`) **or** site (`buyerSiteId`, material items only). Never send both. For a site buyer, hide the "paid / paid amount" inputs.
- [ ] A site buying several items = one sale movement per item (a "cart" in the UI is just several sale requests). Payment is one separate step afterwards.
- [ ] Site page: **Payables** tab from `GET /sites/:id/payables` — account cards per warehouse (sold / paid / outstanding), sales table from `GET /inventory-movements?buyerSiteId=` with a paid-label checkbox, payments list from `GET /sites/:id/payables/payments`.
- [ ] Warehouse page: sold-items overview now includes site sales; render `bySite` (account per site) with a "Register payment" action → `POST /warehouses/:id/site-payments` (optionally pass the ticked sales as `markPaidMovementIds`). Cap the amount input at the account's `outstanding`.
- [ ] Paid label: bulk tick/untick via `POST /warehouses/:id/sold-items/mark-paid` (`paid: false` unmarks; offer both actions on the selection). Show it as tracking only; balance is the source of truth (show "Marked paid X · Received Y").
- [ ] Payment reversal action → `POST /warehouses/:id/site-payments/:paymentId/reverse` (handle 409 for closed site).
- [ ] Do **not** call the per-sale payment endpoints for site sales (they now return 400).
- [ ] Show `isInternal` / buyer site on movement rows; add `isInternal` / `buyerSiteId` / `isMarkedPaid` filters to the sales list.
- [ ] Sales analytics: render `profitability` (external) and `siteSales`; show an "estimates included" note when `estimatedCogsSaleCount > 0` and a "backfill needed" note when `missingCogsSaleCount > 0`. Handle `null` `cashReceived`/`outstandingBalance` under a license filter or a `saleStatus` filter. Hide the sales analytics screen from `site_manager` (403).
- [ ] Company financials: show `income.siteSaleRevenue`, use `income.total` for income and `netIncome` (accrual) next to `netCashFlow` (cash). License view: `totalReceived` now includes site-sale revenue.
- [ ] Close-site flow: handle the 409 (site still owes a warehouse) and link to payables.
- [ ] Reverse-sale flow: handle the 409 "payments above what it owes" by pointing the user to the payments list.
- [ ] Material transfer form: disallow site as source/destination; point users to "Sell to site".
- [ ] Material movement forms: handle 409 "Site is closed…" on any movement involving a closed site.
- [ ] Transactions/ledgers filter UIs and sort controls per §6; sort controls for sites, warehouses, inventories, balances, movements, approvals.
- [ ] Types: add `buyerSiteId`, `isInternal`, `isMarkedPaid`, `markedPaidAt`, `markedPaidBy`, `cogsUnitCost`, `cogsTotalCost`, `cogsEstimated` to the inventory movement type; `Transaction.licenseId` is now `string | null`; `saleStatus`/`paidAmount` can be `null` on site sales.
