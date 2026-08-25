# Handoff

Read this before changing this repo. Visual language: `docs/design-guide.md`. Domain spec: `docs/api.md`.

This is the **ZBE Ops** desk — yards, jobs, plant, and a ledger, with approvals in the middle. Next.js 16 + React 19 + Tailwind v4. `pnpm` only.

This is not the Next.js in training data — read `node_modules/next/dist/docs/` before using APIs. Cursor Convex / Clerk / Postgres plugin rules do not apply. There is no Convex, no Postgres, no Clerk, no `env.ts` yet.

---

## Run it

```bash
pnpm install
pnpm dev
```

[http://localhost:3001](http://localhost:3001) — port is set in `package.json`.

Remote: `git@github.com:Contract-Jobs/zbe-ops.git`

---

## What this app is

A contractor operations console, not a generic ERP. Screens read a typed in-memory store shaped like `docs/api.md`, so a real `/api/*` + React Query can replace the store later without a visual rewrite.

Two kinds of write in the UI:

1. **Wired** (hits `lib/store.ts`, persists in `localStorage`): queue movements/events, approve/reject, ledger **Post**, task Add / Claim / Complete.
2. **UI-only** (form closes, nothing is saved): create / edit / delete of catalog, plant records, sites, yards, tenders, licenses, categories, set parts, task edit/delete, lifecycle notes. Submit goes through `uiOnly` in `components/forms/ui-only.ts`.

Do not invent a generic CRUD engine. Each record keeps its own form because the API fields differ (equipment create forbids `rentRate`; edit forbids location / value / rent rate).

---

## Domain (do not weaken)

Code: `lib/store.ts`. Types: `lib/types.ts`. Seed: `lib/seed.ts`. Persist: `localStorage` key `zbe-ops-store`. Hydrate in `AppShell`. Sidebar **Reset demo data** calls `resetStore()`.

**Approvals vs ledger**

- Stock and plant movements **queue**. `submitApproval` → pending → **Approve and post** (after confirm) runs `applyApproval` (balances, equipment status, auto money lines). Reject does nothing to stock.
- Manual income/expense **posts immediately** (`logManualTx`). They do not wait in Approvals.

**Demo users** (top-bar switcher)

| User | Role | Sees |
|---|---|---|
| Abebe Tadesse | `operations` | Everything, including New / Edit / Delete |
| Hana Bekele | `site_manager` | Westin only; no master-data create/edit/delete |
| Dawit Mekonnen | `site_manager` | EBC only; same restriction |

Hard rules in the store:

- Site managers only see assigned sites (and ledger lines with those `siteId`s).
- Site managers cannot withdraw from warehouses (`fromKind === "warehouse"` throws).
- Sales only from warehouses (`material_sale` requires `fromKind === "warehouse"`).
- Warehouses are not site-scoped.
- Licenses are the money tree (header filter).
- Do not PATCH equipment `siteId` / `warehouseId` / `value` / `rentRate` — those go through log actions.

**Seed world:** Westin Addis Ababa, EBC studio block, East Industrial Park — line 4. Yards: Bole central yard, Kaliti store. Licenses: Electrical contracting, ICT infrastructure. If demos look wrong, localStorage is dirty — reset.

When adding a feature: match `docs/api.md` first, then the store (if it should persist), then the screen.

---

## Layout of the code

```
app/                     one client page per URL
components/AppShell.tsx  black rail, mobile drawer, hydrate, user/license switch
components/ui.tsx        chrome — PageHead, Stamp, FormPanel, ConfirmDialog, RecordActions
components/forms/        record forms (the fields)
components/LocationSelect.tsx
lib/store.ts             stand-in backend + useStore()
lib/seed.ts              demo data
lib/types.ts             records matching the API
lib/format.ts            etb / qty / day / stamp
docs/api.md
```

**Chrome** means the frame around content (panel, overlay, New/Edit/Delete row) — not the browser. `RecordActions` is that button row. `FormPanel` is the paper create/edit sheet. `ConfirmDialog` is the sharp “Are you sure?” overlay. `RecordMode` / `closedMode` are the open/closed/edit/delete state used on list and detail pages.

**Forms** (do not dump these back into `ui.tsx`):

| File | Forms |
|---|---|
| `forms/material.tsx` | Material, set part |
| `forms/equipment.tsx` | Equipment (create vs edit fields differ) |
| `forms/site.tsx` | Site, task, lifecycle note |
| `forms/master.tsx` | Tender, license, yard, category |
| `forms/ui-only.ts` | `preventDefault` + close; replace with `useMutation` later |

There is no `components/crud.tsx`.

**Routes**

| Path | Screen |
|---|---|
| `/` | Board |
| `/approvals`, `/approvals/[id]` | Queue + decide (confirm, then store) |
| `/sites`, `/sites/[id]` | Jobs, tasks, on-site stock/plant |
| `/materials`, `/materials/[id]` | Catalog + raise movement |
| `/equipment`, `/equipment/[id]` | Plant + raise event |
| `/inventory` | Balances (read) |
| `/warehouses` | Yards |
| `/tenders` | Pipeline |
| `/licenses` | Money tree |
| `/ledger` | Manual post + category UI |

---

## What the UI covers

Board, Approvals (list + decide with confirm), Sites, Materials (catalog + raise movement), Inventory, Equipment (list + raise event, including purchase), Yards, Tenders, Licenses, Ledger.

Mobile: hamburger drawer below `lg`, stacked forms, tables hide extra columns / swipe in `.table-wrap`. No page-level horizontal scroll at ~390px.

---

## Not built (API has it)

- Real auth / login
- Postgres or any `/api/*` server
- Persistence behind the record forms (create / edit / delete / restore) — UI is there, `uiOnly` is the stub
- Reversal of logs or transactions
- Analytics routes
- Pagination matching ListParams

---

## Conventions

- TypeScript strict, no `any`
- No new dependencies without asking
- No `console.log`
- Never hardcode hex — tokens (`bg-yellow` is copper; `--yellow` is the accent name)
- Verify in the browser at desktop **and** ~390px. A screenshot is not a test.

Suggested later work (confirm with the project owner first): React Query on the existing forms (`onSubmit` instead of `uiOnly`), real `/api/*`, auth (not Clerk for team/org), reversals, analytics.
