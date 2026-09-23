import { createSimpleCrudApi } from "./simple-crud"
import { apiClient } from "./client"
import { buildListParams, type ListParams } from "./list-params"
import type {
    Warehouse,
    SoldItemsOverview,
    IndividualEquipmentMovement,
    IndividualEquipmentItem,
    InventoryMovement,
    InventoryItem,
    MaterialAtInventory,
    BulkEquipmentAtInventory,
} from "@/types/api"

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
    return apiClient.get<(IndividualEquipmentMovement & { equipment: IndividualEquipmentItem | null })[]>(
        `/api/warehouses/${id}/sold-items/equipment${qs ? `?${qs}` : ""}`
    )
}

export async function getWarehouseSoldMaterials(id: string, params?: ListParams) {
    const qs = params ? buildListParams(params) : ""
    return apiClient.get<(InventoryMovement & { item: InventoryItem | null })[]>(
        `/api/warehouses/${id}/sold-items/materials${qs ? `?${qs}` : ""}`
    )
}

// ---- Inventory at this warehouse (resolves its node internally) — pre-joined. ----

export type MaterialsAtWarehouseParams = ListParams<{ includeZeroQuantity?: "true" }>

export function getWarehouseMaterials(id: string, params: MaterialsAtWarehouseParams = {}) {
    return apiClient.get<MaterialAtInventory[]>(`/api/warehouses/${id}/materials`, buildListParams(params))
}

export function getWarehouseIndividualEquipment(id: string, params: MaterialsAtWarehouseParams = {}) {
    return apiClient.get<IndividualEquipmentItem[]>(`/api/warehouses/${id}/equipment`, buildListParams(params))
}

export function getWarehouseBulkEquipment(id: string, params: MaterialsAtWarehouseParams = {}) {
    return apiClient.get<BulkEquipmentAtInventory[]>(`/api/warehouses/${id}/bulk-equipment`, buildListParams(params))
}