import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Equipment, EquipmentLog, EquipmentLogAction } from "@/types/api"

export interface CreateEquipmentPayload {
    name: string
    serialNumber?: string
    siteId?: string
    warehouseId?: string
    licenseId?: string
    originalValue?: string
    value?: string   // new
    vendorName?: string
}


export interface CreateEquipmentPayload {
    name: string
    serialNumber?: string
    siteId?: string
    warehouseId?: string
    licenseId?: string
    originalValue?: string
    value?: string
    vendorName?: string
}


export interface UpdateEquipmentPayload {
    name?: string
    serialNumber?: string
    licenseId?: string
    vendorName?: string
    // Note: location and value are NOT updatable via PATCH — doc explicitly
    // forbids it. Those only change through action endpoints (transfer,
    // degrade, appreciate, etc.)
}


export type EquipmentListParams = ListParams<{
    siteId?: string[]
    warehouseId?: string[]
    licenseId?: string[]
    status?: string[]
    ownershipStatus?: string[]
}>

export function listEquipment(params: EquipmentListParams = {}) {
    return apiClient.get<Equipment[]>("/api/equipment", buildListParams(params))
}

export function getEquipment(id: string) {
    return apiClient.get<Equipment>(`/api/equipment/${id}`)
}

export function createEquipment(payload: CreateEquipmentPayload) {
    return apiClient.post<Equipment>("/api/equipment", payload)
}

export function updateEquipment(id: string, payload: UpdateEquipmentPayload) {
    return apiClient.patch<Equipment>(`/api/equipment/${id}`, payload)
}

export function createEquipmentLog(payload: EquipmentLogAction) {
    return apiClient.post<EquipmentLog>("/api/equipment/logs", payload)
}

export function listEquipmentLogs(
    params: ListParams<{ equipmentId?: string; siteId?: string; warehouseId?: string; logType?: string }> = {}
) {
    return apiClient.get<EquipmentLog[]>("/api/equipment/logs", buildListParams(params))
}

export function getEquipmentLog(id: string) {
    return apiClient.get<EquipmentLog>(`/api/equipment/logs/${id}`)
}

export function reverseEquipmentLog(id: string) {
    return apiClient.post<EquipmentLog>(`/api/equipment/logs/${id}/reverse`)
}


export function deleteEquipment(id: string) {
    return apiClient.delete<void>(`/api/equipment/${id}`)
}

export function restoreEquipment(id: string) {
    return apiClient.post<Equipment>(`/api/equipment/${id}/restore`)
}