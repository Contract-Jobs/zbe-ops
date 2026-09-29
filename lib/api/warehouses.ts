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

export type SoldItemsDateParams = {
    dateFrom?: string
    dateTo?: string
    licenseId?: string
}

export async function getWarehouseSoldOverview(id: string, params: SoldItemsDateParams = {}) {
    return apiClient.get<SoldItemsOverview>(`/api/warehouses/${id}/sold-items`, buildListParams(params))
}

export type SoldEquipmentParams = ListParams<SoldItemsDateParams & {
    equipmentId?: string
    licenseId?: string
    buyerName?: string
    isReversal?: string
}>

export async function getWarehouseSoldEquipment(id: string, params: SoldEquipmentParams = {}) {
    return apiClient.get<(IndividualEquipmentMovement & { equipment: IndividualEquipmentItem | null })[]>(
        `/api/warehouses/${id}/sold-items/equipment`,
        buildListParams(params)
    )
}

export type SoldMaterialsParams = ListParams<SoldItemsDateParams & {
    materialId?: string
    licenseId?: string
    buyerName?: string
    isReversal?: string
}>

export async function getWarehouseSoldMaterials(id: string, params: SoldMaterialsParams = {}) {
    return apiClient.get<(InventoryMovement & { item: InventoryItem | null })[]>(
        `/api/warehouses/${id}/sold-items/materials`,
        buildListParams(params)
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