import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type {
    IndividualEquipmentItem,
    EquipmentTraceResponse,
    EquipmentAssignmentStatus,
    EquipmentLifecycleStatus,
    EquipmentCondition,
    VerifyEquipmentStateResult,
    RebuildResult,
} from "@/types/api"

// Direct create is disabled server-side in v2 (unconditional VALIDATION
// throw) — every equipment record must originate from a `purchase`
// equipment-movement (see equipment-movements.ts) or a rental's
// equipmentId: "new". There is deliberately no createEquipment() here.

export interface UpdateEquipmentPayload {
    identifier?: string
    vendorName?: string
    originalValue?: string
    bookValue?: string
    // location/condition/assignment/lifecycle are movement-only — not
    // accepted keys on this schema at all in v2.
}

export type EquipmentListParams = ListParams<{
    itemId?: string[]
    inventoryId?: string[]
    lifecycleStatus?: EquipmentLifecycleStatus[]
    assignmentStatus?: EquipmentAssignmentStatus[]
    condition?: EquipmentCondition[]
}>

export function listEquipment(params: EquipmentListParams = {}) {
    return apiClient.get<IndividualEquipmentItem[]>("/api/equipment", buildListParams(params))
}

export function getEquipment(id: string) {
    return apiClient.get<IndividualEquipmentItem>(`/api/equipment/${id}`)
}

export function updateEquipment(id: string, payload: UpdateEquipmentPayload) {
    return apiClient.patch<IndividualEquipmentItem>(`/api/equipment/${id}`, payload)
}

export function deleteEquipment(id: string) {
    return apiClient.delete<void>(`/api/equipment/${id}`)
}

export function restoreEquipment(id: string) {
    return apiClient.post<IndividualEquipmentItem>(`/api/equipment/${id}/restore`)
}

export function traceEquipment(id: string) {
    return apiClient.get<EquipmentTraceResponse>(`/api/equipment/${id}/trace`)
}

export function verifyEquipmentState(id: string) {
    return apiClient.get<VerifyEquipmentStateResult>(`/api/equipment-states/${id}/verify`)
}

// Superadmin only.
export function rebuildEquipmentStates() {
    return apiClient.post<RebuildResult>("/api/equipment-states/rebuild")
}
