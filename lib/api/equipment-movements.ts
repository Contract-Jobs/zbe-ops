import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { IndividualEquipmentMovement, EquipmentMovementCreatePayload, EquipmentMovementType } from "@/types/api"

export type EquipmentMovementListParams = ListParams<{
    individualItemId?: string
    movementType?: EquipmentMovementType
    fromDate?: string
    toDate?: string
    isReversal?: string
    includeReversed?: string
}>

// Rental-type movements (rent_to_client/return_from_client/rent_from_client/
// return_to_client) are rejected here server-side — those go through
// /api/rentals instead (see rentals.ts).
export function createEquipmentMovement(payload: EquipmentMovementCreatePayload) {
    return apiClient.post<IndividualEquipmentMovement>("/api/equipment-movements", payload)
}

export function listEquipmentMovements(params: EquipmentMovementListParams = {}) {
    return apiClient.get<IndividualEquipmentMovement[]>("/api/equipment-movements", buildListParams(params))
}

export function reverseEquipmentMovement(id: string, payload: { notes?: string } = {}) {
    return apiClient.post<IndividualEquipmentMovement>(`/api/equipment-movements/${id}/reverse`, payload)
}
