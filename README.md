# ZBE Ops

Internal yard / site / ledger desk for [ZBE Power Engineering](https://zbepowereng.com). Built against the contractor API in `docs/api.md`.

Agent next: [`docs/handoff.md`](docs/handoff.md) · visual language: [`docs/design-guide.md`](docs/design-guide.md).

This first cut is a working operations console with a typed in-memory store that follows those routes: approvals gate stock and plant movements; manual ledger lines post immediately; site managers only see their jobs and cannot pull from warehouses.

## Run it

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3001](http://localhost:3001).

## What you can do

- **Board** — pending approvals, spend vs site budgets, plant on loan
- **Approvals** — approve/reject with an “Are you sure?” step; posting actually moves stock
- **Sites** — create/edit/delete UI, budget, tasks (claim / complete / edit UI), lifecycle note UI
- **Materials** — catalog create/edit/delete UI, set parts, purchase / transfer / sell / consume / missing (queued)
- **Inventory** — quantities by yard and site
- **Equipment** — create/edit/delete UI; transfer, hire, purchase, maintenance, sale, missing
- **Yards, tenders, licenses** — create / edit / delete UI (not wired)
- **Ledger** — totals + manual post; category create / delete UI

Switch user in the top bar: Abebe is central ops, Hana is Westin site manager, Dawit is EBC.

## Not this yet

No login, no Postgres, no real `/api/*` server. Create/edit/delete screens are present; they close without writing until React Query is wired. The store in `lib/store.ts` is shaped so those routes can replace it later.
