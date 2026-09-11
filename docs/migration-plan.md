# ZBE Ops - React Query Hooks Wiring Plan

This document outlines the roadmap and technical plan to finish wiring all remaining UI screens to the React Query data layer (`hooks/` and `lib/api/`), deprecating the mock store (`lib/store.ts`).

---

## Completed So Far (`ui/wire-screens`)

1. **Master CRUD Forms**:
   - `LicenseForm`, `WarehouseForm`, `TenderForm`, `CategoryForm` in `components/forms/master.tsx`
   - `MaterialForm` and `SubitemForm` in `components/forms/material.tsx`
   - `SiteForm` in `components/forms/site.tsx`
   - `EquipmentForm` in `components/forms/equipment.tsx`
2. **Master List Pages**:
   - `/licenses` (`useLicenses`, `useDeleteLicense`)
   - `/warehouses` (`useWarehouses`, `useDeleteWarehouse`)
   - `/tenders` (`useTenders`, `useDeleteTender`)
   - `/sites` (`useSites`, `useDeleteSite`)
   - `/materials` (`useMaterials`, `useDeleteMaterial`)
   - `/equipment` (`useEquipmentList`, `useDeleteEquipment`)
3. **Upstream Merges**:
   - Pulled and merged `hooks` branch changes (typed sites & tasks, narrowed status filters)

---

## Remaining Phases ("The Rest")

### Phase 1: Approvals Workflow
- **`app/approvals/page.tsx`**:
  - Hook: `useApprovals({ status: status === "all" ? undefined : status })`
  - Render pending, approved, and rejected approvals.
  - Retain quick filter buttons and status stamps.
- **`app/approvals/[id]/page.tsx`**:
  - Hook: `useApproval(id)`
  - Actions: `useApproveApproval()` and `useRejectApproval()`
  - Provide loading states during mutation and redirect back to `/approvals` on completion.

### Phase 2: Ledger & Transactions
- **`app/ledger/page.tsx`**:
  - Hooks: `useTransactions()`, `useCategories()`, `useLicenses()`, `useSites()`
  - Manual Post Action: `useCreateTransaction()` (immediate post, approval-gated synchronously)
  - Category deletion: `useDeleteCategory()`
  - Calculate category spend summaries directly from active transaction records.

### Phase 3: Inventory Balances
- **`app/inventory/page.tsx`**:
  - Hooks: `useInventoryBalances()`, `useMaterials()`, `useWarehouses()`, `useSites()`
  - Real-time client search filtering across material name and location.
  - Role-based site scoping for site managers.

### Phase 4: Yard and Site Board (Dashboard)
- **`app/page.tsx`**:
  - Hooks:
    - `useApprovals({ status: "pending" })` (pending count and approval item previews)
    - `useEquipmentList()` (plant on loan count, maintenance status)
    - `useTransactions()` (total money in / money out metrics)
    - `useSites()` (site budget status and visual spend bars)

### Phase 5: Detail Pages
- **`app/sites/[id]/page.tsx`**:
  - Hooks: `useSite(id)`, `useSiteTasks(id)`, `useSiteLifecycle(id)`, `useInventoryBalances({ siteId: id })`, `useEquipmentList({ siteId: id })`
  - Task mutations: `useCreateSiteTask`, `useClaimSiteTask`, `useCompleteSiteTask`
- **`app/materials/[id]/page.tsx`**:
  - Hooks: `useMaterial(id)`, `useInventoryBalances({ materialId: id })`, `useSubItems(id)`
  - Action mutations: `usePurchaseMaterial`, `useTransferMaterial`, `useSellMaterial`, `useConsumeMaterial`, `useReportMissingMaterial`
- **`app/equipment/[id]/page.tsx`**:
  - Hooks: `useEquipment(id)`, `useEquipmentLogs({ equipmentId: id })`
  - Action mutations: `usePurchaseEquipment`, `useTransferEquipment`, `useSellEquipment`, `useMaintenanceDispatch`, `useMaintenanceReturn`, etc.

---

## Verification & Acceptance
- `pnpm tsc --noEmit` must pass with 0 type errors.
- `pnpm build` must succeed without SSR/build discrepancies.
- Design tokens, hairline styling, and layout must strictly follow `docs/design-guide.md`.
