# ZBE Ops

Internal yard / site / ledger desk for [ZBE Power Engineering](https://zbepowereng.com). Built against the contractor API in `docs/api.md`.

Agent next: [`docs/handoff.md`](docs/handoff.md) · visual language: [`docs/design-guide.md`](docs/design-guide.md).

This first cut is a working operations console with a typed in-memory store that follows those routes: approvals gate stock and plant movements; manual ledger lines post immediately; site managers only see their jobs and cannot pull from warehouses.

## Run it

### 1. Start the Backend & Database

Ensure PostgreSQL is running and start the backend from `zbe-and-vanguard`:

```bash
# In zbe-and-vanguard directory
docker compose up -d
pnpm dev -p 3333
```

### 2. Start the Ops Frontend

```bash
# In zbe-ops directory
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000). The frontend automatically proxies API calls to `http://localhost:3333` (configured via `NEXT_PUBLIC_API_URL`).

## What you can do

- **Board** — pending approvals, spend vs site budgets, plant on loan
- **Approvals** — live queue with approve/reject mutations; posting updates actual stock & asset records
- **Sites** — detail views, budget health, task lifecycle (create/claim/complete/delete)
- **Materials** — catalog, subitems, movement actions (purchase/transfer/sell/consume/report missing)
- **Inventory** — real-time quantities and balances by warehouse and site
- **Equipment** — fleet events, maintenance dispatch/return, appreciate/degrade, buy/sell
- **Ledger** — dynamic category spend totals, manual financial entry creation, and category management

## Backend Integration

The frontend screens and forms are fully wired with **TanStack React Query hooks** (`hooks/`) connecting to the typed API client (`lib/api/client.ts`). All routes connect to the PostgreSQL backend in `zbe-and-vanguard`.
