# Migration Guide: Legacy API → v2 API

Audience: anyone porting a client (frontend, integration, script) from the retired `app/api_old` system (documented in `route-details.md`) to the current one (`app/api`, documented in `v2-route-details.md`). Read **§2 first** — almost every route-level difference below is really just one of these seven conceptual shifts showing up in a different place, and mapping routes 1:1 without understanding them will produce subtly wrong code.

---

## 1. Why this happened

The legacy system modeled materials and equipment as two separate, parallel tables (`MaterialCatalog`/`Equipment`) each with their own flat `currentStatus`/`fromSiteId`/`toWarehouseId`-style log tables, and a location was represented as a pair of nullable FK columns (`siteId`, `warehouseId`) repeated on every entity that needed one. The v2 rewrite (see `new-design.md`, `state-machine-and-constraints.md`, `financial-integrity-open-questions.md` in the repo root for the original design reasoning) replaced this with a single event-sourced model: one unified inventory catalog, one unified location node, and current state as a **projection** of movement history rather than a directly-mutated column. Most of what follows is that model change surfacing in each route group.

## 2. Core conceptual shifts (read this first)

### 2.1 Materials + Equipment → one `InventoryItem` catalog, split two ways
There is no more `MaterialCatalog` table and no more flat `Equipment` table. Everything is an `InventoryItem` (`/api/inventory-items`) distinguished by two independent flags:
- **`category`**: `"material"` or `"equipment"` — what it *is*.
- **`tracking`**: `"quantity"` or `"individual"` — how it's *counted*. Quantity-tracked stock (materials, and now also **bulk equipment** — e.g. a pile of identical scaffolding clamps) lives in `inventoryBalances`/`inventoryMovements`. Individually-tracked equipment (each unit is its own row with its own serial/identifier) lives in `individualEquipmentItems`/`individualEquipmentMovements` — this is a genuinely new sub-model; the legacy system only ever tracked equipment individually.

**Migration rule**: before porting any equipment call, decide whether the item is really unique-instance-tracked (→ `/equipment*`, `/equipment-movements`) or better modeled as counted stock (→ `/inventory-items` with `category:"equipment", tracking:"quantity"`, then `/inventory-movements`). Most ported equipment will map to individually-tracked, since that's what the legacy system exclusively supported — the quantity-tracked-equipment path is a new option, not a required migration target.

**This is a backend data-model unification, not a UX mandate.** The frontend should keep presenting and handling Materials and Equipment as separate, clearly distinct sections/flows for the user — separate nav items, separate list views, separate create forms — exactly as the legacy UI did. Nothing about `category`/`tracking` living on one shared `InventoryItem` type means the two should visually or navigationally merge into one generic "inventory" screen; that would just make the product more confusing for the sake of mirroring an implementation detail the user never needs to see. Treat `category` (and, for equipment, `tracking`) as the field the frontend uses internally to route to the right screen/component and the right movement endpoint — not as something that changes what the user is shown.

### 2.2 Logs → Movements (event-sourced, not mutable state)
`MaterialLog`/`EquipmentLog` (a single row per action, with an `action` string and a hand-maintained `approvalStatus`) are gone. In their place: `InventoryMovement` / `IndividualEquipmentMovement`, discriminated by `movementType` instead of `action`, and current state (`InventoryBalance`, `IndividualEquipmentItem`'s four dimensions) is **recomputed from the full movement history**, not stored as an independently-updated field. This is why `/equipment-states/rebuild`, `/inventory-balances/rebuild`, and `/ledgers/[siteId]/rebuild` exist — they didn't and couldn't exist in the legacy model, because there was no canonical event log to replay.

**Practical effect**: you can no longer "just update a status field." Every state change is a movement; if a movement is wrong, you reverse it (which recomputes state from the remaining valid history) and log the correct one, rather than editing state directly.

### 2.3 Site/Warehouse columns → one `Inventory` node
Legacy entities carried `fromSiteId`/`fromWarehouseId`/`toSiteId`/`toWarehouseId` (four nullable columns) or a `{ id, type }` pair per location reference. v2 has exactly one `inventories` table — a node is *either* a site or a warehouse (DB-enforced, never both), and every movement/balance/equipment record references exactly one `sourceInventoryId`/`destinationInventoryId`/`currentInventoryId`/`inventoryId`, no type tag needed alongside it.

**Migration rule**: anywhere the legacy payload took `{ id: string, type: "site" | "warehouse" }`, you now need the corresponding **node id**, not the site/warehouse id directly. Resolve it first: `GET /api/inventories?siteId=X` or `?warehouseId=X` (both site and warehouse creation now auto-provision their node, so this always exists after the fact — but you must look it up, since a site's/warehouse's own `id` is *not* the same as its inventory node's `id`).

### 2.4 Approval types consolidated
Legacy `approvalTypeEnum` had six values, including both `inventory_movement` and a separate `material_movement`. v2 collapsed this to five: `inventory_movement | equipment_movement | transaction | progress_log | rental_event` — quantity movements for *both* materials and bulk equipment now share the single `inventory_movement` type (matching §2.1's unification), rather than materials having their own.

### 2.5 RBAC resource names shifted, and don't map 1:1 onto route groups
Legacy RBAC (as best captured in `route-details.md`) was mostly role-tier gates (Admin/Superadmin vs. Site Manager) per route group. v2 uses a resource-statement model (`lib/auth/access-control.ts`) with resources `tender | site | asset | warehouse | license | inventory | transaction | progress_log | budget | approval | rental`. The one that trips people up: **equipment CRUD checks `asset`, but equipment *movements* (purchase/sale/deploy/etc., i.e. the actual way equipment enters and changes state) check `inventory`** — the same resource materials use. A site_manager has `read`-only on `asset` but `create` on `inventory`, so they can run a full equipment purchase through `/equipment-movements` without ever being able to `PATCH`/`DELETE` the resulting equipment record directly.

### 2.6 New invariant: sales must be warehouse-sourced
Legacy: materials' `sold` action already structurally required `source: { type: "warehouse" }` in its schema. Equipment's `sold` action, however, accepted `source?: { id, type: "site" | "warehouse" }` — **selling equipment directly from a site was legacy-legal**. v2 now enforces "sites don't sell anything" as a hard, server-side invariant for **both** materials and equipment — a site-sourced sale is rejected with `VALIDATION_FAILED` regardless of item type. If your old client sold equipment straight off a site, that call now needs a `return_to_warehouse` movement first.

### 2.7 Reversal accounting is fixed, not just renamed
Both systems have the isReversal/isReversed/reversalOfId shape on movements/transactions/ledger rows. But v2's ledger reversal math was extensively corrected during this rewrite (double-negation bugs, site-to-site transfers now correctly produce two ledger entries — one per site — instead of one, `isReversed` now actually gets set on the original when its reversal lands, rejecting a pending transaction reversal now correctly un-flags it). If you ever compared legacy ledger totals against a reversed pair's net effect, don't assume the same arithmetic held in the legacy system — it may have shown a doubled or dropped total in cases v2 now nets to exactly zero. There's nothing to "migrate" here client-side, but don't use old ledger numbers as a source of truth to validate the new system against.

---

## 3. Feature-by-feature migration map

### 3.1 Materials → Inventory Items & Movements

| Old | New | Notes |
|---|---|---|
| `POST /api/materials` | `POST /api/inventory-items` `{ category: "material", tracking: "quantity", ... }` | `type: "single"\|"set"` → `compositionType`. Creates the **catalog entry only** — no stock. Stock is created by a `purchase` movement (see below), same as before (materials never had stock at catalog-creation time in the old system either). |
| `PATCH/GET/DELETE/restore /api/materials/[id]` | Same verbs on `/api/inventory-items/[id]` | 1:1. |
| `GET /api/materials` | `GET /api/inventory-items?category=material` | |
| `GET /api/inventory/balances` | `GET /api/inventory-balances` | Filter by `itemId`/`inventoryId`, **not** `materialId`/`siteId`/`warehouseId` — resolve the node id first (§2.3). |
| `POST /api/inventory/balances/[id]/adjust` | **No direct equivalent — removed by design.** | The "adjustment" concept was deliberately dropped (see `financial-integrity-open-questions.md`). To fix a wrong balance: find the offending movement via `GET /api/inventory-balances/movements?itemId=&inventoryId=`, reverse it (`POST /api/inventory-movements/[id]/reverse`), then log the correct one. For genuine physical shrinkage/damage (not a data-entry mistake), use `POST /api/inventory-movements` with `movementType: "loss"` instead — it requires `metadata.reason` and is priced from the current weighted-average cost, not a client-supplied `newUnitPrice`. |
| `GET /api/inventory` | `GET /api/inventories` | Response shape changed — now a list of unified nodes with joined `site`/`warehouse`, not a custom per-location aggregate. Per-location counts (`materialTypesCount` etc.) aren't reproduced here; warehouse-level totals now live on the warehouse list response instead (`GET /api/warehouses` returns `totalMaterials`/`totalEquipment` per row). |
| `GET /api/inventory/[id]/materials` | `GET /api/inventory-balances?inventoryId=X&itemCategory=material` | |
| `GET /api/inventory/[id]/equipments` | `GET /api/equipment?inventoryId=X` (individually-tracked) and/or `GET /api/inventory-balances?inventoryId=X&itemCategory=equipment` (quantity-tracked bulk equipment) | Two calls now, since the two equipment sub-models are separate. |
| `GET /api/inventory/trace/[catalogId]` | `GET /api/inventory-items/[id]/trace` | Shape is close: `currentBalances`/`history` with resolved `fromLabel`/`toLabel`. |
| `POST /api/inventory/logs` (action-discriminated) | `POST /api/inventory-movements` (movementType-discriminated) | See action map below. |
| `GET /api/inventory/logs`, `GET /api/inventory/logs/[id]` | `GET /api/inventory-movements`, same with `?itemId=` etc. | |
| `POST /api/inventory/logs/[id]/reverse` | `POST /api/inventory-movements/[id]/reverse` | **Behavior change**: legacy was admin/superadmin only. v2 only requires base `create:inventory` (so a site_manager can reverse their own site's movements too) — and, like legacy, commits immediately with no approval step. |

**Material action → movementType map**: `purchase`→`purchase`, `transfer`→`transfer`, `sold`→`sale` (unchanged constraint — warehouse-sourced only in both systems), `used_up`→`consume`, `missing`→`loss` (now requires `metadata.reason` instead of a free-text `notes`, and only reachable via the loss-specific path — attempting `movementType: "loss"` through the generic creation logic is explicitly refused server-side to guarantee the reason requirement can't be bypassed).

### 3.2 Equipment → Individually-Tracked Equipment & Movements

| Old | New | Notes |
|---|---|---|
| `POST /api/equipment` (direct create) | **Disabled.** | `IndividualEquipmentService.createEquipment` unconditionally throws. Every equipment record must now originate from `POST /api/equipment-movements` with `movementType: "purchase"` (`autoCreateEquipment` payload) or from a `rent_in` via `POST /api/rentals`. This guarantees every piece of equipment carries a real movement/transaction/ledger trail from day one — the old direct-create path let equipment enter with a value but no recorded spend anywhere. |
| `PATCH /api/equipment/[id]` | Same route | Still allows `originalValue`/`bookValue`/`vendorName`/`identifier` edits directly. Location/condition/assignment/lifecycle are movement-only in both systems, but v2 enforces it at the schema level (those fields simply aren't accepted keys anymore, vs. legacy's doc-level "modifying location or value is forbidden" convention). |
| `GET/DELETE/restore /api/equipment[/id]` | Same routes | Filter params changed: legacy `siteId/warehouseId/status/ownershipStatus` → v2 `itemId/inventoryId/lifecycleStatus/assignmentStatus/condition` (the new four-dimension state model replaces the old flat `currentStatus`/`ownershipStatus` strings — see §2.2). |
| `POST /api/equipment/logs` (action-discriminated) | `POST /api/equipment-movements` (movementType-discriminated) | See action map below. |
| `GET /api/equipment/logs[/[id]]` | `GET /api/equipment-movements` | |
| `POST /api/equipment/logs/[id]/reverse` | `POST /api/equipment-movements/[id]/reverse` | **Behavior change**: legacy staged this through the approval workflow (auto-approved for admin). v2 commits immediately, same as the inventory-movement reversal — no approval step at all. |

**Equipment action → movementType map** — read carefully, this one isn't 1:1:
- `purchased` → `purchase`.
- `transferred` → **splits into three**, chosen by the source/destination node types (legacy's single generic action covered any combination via `source`/`destination: {id, type}`): warehouse→site = `deploy_to_site`; site→warehouse = `return_to_warehouse`; site→site = `transfer_between_sites`. There is no direct warehouse→warehouse individual-equipment movement type in v2 — if you need that, model it as `return_to_warehouse` won't apply (both ends are warehouses); this is an edge case the new movement taxonomy doesn't have a named slot for, treat it as a gap to design around (e.g. a manual note, or route it through a site as an intermediate hop) rather than assuming a hidden equivalent.
- `sold` → `sale` — **now warehouse-source-only** (§2.6); legacy allowed selling straight from a site.
- `used_up` → no direct equivalent for individually-tracked equipment ("using up" a unique unit isn't a modeled concept — that's a quantity-tracked idea). If you're actually tracking bulk/quantity equipment, this is `consume` via `/inventory-movements` instead.
- `missing` → closest equivalent is `dispose` (a lost/written-off individual unit becomes lifecycle `DISPOSED`, terminal). There's no separate individual-equipment `loss` movement type the way materials have one — `dispose` is the only "this is gone" outcome available.
- `maintenance_dispatch` → `send_to_maintenance`.
- `maintenance_return` → `return_from_maintenance` (`repairCost` → `movementCost`; `licenseId` is now only required when `movementCost` is actually nonzero — a free repair needs neither and posts no financial transaction at all, vs. legacy which always required a `licenseId` for this action per its schema).
- `degraded` and `appreciated` → **both collapse into the single `degrade` movementType, but `degrade` only ever subtracts from `bookValue`** (clamped at zero) — there is **no way to increase an equipment's book value through a movement in v2**. If you need to model appreciation, the only path left is a direct `PATCH /api/equipment/[id]` with a new `bookValue` — which, unlike a movement, creates no transaction/ledger trail. This is a real capability gap versus legacy, not just a renaming; flag it if your legacy usage relied on appreciation actually posting to the ledger.

### 3.3 Rentals

Route shapes are close to 1:1 (`/api/rentals`, `/[id]`, `/[id]/events`, `/[id]/adjust`, `/[id]/return`) and the request payloads match closely (`equipmentId: "new"` + `autoCreateEquipment` still works the same way). One thing worth knowing rather than "migrating": **this is the one area where v2 briefly regressed and has since been restored to (at least) legacy parity** — for a window during the v2 rewrite, rental movements committed immediately with no approval gate and no financial/ledger trail at all. That's been fixed; a rental now stages its equipment movement and only commits it — along with the upfront-fee transaction and settlement true-up — once its `rental_event` approval actually resolves, same auto/pending split every other movement type gets. If you're referencing rental behavior you observed mid-migration, re-verify against the current system rather than assuming it matches what you saw a few weeks ago.

### 3.4 Sites, Tasks & Lifecycle

Nearly 1:1. Two things to account for:
- **`otherBudget` is new** — legacy sites had `laborBudget`/`materialBudget` only; v2 adds a third bucket. Any UI/report that assumed exactly two budget categories needs updating, not just re-pointing.
- Task claim/complete were already a two-step, distinct-endpoint flow in legacy (`/claim` stages, `/complete` is the only thing that actually finishes it) — this carried over unchanged, so no migration work needed here specifically.

### 3.5 Master Data (Tenders, Licenses, Warehouses)

Essentially unchanged route-for-route. Warehouse sold-items now read from the movement tables directly (`movementCost`/`totalCost` on the movement row) rather than a legacy log's `price` field — same numbers, different underlying source, no client-facing shape change beyond field-name consistency.

### 3.6 Financial Transactions & Ledger

| Old | New | Notes |
|---|---|---|
| `POST /api/transactions` | `POST /api/transactions` | **Tightened**: legacy accepted `isReversal`/`reversalofId` directly in the create payload (a client could assert at creation time that a transaction *is* a reversal). v2's create schema has no such fields — a reversal can only be produced by `POST /api/transactions/[id]/reverse`, which looks up and correctly links the original. If any old integration was constructing "reversal" transactions by hand at creation time, that path no longer exists and must be replaced with a real reversal call against the original transaction's id. |
| `POST /api/transactions/[id]/reverse` | Same route | Still admin-only in intent for *system-generated* transactions (reverse the underlying movement instead — that flips the transaction as a side effect); manual transactions are reversible by any `create:transaction` role, same shape, still staged through approval (unlike movement reversals). |
| `GET /api/ledgers` | Same route | Default view now hides a fully-cancelled reversal **pair** (both sides), not just the correction half — if you were manually summing the legacy feed to get a running total, the equivalent v2 default view is now safe to sum directly. |
| — (nothing) | `POST /api/inventory-balances/rebuild`, `GET /api/inventory-balances/verify`, `POST /api/equipment-states/rebuild`, `GET /api/equipment-states/[id]/verify`, `POST /api/ledgers/[siteId]/rebuild`, `GET /api/ledgers/[siteId]/verify` | All genuinely new — see §4. |

### 3.7 Approvals

Same shape (`GET /api/approvals`, `GET /api/approvals/[id]`, `PATCH /api/approvals/[id]`). Only the `approvalType` value set changed — see §2.4. If any old code branched on `approvalType === "material_movement"`, it should now check `"inventory_movement"` instead (and expect to see bulk-equipment movements tagged the same way, not split out).

### 3.8 Analytics

Route-for-route, same intent, same RBAC (`read:transaction`/`read:budget`/`read:inventory` depending on endpoint), plus one addition — see §4.

---

## 4. New features with no legacy equivalent

- **`GET /api/analytics/company`** — a whole-company income/expense decomposition (admin/superadmin only). Legacy had no concept of this at all: every legacy financial analytics endpoint was site-scoped, because `project_ledger` (the thing they all summed) only ever has entries for a real site. This endpoint separately surfaces **non-site** spend (`warehouseAnchored` vs. pure `corporate`) and **all income** (which is inherently non-site now that sales can only happen from a warehouse — see §2.6) — money that was always real but was previously invisible to every reporting endpoint. If you need a true top-line P&L, this is the only place to get it; don't try to reconstruct it by summing the per-site endpoints, they structurally can't include it.
- **Rebuild/verify endpoints** (`/inventory-balances/rebuild`, `/inventory-balances/verify`, `/equipment-states/rebuild`, `/equipment-states/[id]/verify`, `/ledgers/[siteId]/rebuild`, `/ledgers/[siteId]/verify`) — a direct consequence of §2.2: because current state is now a projection of history rather than an independently-mutated column, it can drift from what the history actually implies (a bug, a manual DB edit, a migration hiccup), and now there's a way to detect (`verify`) and correct (`rebuild`) that instead of it being silently permanent. Use `verify` for routine health checks; `rebuild` is a heavier recovery operation and admin/superadmin-gated (superadmin-only for the two `rebuild` endpoints that operate system-wide rather than per-site).
- **Trace endpoints** (`/inventory-items/[id]/trace`, `/equipment/[id]/trace`) — full cross-location lifecycle history for one catalog item or equipment unit. The legacy system had a materials-only trace endpoint (`/api/inventory/trace/[catalogId]`); v2 adds the equipment equivalent, since equipment now has the same kind of rich movement history materials always did.
- **Standalone sub-item CRUD** (`/inventory-items/[id]/subitems[/subId]`) as its own resource, independent of the parent item's own update call — legacy only supported subitems as a create-time array with whole-array overwrite on update.
- **Quantity-tracked bulk equipment** as a whole (§2.1) — legacy equipment was always individually tracked; anything that's genuinely fungible/countable is a new option, not a requirement.

## 5. General migration rules

1. **Never map a legacy `{ id, type: "site"|"warehouse" }` pair directly onto a v2 request.** Resolve it to an inventory node id first via `GET /api/inventories?siteId=`/`?warehouseId=`. Every v2 movement/balance/equipment field that used to be two legacy columns (`fromSiteId`+`fromWarehouseId`) is now one (`sourceInventoryId`).
2. **Stop editing state, start logging movements.** If old code ever did `PATCH` a status/location/value field to fix a mistake, the v2 equivalent is: find the movement that caused it, reverse it, log the correct one. Direct field edits on `IndividualEquipmentItem`/`InventoryBalance` don't exist as an API surface at all (only the catalog/master-data records — `InventoryItem`, `Site`, `Warehouse`, etc. — support direct PATCH).
3. **Check whether a legacy action assumed a specific location type, and whether v2 now enforces it structurally.** Materials' sale-must-be-warehouse was already true in legacy's schema; equipment's is brand new in v2 (§2.6) — audit any code that sold equipment from a site.
4. **Re-derive RBAC checks from the resource table in §2.5**, not from the legacy route-group role tiers — a permission that was "admin-only" in legacy may now be reachable by a site_manager under a differently-named resource (equipment movements via `inventory`), and vice versa (task `review`/completion stayed hard admin-only despite `progress_log`'s generic site_manager grants).
5. **Don't assume a `movementType`/`action` name means the same postcondition it did in legacy** — cross-check against `v2-route-details.md`'s payload tables, especially for equipment (`transferred` splitting three ways, `degraded`/`appreciated` collapsing into a subtract-only `degrade`).
6. **If you need a client-provided `isReversal` flag on creation, that pattern is gone.** Every reversal now goes through a dedicated `.../reverse` endpoint against the record being undone, which resolves and links the original correctly instead of trusting the client's claim.
7. **When in doubt about a specific route's exact current payload/RBAC/side-effects, treat `v2-route-details.md` as authoritative** — it was written directly from the current route/service/schema code, not from memory of the legacy shape.
8. **The `InventoryItem` unification (§2.1) is a backend/data-model decision — do not let it collapse the frontend.** Materials and Equipment must stay separate, clearly labeled sections/flows for the user (separate nav, lists, and create forms), same as legacy. Use `category` (and `tracking`, for equipment) purely as internal routing — which screen to render, which movement endpoint to call — never as a reason to merge them into one generic "inventory" UI.

## 6. Known gaps (not carried over, no current v2 equivalent)

- Balance **adjustment** as a first-class action (§3.1) — replaced by reverse-and-relog, or `loss` for genuine shrinkage.
- Equipment **appreciation** posting to the ledger (§3.2) — `degrade` is subtract-only; a value increase is a plain, trail-less `PATCH`.
- Equipment **"used up"** and **"missing"** as individually-tracked concepts (§3.2) — no direct equivalents; nearest mappings are `consume` (if actually bulk-tracked) and `dispose`, respectively.
- A direct individual-equipment **warehouse-to-warehouse transfer** movement type (§3.2) — the three-way `transferred` split doesn't have a slot for it.
- `/api/auth/[...all]` was missing for a period during this migration and has since been added back — confirm your environment has it if you're working from an older checkout.
