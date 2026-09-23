# Frontend Migration Plan: Legacy API client → v2 API

Scope: this repo's data layer (`types/api.ts`, `lib/api/*`, `hooks/*`) and the pages/forms built on it (`app/*`, `components/forms/*`). It does not touch any server — `app/api` isn't in this repo; the frontend talks to `NEXT_PUBLIC_API_URL` (`lib/api/client.ts`).

**Finding**: despite `docs/handoff.md` describing screens as reading `lib/store.ts`, the data layer is already wired to a real backend via `apiClient` — but every route/payload/type in `lib/api/*` and `types/api.ts` is shaped for the **retired** system (`docs/api.md`), not the current one (`docs/new_api.md`). A few modules were already moved onto v2-shaped routes in recent commits (rentals, warehouse sold-items, site tasks) — see Phase 0. Everything else — materials, equipment, inventory balances/nodes, and several type-level details even in the "already moved" modules — is still legacy. `lib/store.ts` (738 lines) is still imported in 27 files, partly as legacy domain-data fallback (`?? store.materials`) and partly as session/RBAC scaffolding (`isSiteManager`, current user/license switcher) — real auth (`lib/auth/client.ts`, Better Auth) is already live, so this can retire alongside the rest rather than waiting on anything (§7).

Two corrections to the source docs, confirmed against this codebase and called out inline where relevant: `new_api.md` §10 is wrong that `/api/auth/[...all]` is missing — it's live and already wired into `AppShell`/`auth-provider.tsx`/`app/users/page.tsx`. And individual-equipment warehouse→warehouse transfer is not a gap — it's supported via a `transfer_between_warehouses` movement type.

Read `docs/migration.md` §2 before touching any module below — most of the diffs here are one of its seven conceptual shifts.

---

## 1. Current-state audit

| Module | File(s) | Routes called today | v2 reality | Verdict |
|---|---|---|---|---|
| Materials catalog | `lib/api/materials.ts` | `/api/materials*`, `/api/materials/[id]/sub-items` | `/api/inventory-items?category=material`, `/api/inventory-items/[id]/subitems` | **Legacy — full rewrite** |
| Material movements | `lib/api/materials.ts` (log fns), `types/api.ts` `MaterialLogAction` | `/api/inventory/logs*` (action-discriminated) | `/api/inventory-movements*` (movementType-discriminated) | **Legacy — full rewrite** |
| Material trace | `materials.ts`/`inventory.ts` `traceMaterialHistory` | `/api/inventory/trace/[catalogId]` | `/api/inventory-items/[id]/trace` | **Legacy — rename + reshape** |
| Equipment catalog | `lib/api/equipment.ts` | `POST /api/equipment` (direct create) | Disabled in v2 — equipment can only originate from a `purchase` movement or `rent_in` | **Legacy — remove direct create** |
| Equipment logs/movements | `equipment.ts`, `types/api.ts` `EquipmentLogAction` | `/api/equipment/logs*` | `/api/equipment-movements*` (`transferred` splits 3 ways — see §3) | **Legacy — full rewrite** |
| Inventory nodes/balances | `lib/api/inventory.ts` | `/api/inventory`, `/api/inventory/[id]/materials`, `/api/inventory/[id]/equipments`, `/api/inventory/balances`, `/api/inventory/balances/[id]/adjust` | `/api/inventories`, `/api/inventory-balances?inventoryId=&itemCategory=`, `/api/equipment?inventoryId=`, **adjust has no v2 equivalent** | **Legacy — full rewrite + UX gap** |
| Rentals | `lib/api/rentals.ts` | `/api/rentals`, `/[id]/events`, `/[id]/adjust`, `/[id]/return` | Same route shapes | **Routes match** — payload/type fields (`RentalCreatePayload`, `RentalAgreement`) still need a pass (§4) |
| Sites & tasks | `lib/api/sites.ts`, `lib/api/tasks.ts` | `/api/sites*`, `/api/sites/[id]/tasks*`, `/api/tasks*` | Same route shapes | **Routes match** — missing `otherBudget`, `Site.materialSpent`/`laborSpent` don't exist server-side (§4) |
| Warehouses | `lib/api/warehouses.ts` | `/api/warehouses*`, `/sold-items*` | Same route shapes | **Routes match** — response types still reference `EquipmentLog`/`MaterialLog` (§4) |
| Tenders / Licenses / Categories | `tenders.ts`, `licenses.ts`, `categories.ts` via `simple-crud.ts` | Plain CRUD | Same | **Fine as-is** |
| Transactions | `lib/api/transactions.ts` | `/api/transactions*` | Same routes | Payload still carries `isReversal`/`reversalOfId` on **create**, which v2's create schema doesn't accept (§4) |
| Ledgers | `lib/api/ledgers.ts` | `/api/ledgers` only | v2 adds `/api/ledgers/cost-breakdown`, `/[siteId]/rebuild`, `/[siteId]/verify` | **Missing endpoints** |
| Approvals | `lib/api/approvals.ts` | `/api/approvals*` | Same routes | `ApprovalType` union still has `"material_movement"` instead of `"inventory_movement"` (§4) |
| Analytics | `lib/api/analytics.ts` | includes `/api/analytics/cost-breakdown` | Cost breakdown actually lives at `/api/ledgers/cost-breakdown` (§7 of `new_api.md`); `/api/analytics/company` (new) has no client fn at all | **Wrong route + missing endpoint** |

Forms/pages built directly on the legacy shapes (`grep` for `fromSiteId|toWarehouseId|ownershipStatus|currentStatus|materialId|approvalStatus|logType|material_movement`):
`app/{approvals/[id],equipment,equipment/[id],inventory/[id],materials,materials/[id],page,sites/[id],transactions,warehouses/[id],warehouses/[id]/sold-items}.tsx`, `components/forms/{material-movement,material,rental}.tsx`, `hooks/use-{approvals,equipment,inventory,materials,rentals,transactions}.ts`, `lib/store.ts`.

---

## 2. Foundational rewrite: `types/api.ts`

Everything downstream depends on this file, so it's the first real migration step (after Phase 0 cleanup). Per `docs/new_api.md` §"Base Data Models":

- Delete `MaterialCatalog`, `MaterialSubitem`, `MaterialLog`, `Equipment`, `EquipmentLog`, `MaterialLogAction`, `EquipmentLogAction`, `InventoryBalanceAdjustPayload`, `InventoryLocationSummary`.
- Add `InventoryItem`, `InventoryItemSubitem`, `Inventory` (the node), `InventoryBalance` (reshaped: `itemId`/`inventoryId`, not `materialId`/`siteId`/`warehouseId`), `InventoryMovement` (discriminated by `movementType`), `IndividualEquipmentItem` (four-dimension state: `assignmentStatus`/`lifecycleStatus`/`condition`/`currentInventoryId`, replacing `currentStatus`/`ownershipStatus`/`siteId`/`warehouseId`), `IndividualEquipmentMovement`.
- Fix in place (routes already match, types don't):
  - `Transaction`: `materialId` → `itemId`; add `isApproved`, `isSystemGenerated`, `ledgerId`; create payload loses `isReversal`/`reversalOfId` (§4.4).
  - `ApprovalType`: `"material_movement"` → `"inventory_movement"`.
  - `Site`: add `otherBudget`; `materialSpent`/`laborSpent` aren't real API fields — these come from `/sites/[id]/summary`'s `budget` object, not the `Site` record itself.
  - `RentalAgreement`: add `warehouseId`, `returnSiteId`, `returnWarehouseId`.
  - `ProjectLedger`: `sourceRefType` is `"transaction" | "material" | "equipment"`, not free-form string.
- New response/request types needed: `SiteSummary.budget` gains `otherBudget`/`otherSpent`/`equipmentSpent`/`equipmentValue`; `CostBreakdown` moves conceptually under ledgers; add `CompanyFinancialSummary` for the new `/analytics/company` endpoint.

Do this as one focused PR — it will not compile cleanly until the modules in §3 are updated in lockstep, so budget for a red build in between (branch, don't ship mid-way).

---

## 3. Module rewrites, in dependency order

### 3.1 Inventory catalog + quantity movements (materials + bulk equipment)
Replaces `lib/api/materials.ts` and the balance/trace parts of `lib/api/inventory.ts`.

- New `lib/api/inventory-items.ts`: CRUD on `/api/inventory-items` (`category`/`tracking` in payload), `/subitems` CRUD, `/trace`.
- New `lib/api/inventory-movements.ts`: `POST /api/inventory-movements` discriminated by `movementType` (`purchase|sale|transfer|consume|loss`), `GET` list, `POST /[id]/reverse`. `loss` requires `metadata.reason` and has no `unitCost` field — don't carry over `MaterialLogAction`'s `action: "missing"` shape.
- New `lib/api/inventory-balances.ts`: `GET /api/inventory-balances?itemId=&inventoryId=&itemCategory=`, `GET /movements`, `GET /verify`, `POST /rebuild` (superadmin-gated in UI, not just server).
- New `lib/api/inventories.ts`: `GET /api/inventories?siteId=|warehouseId=` — this is the node-id resolver every movement call needs first (see §5).
- **Correction/addition to `new_api.md`**: per-location inventory listing is *not* a gap the way the doc's migration table implies — `GET /api/inventories/[id]/materials` and `/equipments` (pre-joined `MaterialAtInventory` rows: `itemId/itemName/itemSlug/unit/quantity/totalValue/averageUnitValue`; equipments splits into `{ individual, bulk }`, each independently paginated) exist and are the right call for a location-detail screen — prefer them over resolving a node id and filtering the generic `/inventory-balances`/`/equipment` lists. `GET /api/sites/[id]/materials|equipments` and `GET /api/warehouses/[id]/materials|equipments` do the same thing scoped directly to a site/warehouse id (resolving the node internally, 404 if none) — use these instead of `useInventoryNodeId` + the node-scoped calls wherever the id at hand is already a site/warehouse id, which is the common case (site/warehouse detail pages). The node-id resolver is still needed for movement *creation* payloads (`destinationInventoryId` etc.) and for `loss`-movement calls, which require a real node id the joined per-location endpoints don't expose.
- **Drop entirely**: `adjustInventoryBalance` / `/api/inventory/balances/[id]/adjust`. No v2 replacement — `docs/migration.md` §3.1 says the fix path is reverse-the-movement-and-relog, or `movementType: "loss"` for real shrinkage. `components/forms/inventory-adjust.tsx` and wherever it's mounted need to become a "find & reverse the movement" flow instead of a single adjust form.
- Keep materials and bulk equipment as **separate UI flows** per `docs/migration.md` §2.1/§5.8 — `category`/`tracking` are routing fields only, not a reason to merge the Materials and Equipment nav/screens.

### 3.2 Individually-tracked equipment + movements
Replaces `lib/api/equipment.ts`.

- New `lib/api/equipment.ts` (rewritten): CRUD on `/api/equipment` **minus create** — `POST /api/equipment` is disabled server-side (unconditional `VALIDATION` throw). Remove `createEquipment`/`CreateEquipmentPayload` entirely; equipment can only originate from `POST /api/equipment-movements` (`movementType: "purchase"`, `autoCreateEquipment`) or a rental's `equipmentId: "new"`.
- New `lib/api/equipment-movements.ts`: `movementType`-discriminated create (`purchase|deploy_to_site|return_to_warehouse|transfer_between_sites|send_to_maintenance|return_from_maintenance|sale|dispose|degrade`), list, `/[id]/reverse`.
- **The `transferred` → 3-way split is the highest-risk single change** (`docs/migration.md` §3.2): legacy's one generic transfer action becomes `deploy_to_site` (warehouse→site), `return_to_warehouse` (site→warehouse), or `transfer_between_sites` (site→site), chosen from the source/destination node **types**, not passed by the client. There is no warehouse→warehouse individual-equipment movement type — flag this to product before building the form (§8).
- `degraded`/`appreciated` collapse into `degrade`, which is **subtract-only** (clamped at zero). Appreciation has no movement equivalent — only a trail-less `PATCH /api/equipment/[id]` with a new `bookValue`. Decide with product whether to keep an "increase value" UI action at all, and if so, label it clearly as not creating a ledger trail.
- `missing` → `dispose` (terminal, no v2 "lost equipment that might come back" state).
- `sourceInventoryId` must never be sent by the client for equipment movements — it's server-derived from the equipment's current location in v2 (a real API contract change, not just a rename).
- **Correction to `new_api.md`/`migration.md`**: warehouse→warehouse individual-equipment transfer is not a gap — it's supported via a `transfer_between_warehouses` movement type. Include it alongside `deploy_to_site`/`return_to_warehouse`/`transfer_between_sites` in `equipment-movements.ts` and the form's action list; drop it from the "known gaps" list in §8.
- **UI label**: `movementType` values are internal wire names — never render them raw. `transfer_between_sites` shows to users as **"Send to other site"**, `transfer_between_warehouses` as **"Send to other warehouse"** (no underscores, sentence case). Apply the same treatment to every other `movementType`/action label surfaced in `EquipmentMovementForm`/`MaterialMovementForm` and anywhere movement history is displayed (trace views, ledger/approval rows) — a small label map keyed by `movementType`, not a generic humanize-the-enum helper, so copy stays deliberate per `docs/design-guide.md`'s "Short. Field language." rule.

### 3.3 Rentals (light touch)
Routes already match. Update `RentalCreatePayload`/`RentalAdjustPayload`/`RentalReturnPayload`/`RentalAgreement`/`RentalEvent` in `types/api.ts` per `new_api.md` §4 — notably `warehouseId` as an alternative to `siteId`, and `returnSiteId`/`returnWarehouseId` on return. No endpoint-shape work needed in `lib/api/rentals.ts` itself.

### 3.4 Sites & tasks (light touch)
Routes already match nearly 1:1. Add `otherBudget` to `CreateSitePayload`/`UpdateSitePayload`/`Site`. Stop assuming `Site.materialSpent`/`laborSpent` exist on the record — pull spend figures from `getSiteSummary`'s `budget` object instead, which also now has `otherBudget`/`otherSpent`/`equipmentSpent`/`equipmentValue`. No RBAC change needed here (`update:site` still gates task CRUD; `review`/complete stayed hard admin-only in both systems).

### 3.5 Master data (tenders, licenses, warehouses, categories)
No route or RBAC changes. Only fix response typing in `warehouses.ts`: `getWarehouseSoldEquipment`/`getWarehouseSoldMaterials` return `EquipmentLog`/`MaterialLog & {...}` — retype as `IndividualEquipmentMovement & { equipment }` / `InventoryMovement & { item }` once §2 lands.

### 3.6 Transactions & ledger
- `transactions.ts`: drop `isReversal`/`reversalOfId` from `CreateTransactionPayload` — v2's create schema has no such fields (`docs/migration.md` §3.6); a reversal only ever comes from `POST /[id]/reverse`. If any UI path was constructing a "reversal" transaction by hand at creation, replace it with a real reverse call against the original's id.
- `ledgers.ts`: add `getCostBreakdown` (`GET /api/ledgers/cost-breakdown?siteId=&dateFrom=&dateTo=` — **not** under `/api/analytics/`, see §3.7), `rebuildSiteLedger` (`POST /[siteId]/rebuild`, admin/superadmin), `verifySiteLedger` (`GET /[siteId]/verify`).
- Default `GET /api/ledgers` view now hides a fully-cancelled reversal **pair**, not just the correction half — any client-side "sum the visible rows" logic is already safe to keep as-is post-migration, just confirm nothing was compensating for the old half-hidden behavior.

### 3.7 Approvals
Routes match. Fix `ApprovalType` (§2). No RBAC/site-manager-fallback logic needs to change in the client — it's server-enforced — but any UI that special-cases which approval types a site_manager can resolve should key off the 5-value v2 enum, including the fact that a **warehouse-anchored** movement has no site-manager fallback at all (admin/superadmin only).

### 3.8 Analytics
- Fix `getCostBreakdown` — move it out of `analytics.ts` into `ledgers.ts` and call `/api/ledgers/cost-breakdown` (the current `/api/analytics/cost-breakdown` call in `lib/api/analytics.ts` line 50 hits a route that doesn't exist in v2).
- Add `getCompanyFinancials()` → `GET /api/analytics/company` (admin/superadmin only; new — no legacy equivalent, whole-company income/expense split by site-attributed vs. warehouse-anchored vs. corporate).
- `SpendAnalytics`/`InventoryAnalytics`/`BudgetHealthEntry`/`BudgetOverview` types need reshaping to match `new_api.md` §9 field-for-field (e.g. `SpendAnalytics.totalEquipmentValue` → `equipmentValue` + new `equipmentLoss`; `InventoryAnalytics` gains material/equipment split fields).

---

## 4. `hooks/*` — mechanical follow-on

Once `lib/api/*` is rewritten, hooks are a mechanical pass (query keys, function names, return types) but every mutation hook whose name encodes a legacy action needs renaming to match its new `movementType`, since forms call these by name:

- `hooks/use-materials.ts`: `usePurchaseMaterial/useTransferMaterial/useSellMaterial/useConsumeMaterial/useReportMissingMaterial` → rename to movement-based equivalents (`usePurchaseInventoryItem`, `useTransferInventoryItem`, `useSellInventoryItem`, `useConsumeInventoryItem`, `useLogLoss`), split across new `hooks/use-inventory-items.ts` + `hooks/use-inventory-movements.ts`.
- `hooks/use-equipment.ts`: drop `useCreateEquipment`; `usePurchaseEquipment/useTransferEquipment/useSellEquipment/useConsumeEquipment/useReportMissingEquipment/useMaintenanceDispatch/useMaintenanceReturn/useDegradeEquipment/useAppreciateEquipment` → rename/restructure per the 3-way transfer split in §3.2 (this alone likely becomes 3 hooks instead of 1: `useDeployToSite`, `useReturnToWarehouse`, `useTransferBetweenSites`).
- `hooks/use-inventory.ts` → split into `hooks/use-inventories.ts` (node lookup) + `hooks/use-inventory-balances.ts`; drop `useAdjustInventoryBalance`.
- `hooks/use-transactions.ts`, `hooks/use-approvals.ts`, `hooks/use-ledgers.ts` (new), `hooks/use-analytics.ts`: field/type follow-through only, no route changes.

---

## 5. New client-side pattern: node-id resolution

`docs/migration.md` §2.3 / §5.1: any place the legacy payload took `{ id, type: "site"|"warehouse" }` now needs an **inventory node id**, resolved via `GET /api/inventories?siteId=` / `?warehouseId=` first — a site's/warehouse's own `id` is not its node id. `components/LocationSelect.tsx` is the obvious place to centralize this (resolve node id once a site/warehouse is picked, rather than resolving ad hoc in every form/hook). Audit every call site that currently threads `LocationRef` (`{id, type}`) straight into a legacy payload — that pattern must not be ported forward as-is.

Going the *other* direction — given a node id, get that node's own info — used to have no route at all (only the list, filtered by `siteId`/`warehouseId`, never by the node's own id). `GET /api/inventories/[id]` now exists; see §10.

---

## 6. Forms/pages impacted

Given §1's grep, the following need rework once their underlying hooks change (not just a type patch):

- `components/forms/material-movement.tsx`, `components/forms/equipment-movement.tsx` — rebuild around `movementType` action lists (equipment's list goes from 9 flat actions to the v2 set, with the transfer 3-way split as a UX decision: auto-detect from location type, or three separate buttons).
- `components/forms/inventory-adjust.tsx` — replace with "find movement → reverse" flow (§3.1); has no direct v2 equivalent as a single form.
- `components/forms/rental.tsx`, `components/forms/transaction.tsx` — field-level touch-ups only (§3.3, §3.6).
- `app/materials/*`, `app/equipment/*`, `app/inventory/*`, `app/inventory/[id]/*` — rewired to the new hooks; keep Materials and Equipment as visually separate sections (§3.1) even though both now read from `/api/inventory-items` under the hood.
- `app/warehouses/[id]/sold-items/page.tsx`, `app/transactions/page.tsx`, `app/approvals/[id]/page.tsx`, `app/sites/[id]/page.tsx`, `app/page.tsx` (dashboard) — type-level follow-through from §2/§3.

---

## 7. `lib/store.ts` — don't conflate with this migration

`lib/store.ts` is imported in 27 files for two different reasons:
1. **Legacy domain-data fallback** (`data ?? store.materials`, seeded fixtures) — this should shrink to nothing as §3 lands, since every list/detail view will have real API data.
2. **Session/RBAC scaffolding** (`isSiteManager(store)`, the demo user/license switcher in `AppShell`) — historically a stand-in, but **not actually blocked**: `lib/auth/client.ts` (Better Auth) is already live and wired into `AppShell`, `components/auth-provider.tsx`, `components/ui.tsx`, and `app/users/page.tsx` via `useSession`, and `hooks/use-users.ts`/`use-user.ts` already call `authClient.admin.*` for real user/role data.

**Correction to `new_api.md` §10**: that section's claim that `/api/auth/[...all]` is missing is wrong for this environment — auth is live. Don't let that stale doc note block store retirement.

So retire `isSiteManager(store)`/the demo user switcher in the same pass as their last domain-data caller, not as a separately-gated phase — replace with `useSession()` + the role it returns. Keep `NEXT_PUBLIC_USE_DEMO` fallbacks (already used in `hooks/use-users.ts`) only where they exist today; don't expand demo-mode surface area as part of this migration.

---

## 8. Known capability gaps to flag to product before building forms

Carried from `docs/migration.md` §6 — these aren't migration bugs, they're real behavior changes in v2 that affect what the UI can offer:

- No balance/equipment "adjustment" action — only reverse-and-relog, or `loss` (materials/bulk equipment only).
- No ledger-visible equipment appreciation — value increases don't create a financial trail.
- No individually-tracked equipment "used up" or "missing-but-maybe-back" state — only `dispose` (terminal) or, if actually bulk-tracked, `consume`.
- Selling equipment directly from a site is now a hard `409`/`400` — any "sell" action on an equipment detail page must first check/force a warehouse location.

---

## 9. Phased rollout

**Status (2026-09-23): Phases 1–4 implemented, `pnpm tsc --noEmit` and `pnpm build` both clean.** Remaining known gaps:
- `lib/api/demo-handler.ts` (the `NEXT_PUBLIC_USE_DEMO=true` non-GET simulator) still matches legacy routes/field names (`/api/materials`, `fromSiteId`/`toWarehouseId`, etc.) and was not ported to v2 — it compiles (bodies are untyped `any`) but will silently no-op against the new hooks/routes. Needs its own pass before demo mode is relied on again.
- Phase 5 (`lib/store.ts` fallback/RBAC shrinkage) is only partially done — data-layer `?? store.X` fallbacks were dropped from every page touched in Phases 1–4, but `isSiteManager(store)`/`currentUser(store)`-style role gating throughout the app was left as-is rather than switched to `useSession()`, to keep this pass scoped to the wire-protocol migration. `lib/seed.ts` was fixed only where it broke compilation from the `RentalAgreement`/`RentalEvent`/`Site` type changes.
- The site-manager approval fallback can no longer be pre-checked client-side per-record (§3.7/§7) — `useCanActOnApproval` now gates on type only and lets the server's 403 be the final word; flagged inline in `hooks/use-approvals.ts`.
- Per-location detail tables (`app/inventory/[id]/page.tsx`, `app/sites/[id]/page.tsx`, `app/warehouses/[id]/page.tsx`) now use the pre-joined `.../materials` and `.../equipments` endpoints (§3.1 correction) instead of resolving a node id and filtering the generic balances/equipment lists — no more client-side `itemId → name` lookup maps on those pages. `app/materials/page.tsx`'s per-item total-quantity column now reads `InventoryItem.totalQuantity`/`totalValue` directly off the same list call — no separate balances fetch at all. `app/inventory/page.tsx`'s top-level location list shows real per-row counts (`materialItemCount`/`bulkEquipmentItemCount`/`individualEquipmentCount`) straight off `GET /api/inventories` — see §10, this closed what was originally a real gap (no aggregate endpoint existed) rather than a client-side guess.
- UI has not been manually verified in a running browser against a live v2 backend (none was available in this environment) — only `tsc`/`next build` were used to verify. Confirm the actual screens against `docs/design-guide.md`'s quality bar before shipping.

**Phase 0 (done / in progress, verify only)**: rentals routes, warehouse sold-items routes, site task claim/complete, `loggedBy`→username display fix — already shaped correctly per recent commits (`fix: logged by -> username converter`, `fix: taskCompletion now shows correct value`, `feat: added rental pages...`, `feat: added sales page on warehouses`). Verify these against `new_api.md` payload tables rather than assuming done; §3.3–3.5 above list the remaining field-level gaps even here.

**Phase 1 — foundation**: `types/api.ts` rewrite (§2) + `lib/api/inventories.ts` (node resolver, §5). Nothing user-facing ships; this is the dependency root for everything else.

*As built*: `components/LocationSelect.tsx` was deliberately left alone — it still emits a site's/warehouse's own id, exactly as before. Node-id resolution happens downstream, in whichever form/page actually needs a node id (`hooks/use-inventories.ts`'s `useInventoryNodeId`/`useInventoryNodeMap`), not inside the picker itself — not every `LocationSelect` consumer needs a node id, so baking the resolution into the shared component would have made it do RBAC/data-fetching work most callers don't want. Prefer this over teaching `LocationSelect` about node ids unless a real need for that shows up.

**Phase 2 — inventory catalog & movements**: `lib/api/inventory-items.ts`, `inventory-movements.ts`, `inventory-balances.ts` + `hooks/use-inventory-items.ts`/`use-inventory-movements.ts` + `MaterialMovementForm` rebuild + materials pages. Drop the adjust-balance flow here.

**Phase 3 — individual equipment & movements**: `lib/api/equipment.ts` rewrite + `equipment-movements.ts` + hooks + `EquipmentMovementForm` rebuild (the 3-way transfer split — resolve the UX question with product first, §8). Equipment pages.

**Phase 4 — financial surfaces**: transactions create-payload fix, ledgers new endpoints, approvals type fix, analytics route fix + company-financials addition.

**Phase 5 — cleanup**: shrink `lib/store.ts` usage to zero, including RBAC/session scaffolding — replace `isSiteManager(store)`/the demo user switcher with `useSession()` (§7), delete dead legacy types, re-run the §1 grep to confirm zero hits on `fromSiteId|toWarehouseId|ownershipStatus|currentStatus|approvalStatus|logType|material_movement`.

Each phase should end with `pnpm tsc --noEmit` clean and a manual pass through the affected screens at desktop + ~390px per `docs/design-guide.md`'s quality bar — this migration changes data shapes, not visual language, so no design-guide changes are expected, but every touched screen needs the usual verification.

---

## 10. Round 2 (2026-09-23): backend closed the client-side-trick gaps

Four real endpoint/shape additions landed after Phase 1–4, each fixing something flagged as an "expensive trick" (bulk-fetch-and-resolve client-side) earlier:

- **`GET /api/inventories/[id]`** — single node lookup by its own id, joined with site/warehouse + the same `materialItemCount`/`bulkEquipmentItemCount`/`individualEquipmentCount` the list rows carry. `hooks/use-inventories.ts` gained `useInventoryNode(id)`; `app/inventory/[id]/page.tsx` now uses it instead of `useInventoryNodes({limit:50}).find(...)`. `app/inventory/page.tsx`'s top-level list now shows the three counts directly off `GET /api/inventories` — no aggregation, no extra calls.
- **`RentalAgreement.equipment`** — enriched (`{id, identifier, itemId, itemName, vendorName, condition, assignmentStatus, lifecycleStatus} | null`) on both `GET /api/rentals` and `GET /api/rentals/[id]`, resolved server-side via one batched join per page. `app/rentals/page.tsx` and `app/rentals/[id]/page.tsx` no longer fetch the equipment list (`limit: 1000`, the single worst offender flagged earlier) or a separate catalog-item lookup just to label a rental row — they read `r.equipment` directly. `app/rentals/page.tsx` still fetches a capped equipment list, but only for `RentalForm`'s "pick existing equipment to rent out" selector — a genuinely different need (selection, not label-resolution).
- **`GET /api/rental-events`** — flat listing across every agreement (`agreementId`/`eventType` filters, pagination, sortOrder), same relationship `/api/tasks` has to `/api/sites/[id]/tasks`. Added `lib/api/rentals.ts`'s `listAllRentalEvents` + `hooks/use-rentals.ts`'s `useAllRentalEvents` for parity; no dedicated "all events" screen was built since nothing in the UI needed one yet.
- **`InventoryItem.totalQuantity`/`totalValue`** — sum of an item's balance across every node, computed server-side, included free on `GET /api/inventory-items` rows. `app/materials/page.tsx`'s "Total" column now reads this directly — no separate balances fetch, unlike the version that was stripped out and re-added across the prior two turns.

**New feature: balance movement history + reversal.** `GET /api/inventory-balances/movements?itemId=&inventoryId=` (already wired in `lib/api/inventory-balances.ts`/`hooks/use-inventory-balances.ts`'s `useBalanceMovements`, but never surfaced in the UI) now has a real UI: `components/BalanceHistory.tsx`'s `BalanceHistoryPanel` lists a balance's full movement history (sorted newest-first) and puts a **Reverse** button only on the top-most row, and only when it's a real, non-reversed, non-reversal movement — older rows are display-only by product decision (reversing out of order would misrepresent what happened to the balance in between), not an API restriction. Wired in as a "History" action alongside "Move"/"Report loss" on every materials/bulk-equipment balance row across `app/inventory/[id]/page.tsx`, `app/sites/[id]/page.tsx`, and `app/warehouses/[id]/page.tsx`.

This also surfaced a real gap: **bulk equipment** (`category: "equipment", tracking: "quantity"`) had a full API path (`.../equipments`'s `bulk` field) wired since the original per-location-endpoint pass, but no UI ever read it — `.individual.data` was used, `.bulk.data` was silently discarded. All three location-detail pages now render a "Bulk Equipment" section (same Move/Report-loss/History actions as materials, since bulk equipment shares the same `inventory-movements`/`inventory-balances` tables) alongside "Inventory Balances" and "Parked Equipment".

New shared file: `lib/movement-labels.ts` (`QUANTITY_MOVEMENT_LABELS`, `EQUIPMENT_MOVEMENT_LABELS`) — used by `BalanceHistoryPanel`; the existing per-form label maps in `material-movement.tsx`/`equipment-movement.tsx` were deliberately left alone rather than force-unified, since their copy carries form-specific hints (e.g. "Sell (warehouse only)") that a history table doesn't want.

Verified: `pnpm tsc --noEmit` and `pnpm build` clean after this round; the hard 50-item fetch cap (§9) still holds everywhere except the pre-existing, out-of-scope `hooks/use-users.ts` (Better Auth's `admin.listUsers`, a different system).

---

## 11. Round 3 (2026-09-23): trace split, independently-paginated equipment, bulk-equipment purchase flow

Two more route changes landed and were wired in — this round overlapped with concurrent hand-edits to several of the same files (`sites/[id]`, `warehouses/[id]`, `material-movement.tsx`, `equipment-movement.tsx`, plus a brand-new `components/forms/bulk-equipment-movement.tsx`); the state below reflects the reconciled result, `tsc`/`build` clean.

- **`GET /api/inventory-items/[id]/trace` split into `.../balances` and `.../history`.** Both now paginate for real (balances: `page`/`limit`, default 10, sorted quantity desc; history: `page`/`limit` default 20, `sortBy`/`sortOrder`/date/reversal filters — the generic `/api/inventory-movements?itemId=` has no `sortBy` at all). `types/api.ts`'s `InventoryItemTraceResponse` → `ItemBalanceRow`/`ItemHistoryRow`; `lib/api/inventory-items.ts`'s `traceInventoryItem` → `getItemBalances`/`getItemHistory`; `hooks/use-inventory-items.ts`'s `useInventoryItemTrace` → `useItemBalances`/`useItemHistory`. `app/materials/[id]/page.tsx` now paginates its "Global Distribution" and "Activity Ledger" tables independently, and reads the item's **Total**/**Total Value** stat tiles off `InventoryItem.totalQuantity`/`.totalValue` (Round 2) instead of summing a page of balances — summing would have silently undercounted for any item stocked at more than one balances-page's worth of locations.
- **`GET /api/inventories|sites|warehouses/[id]/equipments` split into six routes** — individually-tracked at `.../equipment`, bulk (quantity-tracked) at `.../bulk-equipment`, each paginating independently. This fixes the exact limitation called out in Round 2's comments: the old combined endpoint shared one `page`/`limit` across both sub-lists, so neither could be paged on its own (and the query-key/hook comment describing that as a permanent constraint was wrong — it was a v1-of-this-split limitation, not a fundamental one). `queryKeys.inventories/sites/warehouses.equipments()` → `.equipment()`/`.bulkEquipment()`; `lib/api/inventories.ts|sites.ts|warehouses.ts` and their hooks gained matching `getX/useX Individual/BulkEquipment` pairs; the three location-detail pages now hold separate page state (`eqPage`/`bulkEqPage`) per sub-list.
- **New `components/forms/bulk-equipment-movement.tsx`** (`BulkEquipmentMovementForm`) — a `MaterialMovementForm` sibling scoped to `category: "equipment", tracking: "quantity"`, wired as "Purchase Bulk Equipment" on all three location-detail pages (materials/individual-equipment purchase entry points already existed on `sites/[id]`/`warehouses/[id]`; `inventory/[id]` had none of the three before this round and now has all three, for parity).
- **Fixed a real bug in that new form**: its "+ Create new equipment" (auto-create-then-purchase) path was copy-pasted from `MaterialMovementForm` and sent `autoCreateItem: { category: "material" }` — it would have mislabeled a brand-new bulk-equipment catalog item as a material. Checked against `new_api.md`: the generic `/inventory-movements` purchase's `autoCreateItem` is documented as `category: "material"` only (individual equipment's own `autoCreateEquipment.autoCreateItem` is a separate payload that does allow `category: "equipment"`) — so there's no single-call auto-create-and-purchase path for bulk equipment. Fixed by making the "new equipment" branch a real two-step flow: `useCreateInventoryItem({category:"equipment", tracking:"quantity"})` first, then purchase the resulting id — not by trying to force `category: "equipment"` through a payload shape that doesn't support it.
- **Fixed a second bug found while wiring `inventory/[id]`'s missing purchase entry points**: `warehouses/[id]`'s Bulk Equipment table had its `TableWrap` pagination wired to the *individual*-equipment query's `pagination`/`setEquipPage` instead of `bulkEquipData`/`setBulkEquipPage` — the latter state existed but was never actually used anywhere. Changing its page control would have silently refetched the wrong list.

`docs/new_api.md`/`docs/migration.md` were not updated with these two route changes since they're external source docs this plan corrects against, not files this repo owns.

---

## 12. Round 4 (2026-09-23): bulk equipment on the catalog page, and a "built but not surfaced" audit

**Fix**: `app/equipment/page.tsx` only ever listed individually-tracked equipment (`useEquipmentList`, `/api/equipment`) — bulk (quantity-tracked) equipment had a purchase/move/history path everywhere it's location-scoped (Round 3) but no catalog-level view of its own, unlike materials (`/materials` lists the catalog; `/materials/[id]` is the generic cross-location detail page for any quantity-tracked item). Added a "Bulk Equipment" section to `/equipment` sourced from the same `useInventoryItems({category:"equipment"})` call already on the page (filtered client-side to `tracking === "quantity"`, no extra fetch), each row linking to `/materials/[id]` — that page is genuinely itemId-generic (balances/history/purchase all work by id regardless of category) despite the route name — plus a "Purchase Bulk Equipment" entry point via `BulkEquipmentMovementForm`.

**Audit**: grepped every exported hook against `app/`+`components/` usage to find real capabilities with zero UI. Found and fixed:

- **Restore was dead everywhere.** `DeleteConfirm`'s `restore` prop only ever changed the confirmation dialog's *copy* ("can be restored later") — there was no actual Restore button anywhere, despite `useRestoreEquipment`/`useRestoreInventoryItem`/`useRestoreSite`/`useRestoreTender`/`useRestoreLicense`/`useRestoreWarehouse` all existing and working. Added an `onRestore`/`restoreDisabled` pair to `RecordActions` and wired it into all six list pages (materials, equipment, sites, tenders, licenses, warehouses) — a deleted row now shows a real Restore action instead of Edit/Delete. (Categories deliberately excluded — `new_api.md` §7 has no restore route for them, and the existing confirm-dialog copy already says so correctly.)
- **Approve/reject buttons had zero role gating.** `app/approvals/[id]/page.tsx` showed the Approve/Reject buttons to *any* viewer whenever `status === "pending"`, with no check at all — `useCanActOnApproval` existed (built in Round 1, §3.7/§7) but was never called from anywhere. A site_manager visiting their own pending `transaction` approval (never resolvable by a site_manager, admin-only) would see working-looking buttons and only find out via a 403 after clicking. Wired `useCanActOnApproval(item, currentUser(store).role)` in and gated the buttons on `canAct`, with a plain "you don't have permission" message otherwise. (Role still comes from the mock store's `currentUser`, matching how every other page in the app currently gates role-based UI — not from real `useSession()`; that's the broader, separately-tracked Phase 5 gap in §9, not something worth fixing on just this one page.)
- **`app/equipment/[id]` showed movement history with no way to reverse it** — unlike `BalanceHistoryPanel` (materials/bulk equipment), which has had a reverse-the-top-movement action since Round 1. Added the same pattern here using `useReverseEquipmentMovement`: sorted newest-first, Reverse offered only on the top row when it's a real non-reversed, non-reversal movement, plus a Status column and switching the raw `movementType` render to `EQUIPMENT_MOVEMENT_LABELS`.
- **`app/analytics/company` (Company Financial Summary) had a hook (`useCompanyFinancials`, Round 2) and zero UI.** This is the one `new_api.md`/`migration.md` both flag explicitly as having no legacy equivalent — the only place a true company-wide P&L exists, since every other financial analytics endpoint sums `project_ledger`, which structurally only ever has site entries. Built `app/company/page.tsx` (admin/superadmin only, matching the API's own RBAC — gated in both the nav, mirroring the existing `/users` "Team" link pattern, and the page itself), with license/date filters and the full expense (site-attributed × material/labor/equipment/other, plus non-site × warehouse-anchored/corporate) and income (material/equipment sale revenue, other) breakdown.

**Deliberately not built this round** (flagged, not fixed — lower value or clearly bigger scope than a quick pass):
- Cost breakdown UI (`useCostBreakdown`, Round 1) — no page surfaces it; natural fit would be a section on `app/sites/[id]/page.tsx`.
- Ledger/inventory-balance/equipment-state **verify + rebuild** admin recovery tools (`useVerifySiteLedger`/`useRebuildSiteLedger`, `useVerifyInventoryBalance`/`rebuildInventoryBalances`, `verifyEquipmentState`/`rebuildEquipmentStates`) — superadmin-only, rarely-used recovery tools; hooks/API exist for some, not all have hooks yet, no UI for any.
- Flat "browse everything" listings for `useAllRentalEvents`, `useEquipmentMovements`, `useInventoryMovements`, and the flat `useTasks` (`/api/tasks`, currently only reachable site-scoped via `/sites/[id]`) — no dedicated pages.
- `handleEditTask` in `app/sites/[id]/page.tsx` is a known no-op stub (own in-code comment: "no edit mutation yet") despite `useUpdateSiteTask` existing and working.

## 13. Round 5 (2026-09-23): closed every item deferred in Round 4

All four items flagged as "not built this round" in §12 are now built.

- **Task-edit stub fixed.** `handleEditTask` in `app/sites/[id]/page.tsx` now calls `useUpdateSiteTask(id).mutateAsync({taskId, payload: {title, targetDate}})` instead of doing nothing.
- **Cost breakdown UI.** New `components/LedgerTools.tsx` (`LedgerToolsPanel`) combines the site's ledger **Integrity** check (`useVerifySiteLedger` badge, `read:budget` site-scoped so visible to a site_manager on their own site — not admin-gated) with a **Cost breakdown** section (`useCostBreakdown`, date-range filters, per-category `TableWrap` table + total). Wired into `app/sites/[id]/page.tsx` behind a new "Ledger tools" button next to "Add Transaction" in the Financials header, opening a `wide` `ModalPanel`.
- **Verify/rebuild recovery tools — hooks completed, UI added.** Per `new_api.md` §4/§6, cost-breakdown/verify are `read:budget`/`read:inventory`/`read:asset` (broadly readable), but **all three rebuild-all endpoints are superadmin-only** — stricter than Rebuild Ledger, which is admin/superadmin. Added the missing hooks (`useRebuildSiteLedger` already existed; new: `useVerifyEquipmentState`/`useRebuildEquipmentStates` in `hooks/use-equipment.ts`, `useRebuildInventoryBalances` in `hooks/use-inventory-balances.ts` — `useVerifyInventoryBalance` already existed) plus a `queryKeys.equipment.verify(id)` key. UI: `LedgerToolsPanel`'s Rebuild button is gated on `canMutate` (admin/superadmin, matching Rebuild Ledger's looser RBAC); the two superadmin-only rebuilds are gated on `currentUser(store).role === "superadmin"` specifically (not `canMutate`, which also admits plain admins) — a "Rebuild states" button on `/equipment` and a "Rebuild balances" button on `/inventory`, each behind a `ConfirmDialog`. Per-record verify badges were also added where the natural drill-down already exists: `components/BalanceHistory.tsx` (balance consistent/drifted, next to the item name) and `app/equipment/[id]/page.tsx` (state consistent/drifted, in the status-stamp row) — both read-only, no mutation.
- **Flat "browse everything" listings — all four built**, all read-only (reversal stays a drill-down-only action on the existing per-record/per-balance history views, not duplicated here), all server-paginated at `limit: 10` via each list hook's own `page`/`limit`:
  - `app/rentals/events/page.tsx` (`useAllRentalEvents`) — event-type filter; agreement column labeled via a capped `useRentals({limit: 50})` pull (agreements don't enrich past 50, same accepted tradeoff as every other "pull the whole catalog for a name map" spot in this app) linking to `/rentals/[agreementId]`. Linked from a new "All events" button on `/rentals`.
  - `app/equipment/movements/page.tsx` (`useEquipmentMovements`) — movement-type filter, from/to via `useInventoryNodeMap`, identifier via a capped `useEquipmentList({limit: 50})` pull, links to `/equipment/[id]`. Linked from a new "All movements" button on `/equipment`.
  - `app/materials/movements/page.tsx` (`useInventoryMovements`) — covers both materials and bulk equipment (this endpoint carries both categories); item name/unit via a capped `useInventoryItems({limit: 50})` pull, links to `/materials/[id]`. Linked from a new "All movements" button on `/materials`.
  - `app/tasks/page.tsx` (`useTasks`) — site and status filters, site name via `useSites({limit: 50})`, links to `/sites/[siteId]` (editing/completion stays there, this is browse-only). Added to the main nav in `components/AppShell.tsx` as "Tasks", visible to every role (`read:site` auto-scopes site_managers to their own sites server-side, same as the API already does for `/api/tasks`).

No route collisions from adding static sibling segments next to existing dynamic ones (`/equipment/movements` next to `/equipment/[id]`, `/materials/movements` next to `/materials/[id]`, `/rentals/events` next to `/rentals/[id]`) — Next.js resolves the static segment first; confirmed via a clean `pnpm build` listing all of them as separate routes.

`pnpm tsc --noEmit` and `pnpm build` both clean after this round.

## 14. Round 6 (2026-09-23): tabbed the three crowded detail pages

**Fix**: `app/sites/[id]`, `app/warehouses/[id]`, and `app/inventory/[id]` each stacked 3-4 full tables (materials, bulk equipment, individual equipment, and on the site page, tasks) vertically on one page — every table and its "Purchase X" action visible at once regardless of which one the viewer actually came for. Added a `Tabs` component to `components/ui.tsx` (a plain local-state, one-section-visible-at-a-time switch — not a navigation control, no URL sync) styled to match the existing design language: sharp corners, `--yellow` bottom-border for the active tab (same accent used for active-nav fill), a mono count badge sourced from each table's own `pagination.total` where server-paginated.

Applied it identically across all three pages — same tab set (`Materials` | `Bulk Equipment` | `Equipment`, plus `Tasks` on the site page), same rule for what stays above the tab bar vs. inside a tab panel: page header, subtitle/location line, and any page-level summary grid (site budget tiles, warehouse inventory-value tiles) stay above and always visible; each table keeps its own header row (kicker + "Purchase X" button), loading/empty states, and `TableWrap` exactly as before, just shown one at a time. No hooks, query params, mutations, or modals changed — this is purely a visibility/layout change, so every existing "Move"/"Report loss"/"History" action and modal still works unmodified inside its tab.

`pnpm tsc --noEmit` and `pnpm build` both clean after this round.

## 15. Round 7 (2026-09-23): Transactions tab on the site page

Added a fifth tab to `app/sites/[id]/page.tsx` — `Transactions`, listing this site's transactions via `useTransactions({siteId: [id], ...})`. Added the missing `isSystemGenerated?: string[]` filter to `TransactionListParams` (`lib/api/transactions.ts`) — not in `new_api.md`'s "typical filters" list for `GET /api/transactions` but the field exists on `Transaction` itself and `ListParams` passes through arbitrary filters, so this follows the same string-array-boolean pattern as `includeZeroQuantity`/`isReversal`/`includeReversed` elsewhere in the app. Defaults to `["false"]` — system-generated entries (the automatic ledger side-effect of a purchase/sale movement, not something a person logged) are hidden unless a "Show system-generated" checkbox is ticked, same hidden-by-default convention as zero balances. Reverse is offered per the API doc's own constraint (`/api/transactions/[id]/reverse` "only reverses manual, non-system-generated transactions"): gated on `!isSystemGenerated && !isReversal && equipmentId === null && itemId === null`, reusing `useReverseTransaction` — same confirm-dialog pattern as `app/transactions/page.tsx`.

Verified: `pnpm tsc --noEmit` and `pnpm build` clean; 50-item cap and zero-balance-hidden-by-default both still hold.

## 16. Round 8 (2026-09-23): explicitly scoped the equipment-movement form to individual equipment

`components/forms/equipment-movement.tsx` was already functionally individual-only (drives `/equipment-movements` by `individualItemId`, sources its equipment list from `useEquipmentList`/`/api/equipment`, and already filtered its "new catalog item" picker to `tracking: "individual"`) but read as generic "Equipment" everywhere in its own copy, with nothing distinguishing it from `BulkEquipmentMovementForm` (quantity-tracked equipment via `/inventory-movements`) to someone just reading the form. Added a scoping doc-comment on the props interface plus tightened in-form copy — picker label "Equipment" → "Individual equipment", placeholder/create-new label likewise, catalog-item picker label → "Individual equipment catalog item" — so the form is self-explanatory about its scope wherever it's embedded, without touching its props, hooks, or any call site. No functional change.

`pnpm tsc --noEmit` and `pnpm build` both clean after this round.

## 17. Round 9 (2026-09-23): show affectedFields in the site lifecycle log

`SiteLifecycleLog.affectedFields` (`types/api.ts`, `jsonb | null` per `new_api.md` §5 — "logs a lifecycle event with a JSON diff of the request" on Update Site) already existed in the type but was never read: the Lifecycle Logs modal on `app/sites/[id]/page.tsx` only ever rendered `description`/`timestamp`/`loggedBy`. Added a `formatFieldValue` helper and a per-field list under each log entry's description — handles both a plain `{field: newValue}` snapshot and a `{field: {from, to}}` diff (the backend doc doesn't pin which shape `affectedFields` actually takes, so this renders either without assuming one). Read via the same defensive `as unknown as {...}` cast already used for `note`/`description`/`loggedBy` on this line, since `logs` is a union of the real API's `SiteLifecycleLog` and the legacy mock store's differently-shaped type (`lib/types.ts`).

`pnpm tsc --noEmit` and `pnpm build` both clean after this round.

## 18. Round 10 (2026-09-23): full invalidation audit — one systemic bug, five real gaps

Audited every `useMutation` across all `hooks/use-*.ts` plus `lib/query/approval-invalidation.ts` against what each one actually changes server-side. Found one **systemic bug** and five standalone gaps; fixed all six.

**Systemic bug — `undefined` params never match a real query key.** `queryKeys.sites.tasks(id, params?)` and `.lifecycle(id, params?)` both bake `params` into a fixed-length array (`["sites","detail",id,"tasks",params]`). Calling the factory with only `id` (as several invalidation call sites did, intending "invalidate every params variant") leaves that last slot as an explicit `undefined` — a real array element, not an omitted one. TanStack Query's `partialMatchKey` requires same-length keys to structurally match element-for-element, and `typeof undefined !== typeof {}`, so `undefined` never matches a real params object, **even an empty `{}`**. Verified empirically against the installed `@tanstack/query-core` (`partialMatchKey(['sites','detail','s1','tasks',{page:1,limit:50}], ['sites','detail','s1','tasks',undefined])` → `false`). Net effect: `useCreateSiteTask`/`useUpdateSiteTask`/`useDeleteSiteTask`'s task-list invalidation, and the `progress_log` approval fan-out's task-list invalidation, were silently no-ops — the Tasks tab only ever looked fresh because `useClaimSiteTask`/`useCompleteSiteTask` happened to also fire a *literal* short-array invalidation (`["sites","detail",siteId,"tasks"]`, a true prefix) as a belt-and-suspenders call. Fix: added `queryKeys.sites.tasksAll(id)`/`.lifecycleAll(id)` — genuine short-prefix variants with no trailing params slot — and switched every id-only invalidation call (including the two that already used literal arrays, for consistency) to use them. Worth grepping for this same anti-pattern (`queryKeys.x.y(id)` used for invalidation where `.y` takes a second `params` arg) before adding any new id-scoped-with-params resource.

**Five standalone gaps, all fixed:**
1. **`equipment_movement` fan-out invalidated the wrong id.** `useCreateMovement`/`useReverseEquipmentMovement` (`hooks/use-equipment-movements.ts`) passed `movement.id` (the movement's own id) into `onActionSettled`, which builds `queryKeys.equipment.detail(recordId)` — a cache key nothing ever reads, since `/equipment/[id]` is keyed by the *equipment's* id. Fixed to pass `movement.individualItemId`; `.trace()`/`.verify()` come along for free since they're key-prefixed under `.detail(id)`. This was silently breaking the equipment detail page's own inline movement form on every purchase/transfer/sale/maintenance/dispose/degrade.
2. **`useUpdateSite` never invalidated the lifecycle log**, directly undermining the affectedFields feature from Round 9 — an edit wouldn't show up in its own "See Lifecycle" modal until reload. Fixed (via the new `.lifecycleAll(id)`).
3. **`useReverseTransaction` bypassed `onActionSettled`** entirely (flat `transactions.all`/`ledgers.all` only), unlike `useCreateTransaction`. Missed `approvals.all` (a pending reversal from a site_manager didn't show up in the Approvals queue) and `sites.summary`/analytics (an auto-approved reversal's effect on the site's spend tiles). Fixed to mirror `useCreateTransaction`.
4. **`queryKeys.inventories.list()`/`.detail(id)` — the `/inventory` locations overview's per-node item counts — were never invalidated by anything.** The existing location sweep (`invalidateAllLocationInventoryQueries`) only matches the `.materials()`/`.equipment()`/`.bulkEquipment()` sub-tables, not the plain node keys. Added `invalidateInventoryNodeOverviewQueries` and wired it in alongside the existing sweep.
5. **User mutations never invalidated `useUser(userId)`** (`["user", userId]`, a different top-level key from `queryKeys.users.*`) — `<Username>` (used everywhere a `loggedBy` renders: BalanceHistory, lifecycle logs, transactions, equipment history) kept showing a stale name/state for its 5-minute `staleTime` after any rename/role-change/ban/unban/removal. Added the invalidation to all five affected mutations in `hooks/use-users.ts`.

**Two minor fixes bundled in:** `useRejectApproval` now also invalidates `transactions.all` (rejecting a pending transaction-reversal un-flags the original's `isReversed` server-side, per `new_api.md` §5 — a narrow case the old flat comment claiming "nothing downstream changed" missed); `useRebuildInventoryBalances`/`useRebuildSiteLedger` (rare admin recovery tools) now also sweep `inventoryItems`/location tables and analytics respectively, since a full rebuild changes far more than just the one list they used to invalidate.

**Adjacent correctness bug found while re-reading the reversal-eligibility logic these invalidations feed:** neither `app/transactions/page.tsx` nor the Transactions tab added to `app/sites/[id]/page.tsx` in Round 7 checked `!isReversed` (only `!isReversal`) — a transaction that already has a reversal kept showing a working-looking Reverse button that would just 403. The flat Transactions page also never checked `!isSystemGenerated` there either. Fixed both.

`pnpm tsc --noEmit` and `pnpm build` both clean after this round.
