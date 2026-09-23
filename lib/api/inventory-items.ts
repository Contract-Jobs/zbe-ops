import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { InventoryItem, InventoryItemSubitem, ItemBalanceRow, ItemHistoryRow, InventoryItemCategory, InventoryItemTracking, InventoryItemCompositionType } from "@/types/api"

interface CreateSubitemInput {
    name: string
    quantity: number
    unit?: string
}

export interface CreateInventoryItemPayload {
    name: string
    slug?: string
    category: InventoryItemCategory
    tracking: InventoryItemTracking
    compositionType?: InventoryItemCompositionType
    unit?: string
    subitems?: CreateSubitemInput[]
}

export type UpdateInventoryItemPayload = Partial<CreateInventoryItemPayload>

export type InventoryItemListParams = ListParams<{
    category?: InventoryItemCategory
    tracking?: InventoryItemTracking
}>

export function listInventoryItems(params: InventoryItemListParams = {}) {
    return apiClient.get<InventoryItem[]>("/api/inventory-items", buildListParams(params))
}

export function getInventoryItem(id: string) {
    return apiClient.get<InventoryItem>(`/api/inventory-items/${id}`)
}

export function createInventoryItem(payload: CreateInventoryItemPayload) {
    return apiClient.post<InventoryItem>("/api/inventory-items", payload)
}

export function updateInventoryItem(id: string, payload: UpdateInventoryItemPayload) {
    return apiClient.patch<InventoryItem>(`/api/inventory-items/${id}`, payload)
}

export function deleteInventoryItem(id: string) {
    return apiClient.delete<void>(`/api/inventory-items/${id}`)
}

export function restoreInventoryItem(id: string) {
    return apiClient.post<InventoryItem>(`/api/inventory-items/${id}/restore`)
}

export type ItemBalancesParams = ListParams

// Current balances across every location, sorted by quantity desc.
export function getItemBalances(id: string, params: ItemBalancesParams = {}) {
    return apiClient.get<ItemBalanceRow[]>(`/api/inventory-items/${id}/balances`, buildListParams(params))
}

export type ItemHistoryParams = ListParams<{
    sortBy?: "movementDate" | "quantity" | "unitCost" | "totalCost" | "createdAt"
    sortOrder?: "asc" | "desc"
    fromDate?: string
    toDate?: string
    isReversal?: string
    includeReversed?: string
}>

// Movement history with fromLabel/toLabel resolved — unlike the generic
// /api/inventory-movements?itemId=, this supports sortBy (that one is
// hardcoded to movementDate desc).
export function getItemHistory(id: string, params: ItemHistoryParams = {}) {
    return apiClient.get<ItemHistoryRow[]>(`/api/inventory-items/${id}/history`, buildListParams(params))
}

export function listSubitems(itemId: string) {
    return apiClient.get<InventoryItemSubitem[]>(`/api/inventory-items/${itemId}/subitems`)
}

export function addSubitem(itemId: string, payload: { name: string; quantity: string; unit?: string }) {
    return apiClient.post<InventoryItemSubitem>(`/api/inventory-items/${itemId}/subitems`, payload)
}

export function updateSubitem(
    itemId: string,
    subitemId: string,
    payload: Partial<{ name: string; quantity: string; unit?: string }>
) {
    return apiClient.patch<InventoryItemSubitem>(`/api/inventory-items/${itemId}/subitems/${subitemId}`, payload)
}

// Hard delete in v2, unlike the parent item's soft delete.
export function removeSubitem(itemId: string, subitemId: string) {
    return apiClient.delete<void>(`/api/inventory-items/${itemId}/subitems/${subitemId}`)
}
