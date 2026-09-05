import { createSimpleCrudApi } from "./simple-crud"
import type { Warehouse } from "@/types/api"

export interface CreateWarehousePayload {
    name: string
    location?: string
}

export type UpdateWarehousePayload = Partial<CreateWarehousePayload>

export const warehousesApi = createSimpleCrudApi<Warehouse, CreateWarehousePayload, UpdateWarehousePayload>(
    "/api/warehouses"
)