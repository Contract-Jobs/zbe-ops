# ZBE Ops

Internal yard / site / ledger desk for [ZBE Power Engineering](https://zbepowereng.com). Built against the contractor API in `docs/api.md`.

This first cut is a working operations console with a typed in-memory store that follows those routes: approvals gate stock and plant movements; manual ledger lines post immediately; site managers only see their jobs and cannot pull from warehouses.

## Run it

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3001](http://localhost:3001).

## What you can do

- **Board** — pending approvals, spend vs site budgets, plant on loan
- **Approvals** — approve/reject; posting actually moves stock, changes plant status, and writes money lines
- **Sites** — budget, tasks (claim / complete), materials on site, lifecycle
- **Materials** — catalog, balances, purchase / transfer / sell / consume / missing (queued)
- **Inventory** — quantities by yard and site
- **Equipment** — transfer, hire in/out, maintenance, sale, missing
- **Yards, tenders, licenses, ledger**

Switch user in the top bar: Abebe is central ops, Hana is Westin site manager, Dawit is EBC.

## Not this yet

No login, no Postgres, no real `/api/*` server. The store in `lib/store.ts` is shaped so those routes can replace it later (same payloads and constraints).
