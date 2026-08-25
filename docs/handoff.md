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

A contractor operations console, not a generic ERP. The UI talks to a typed in-memory store shaped like the routes in `docs/api.md`, so a real `/api/*` can replace it later without rewriting screens.

---

## Domain (do not weaken)

Code: `lib/store.ts`. Types: `lib/types.ts`. Seed: `lib/seed.ts`. Persist: `localStorage` key `zbe-ops-store`. Hydrate in `AppShell`. Sidebar **Reset demo data** calls `resetStore()`.

**Approvals vs ledger**

- Stock and plant movements **queue**. `submitApproval` → pending → **Approve and post** runs `applyApproval` (balances, equipment status, auto money lines). Reject does nothing to stock.
- Manual income/expense **posts immediately** (`logManualTx`). They do not wait in Approvals.

**Demo users** (top-bar switcher)

| User | Role | Sees |
|---|---|---|
| Abebe Tadesse | `operations` | Everything |
| Hana Bekele | `site_manager` | Westin only |
| Dawit Mekonnen | `site_manager` | EBC only |

Hard rules in the store:

- Site managers only see assigned sites (and ledger lines with those `siteId`s).
- Site managers cannot withdraw from warehouses (`fromKind === "warehouse"` throws).
- Sales only from warehouses (`material_sale` requires `fromKind === "warehouse"`).
- Warehouses are not site-scoped.
- Licenses are the money tree (header filter).
- Do not PATCH equipment `siteId` / `warehouseId` / `value` / `rentRate` — those go through log actions.

**Seed world:** Westin Addis Ababa, EBC studio block, East Industrial Park — line 4. Yards: Bole central yard, Kaliti store. Licenses: Electrical contracting, ICT infrastructure. If demos look wrong, localStorage is dirty — reset.

When adding a feature: match `docs/api.md` first, then the store, then the screen.

---

## What the UI covers

Board, Approvals (list + decide), Sites (budget, tasks claim/complete, on-site stock/plant, lifecycle), Materials (catalog + raise movement), Inventory, Equipment (list + raise event), Yards, Tenders (read), Licenses (read), Ledger (totals + manual post).

Mobile: hamburger drawer below `lg`, stacked forms, tables hide extra columns / swipe in `.table-wrap`.

---

## Not built (API has it)

- Real auth / login
- Postgres or any `/api/*` server
- Catalog create/edit/delete, sub-item CRUD
- Equipment create; not every plant route has a first-class screen
- Reversal of logs or transactions
- Tender / license / warehouse CRUD
- Site create/edit, lifecycle logging UI
- Analytics routes
- Pagination matching ListParams

---

## Files

```
app/                     routes (client pages on the store)
components/AppShell.tsx  drawer, license/user switch, hydrate
components/ui.tsx        PageHead, Stamp, TableWrap, statusTone
components/LocationSelect.tsx
lib/store.ts
lib/seed.ts
lib/types.ts
lib/format.ts            etb / qty / day / stamp
docs/api.md
docs/handoff.md
docs/design-guide.md
```

---

## Conventions

- TypeScript strict, no `any`
- No new dependencies without asking
- No `console.log`
- Never hardcode hex — tokens (`bg-yellow` is copper; `--yellow` is the accent name)
- Verify in the browser at desktop **and** ~390px. A screenshot is not a test.

Suggested later work (confirm with the project owner first): real API, auth (not Clerk for team/org), reversals, catalog CRUD, analytics.
