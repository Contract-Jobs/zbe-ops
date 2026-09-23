import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { InventoryBalance, InventoryMovement, VerifyBalanceResult, RebuildResult } from "@/types/api"

export type InventoryBalanceParams = ListParams<{
    itemId?: string[]
    inventoryId?: string[]
    itemCategory?: ("material" | "equipment")[]
    includeZeroQuantity?: string
}>

export function getInventoryBalances(params: InventoryBalanceParams = {}) {
    return apiClient.get<InventoryBalance[]>("/api/inventory-balances", buildListParams(params))
}

// Full movement log for one (item, inventory) pair — the drill-down used to
// find a specific bad entry to reverse (there's no direct "adjust" anymore).
export function getBalanceMovements(params: { itemId: string; inventoryId: string; includeReversed?: boolean }) {
    const search = new URLSearchParams()
    search.set("itemId", params.itemId)
    search.set("inventoryId", params.inventoryId)
    if (params.includeReversed) search.set("includeReversed", "true")
    return apiClient.get<InventoryMovement[]>("/api/inventory-balances/movements", search)
}

export function verifyInventoryBalance(params: { itemId: string; inventoryId: string }) {
    const search = new URLSearchParams()
    search.set("itemId", params.itemId)
    search.set("inventoryId", params.inventoryId)
    return apiClient.get<VerifyBalanceResult>("/api/inventory-balances/verify", search)
}

// Superadmin only — recomputes every balance from the movement ledger from
// scratch. Heavy recovery tool.
export function rebuildInventoryBalances() {
    return apiClient.post<RebuildResult>("/api/inventory-balances/rebuild")
}
