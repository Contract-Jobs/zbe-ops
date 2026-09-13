import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { InventoryBalance, MaterialLog, InventoryLocationSummary, Equipment } from "@/types/api"

// export type InventoryBalanceParams = ListParams<{
//     siteId?: string
//     warehouseId?: string
//     materialId?: string
// }>
// lib/api/inventory.ts — replace InventoryBalanceParams

export type InventoryBalanceParams = ListParams<{
    siteId?: string[]
    warehouseId?: string[]
    materialId?: string[]
}>

// RBAC: Site Managers restricted to own site(s) — the backend filters this
// server-side, but the calling hook should still fold the current userId
// into its query key params (see keys.ts comment on inventory.balances).
export function getInventoryBalances(params: InventoryBalanceParams = {}) {
    return apiClient.get<InventoryBalance[]>("/api/inventory/balances", buildListParams(params))
}

export function traceMaterialHistory(catalogId: string) {
    return apiClient.get<{ balances: InventoryBalance[]; history: MaterialLog[] }>(
        `/api/inventory/trace/${catalogId}`
    )
}

export function getInventoryLocations() {
    return apiClient.get<InventoryLocationSummary[]>("/api/inventory")
}

export function getInventoryLocationMaterials(id: string, params: ListParams = {}) {
    return apiClient.get<InventoryBalance[]>(`/api/inventory/${id}/materials`, buildListParams(params))
}

export function getInventoryLocationEquipments(id: string, params: ListParams = {}) {
    return apiClient.get<Equipment[]>(`/api/inventory/${id}/equipments`, buildListParams(params))
}