import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { MaterialCatalog, MaterialSubitem, MaterialLog, MaterialLogAction } from "@/types/api"

interface CreateSubitemInput {
    name: string
    quantity: number
    unit?: string
}

export interface CreateMaterialPayload {
    name: string
    unit?: string
    type?: "single" | "set"
    subitems?: CreateSubitemInput[]
}

export type UpdateMaterialPayload = Partial<CreateMaterialPayload>

export type MaterialListParams = ListParams<{
    unit?: string[]
    type?: string[]
    categoryId?: string[]
}>


export function listMaterials(params: MaterialListParams = {}) {
    return apiClient.get<MaterialCatalog[]>("/api/materials", buildListParams(params))
}

export function getMaterial(id: string) {
    return apiClient.get<MaterialCatalog>(`/api/materials/${id}`)
}

export function createMaterial(payload: CreateMaterialPayload) {
    return apiClient.post<MaterialCatalog>("/api/materials", payload)
}

export function updateMaterial(id: string, payload: UpdateMaterialPayload) {
    return apiClient.patch<MaterialCatalog>(`/api/materials/${id}`, payload)
}


// export function deleteMaterial(id: string) {
//     return apiClient.delete<void>(`/api/materials/${id}`)
// }

// export function restoreMaterial(id: string) {
//     return apiClient.post<MaterialCatalog>(`/api/materials/${id}/restore`)
// }

export function traceMaterialHistory(catalogId: string) {
    return apiClient.get<{
        materialId: string
        assetName: string
        currentBalances: { location: string; locationId: string; quantity: number; avgUnitPrice: string }[]
        history: { log: MaterialLog; fromLabel: string | null; toLabel: string | null }[]
    }>(`/api/inventory/trace/${catalogId}`)
}

export function listSubItems(materialId: string) {
    return apiClient.get<MaterialSubitem[]>(`/api/materials/${materialId}/sub-items`)
}

export function addSubItem(materialId: string, payload: CreateSubitemInput) {
    return apiClient.post<MaterialSubitem>(`/api/materials/${materialId}/sub-items`, payload)
}

export function updateSubItem(materialId: string, subItemId: string, payload: Partial<CreateSubitemInput>) {
    return apiClient.patch<MaterialSubitem>(`/api/materials/${materialId}/sub-items/${subItemId}`, payload)
}

export function removeSubItem(materialId: string, subItemId: string) {
    return apiClient.delete<{ id: string; deletedAt: string }>(`/api/materials/${materialId}/sub-items/${subItemId}`)
}

export function createMaterialLog(payload: MaterialLogAction) {
    return apiClient.post<MaterialLog>("/api/inventory/logs", payload)
}

export function listMaterialLogs(
    params: ListParams<{ materialId?: string; siteId?: string; warehouseId?: string; logType?: string }> = {}
) {
    return apiClient.get<MaterialLog[]>("/api/inventory/logs", buildListParams(params))
}

export function getMaterialLog(id: string) {
    return apiClient.get<MaterialLog>(`/api/inventory/logs/${id}`)
}

export function reverseMaterialLog(id: string) {
    return apiClient.post<MaterialLog>(`/api/inventory/logs/${id}/reverse`)
}

export function deleteMaterial(id: string) {
    return apiClient.delete<void>(`/api/materials/${id}`)
}

export function restoreMaterial(id: string) {
    return apiClient.post<MaterialCatalog>(`/api/materials/${id}/restore`)
}