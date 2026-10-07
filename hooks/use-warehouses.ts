
import { useQuery } from "@tanstack/react-query"
import { createSimpleCrudHooks } from "./use-simple-crud"
import {
    warehousesApi,
    getWarehouseSoldOverview,
    getWarehouseSoldEquipment,
    getWarehouseSoldMaterials,
    getWarehouseMaterials,
    getWarehouseIndividualEquipment,
    getWarehouseBulkEquipment,
} from "@/lib/api/warehouses"
import type { MaterialsAtWarehouseParams, SoldEquipmentParams, SoldItemsDateParams, SoldMaterialsParams } from "@/lib/api/warehouses"
import { queryKeys } from "@/lib/query/keys"

const {
    useList,
    useDetail,
    useInBulk,
    useCreate,
    useUpdate,
    useDelete,
    useRestore,
} = createSimpleCrudHooks(warehousesApi, queryKeys.warehouses)

export const useWarehouses = useList
export const useWarehousesInBulk = useInBulk

export function useWarehouseSoldOverview(id: string, params: SoldItemsDateParams = {}) {
    return useQuery({
        queryKey: queryKeys.warehouses.soldItems(id, params),
        queryFn: () => getWarehouseSoldOverview(id, params),
    })
}

export function useWarehouseSoldEquipment(id: string, params: SoldEquipmentParams = {}) {
    return useQuery({
        queryKey: queryKeys.warehouses.soldEquipment(id, params),
        queryFn: () => getWarehouseSoldEquipment(id, params),
    })
}

export function useWarehouseSoldMaterials(id: string, params: SoldMaterialsParams = {}) {
    return useQuery({
        queryKey: queryKeys.warehouses.soldMaterials(id, params),
        queryFn: () => getWarehouseSoldMaterials(id, params),
    })
}
// Pre-joined inventory at this warehouse — resolves its node internally.
export function useWarehouseMaterials(id: string, params: MaterialsAtWarehouseParams = {}) {
    return useQuery({
        queryKey: queryKeys.warehouses.materials(id, params),
        queryFn: () => getWarehouseMaterials(id, params),
    })
}

export function useWarehouseIndividualEquipment(id: string, params: MaterialsAtWarehouseParams = {}) {
    return useQuery({
        queryKey: queryKeys.warehouses.equipment(id, params),
        queryFn: () => getWarehouseIndividualEquipment(id, params),
    })
}

export function useWarehouseBulkEquipment(id: string, params: MaterialsAtWarehouseParams = {}) {
    return useQuery({
        queryKey: queryKeys.warehouses.bulkEquipment(id, params),
        queryFn: () => getWarehouseBulkEquipment(id, params),
    })
}

export const useWarehouse = useDetail
export const useCreateWarehouse = useCreate
export const useUpdateWarehouse = useUpdate
export const useDeleteWarehouse = useDelete
export const useRestoreWarehouse = useRestore