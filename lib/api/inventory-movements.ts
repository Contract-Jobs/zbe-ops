import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { InventoryMovement, InventoryMovementCreatePayload, QuantityMovementType } from "@/types/api"

export type InventoryMovementListParams = ListParams<{
    itemId?: string
    movementType?: QuantityMovementType
    fromDate?: string
    toDate?: string
    isReversal?: string
    includeReversed?: string
}>

// movementType: "loss" is silently redirected server-side to the
// loss-specific handler (requires metadata.reason) — the generic path
// refuses it outright, so this create fn covers both without a branch.
export function createInventoryMovement(payload: InventoryMovementCreatePayload) {
    return apiClient.post<InventoryMovement>("/api/inventory-movements", payload)
}

export function listInventoryMovements(params: InventoryMovementListParams = {}) {
    return apiClient.get<InventoryMovement[]>("/api/inventory-movements", buildListParams(params))
}

export function reverseInventoryMovement(id: string, payload: { notes?: string } = {}) {
    return apiClient.post<InventoryMovement>(`/api/inventory-movements/${id}/reverse`, payload)
}
