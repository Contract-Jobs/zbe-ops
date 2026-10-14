# Frontend Sync — Material Market Value, Approvals Filters & Bulk Resolve

v2 API (`app/api`, `lib/v2_services`). Date of change: 2026-10-14. Same conventions as `v2-route-details.md` (response wrapper `{ success, data }`, comma-separated multi-value filters, money as **strings**).

## Rollout
Apply migration `drizzle_v2/20261014074819_item_market_value` (adds nullable `inventory_items.market_value`). No backfill: existing materials have `marketValue: null` until staff set it.

---

## 1. Market value on materials

`marketValue` is the **current market price per unit** of a material — a reference price staff maintain. It is **not** the weighted-average cost (`averageUnitValue`) held in balances, and it is not touched by movements.

### 1.1 Set it — `POST /api/inventory-items`, `PATCH /api/inventory-items/:id`

New optional body field:

| Field | Type | Notes |
|---|---|---|
| `marketValue` | decimal string \| `null` | `>= 0`, at most 2 decimals (`"12.50"`). `null` clears it. **Materials only** — setting it on an equipment item (or switching a priced material to equipment) → `400 VALIDATION_FAILED` "Only materials can have a market value." Omit to leave unchanged. |

Every inventory item object now has `marketValue: string | null` (get, list, in-bulk).

### 1.2 Where it is returned

| Endpoint | New fields |
|---|---|
| `GET /api/inventory-balances` (each balance) | `marketValue`, `totalMarketValue` |
| `GET /api/inventory-items/:id/balances` (each row) | `marketValue`, `totalMarketValue` |
| `GET /api/inventories/:id/materials` (each row) | `marketValue`, `totalMarketValue` |
| `GET /api/inventory-items` (each item) | `marketValue` (item field), `totalMarketValue` (all locations combined) |
| `GET /api/sites/:id/summary` → `inventory[]` | `marketValue` |

- `marketValue` = the item's per-unit market price.
- `totalMarketValue` = `quantity × marketValue` (string, 2 decimals).
- Both are **`null`** when the item has no market value. Treat `null` as "not set", never as 0.
- Compare with `averageUnitValue` / `totalValue` (what the stock **cost**) to show unrealised gain/loss.

`GET /api/inventory-balances` also accepts `sortBy=marketValue` and `sortBy=totalMarketValue` (existing `sortOrder` rules apply).

Types: add `marketValue: string | null` to `InventoryItem`; `marketValue?`, `totalMarketValue?` (`string | null`) to the balance row types.

---

## 2. Approvals — filters

`GET /api/approvals` — response shape unchanged: `{ success, data: Approval[], pagination }`. A `site_manager` still only sees approvals they submitted.

New query params (all optional, combine freely):

| Param | Type | Notes |
|---|---|---|
| `status` | `pending`,`approved`,`rejected` (comma list) | Existing. Unknown value → `400`. |
| `approvalType` | comma list | Existing. |
| `submittedBy` | user id(s) | **NEW.** |
| `approvedBy` | user id(s) | **NEW.** Who resolved it (approver **or** rejecter). |
| `recordId` | uuid(s) | **NEW.** The approval(s) for one movement / transaction / etc. |
| `dateFrom`, `dateTo` | ISO date | **NEW.** On when it was **submitted** (`createdAt`). A date-only `dateTo` includes that whole day. |
| `resolvedFrom`, `resolvedTo` | ISO date | **NEW.** On when it was last updated, i.e. resolved for approved/rejected rows. |
| `search` / `q` | text | **NEW.** Matches the approval `notes`. |
| `sortBy` | `createdAt` (default), `updatedAt`, `status`, `approvalType` | Existing; unknown value falls back to the default. |
| `sortOrder`, `page`, `limit` | | Existing. |

Each approval row now also has **`submittedByName`** and **`approvedByName`** (`string | null`) so the list needs no extra user lookups.

Typical "inbox": `?status=pending&approvalType=inventory_movement&sortBy=createdAt&sortOrder=asc`.

---

## 3. Approvals — bulk approve / reject

### `POST /api/approvals/bulk`

**Body**

| Field | Type | Notes |
|---|---|---|
| `approvalIds` | uuid[] (1–100) | Duplicates ignored. |
| `status` | `"approved"` \| `"rejected"` | Applied to every id. |
| `notes` | string | Optional, appended to each approval's notes (same as the single PATCH). |
| `atomic` | boolean | Default `false` — see below. |

**Behaviour**
- Same rules as `PATCH /api/approvals/:id`, **checked per approval**: admins/superadmins resolve anything; a `site_manager` can only resolve movements/rentals arriving at their own site.
- Processed **oldest first** (a later movement may depend on an earlier one being applied).
- **`atomic: false` (default, partial):** each approval is applied in its own transaction. One that can't be applied (insufficient stock, closed site, already resolved, no permission, …) is reported in `results`; the others still go through.
- **`atomic: true`:** one transaction for the whole batch. The first failure rolls everything back and the call returns an error (status from the failing approval, message ends with `(approval <id>; nothing was changed)`).

**Response** (partial mode) — always `200` if the request itself was valid:
```json
{
  "success": true,
  "data": {
    "decision": "approved",
    "total": 3,
    "succeeded": 2,
    "failed": 1,
    "results": [
      { "approvalId": "…", "ok": true },
      { "approvalId": "…", "ok": true },
      { "approvalId": "…", "ok": false, "code": "CONFLICT", "error": "cannot approve an approval with status: approved" }
    ]
  }
}
```
`code` is one of `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION`, or `ERROR` (unclassified). Unknown ids come back as `NOT_FOUND` entries.

**Errors**: `400 VALIDATION_FAILED` for an empty list, more than 100 ids, or a non-UUID id.

---

## 4. Frontend TODO

- [ ] Item create/edit form: optional **Market value** (per unit) for materials only; send `null` to clear.
- [ ] Balances tables (inventory, location materials, item detail): show `marketValue` / `totalMarketValue` next to cost; render `null` as "—"; allow sort by `totalMarketValue`.
- [ ] Approvals list: filters for status, type, submitter, resolver, submitted range, resolved range, notes search; use `submittedByName` / `approvedByName`.
- [ ] Approvals list: row checkboxes → **Approve selected / Reject selected** via `POST /approvals/bulk` (cap the selection at 100). Show a result summary from `results` (per-row error text for failures) and refresh the list. Offer an "all or nothing" option mapped to `atomic: true`.
