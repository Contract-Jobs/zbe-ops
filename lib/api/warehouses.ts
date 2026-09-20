import { createSimpleCrudApi } from "./simple-crud"
import { apiClient } from "./client"
import { buildListParams, type ListParams } from "./list-params"
import type { Warehouse, SoldItemsOverview, EquipmentLog, Equipment, MaterialLog, MaterialCatalog } from "@/types/api"

export interface CreateWarehousePayload {
    name: string
    location?: string
}

export type UpdateWarehousePayload = Partial<CreateWarehousePayload>

export const warehousesApi = createSimpleCrudApi<Warehouse, CreateWarehousePayload, UpdateWarehousePayload>(
    "/api/warehouses"
)

export async function getWarehouseSoldOverview(id: string) {
    return apiClient.get<SoldItemsOverview>(`/api/warehouses/${id}/sold-items`)
}

export async function getWarehouseSoldEquipment(id: string, params?: ListParams) {
    const qs = params ? buildListParams(params) : ""
    return apiClient.get<(EquipmentLog & { equipment: Equipment | null })[]>(
        `/api/warehouses/${id}/sold-items/equipment${qs ? `?${qs}` : ""}`
    )
}

export async function getWarehouseSoldMaterials(id: string, params?: ListParams) {
    const qs = params ? buildListParams(params) : ""
    return apiClient.get<(MaterialLog & { material: MaterialCatalog | null })[]>(
        `/api/warehouses/${id}/sold-items/materials${qs ? `?${qs}` : ""}`
    )
}