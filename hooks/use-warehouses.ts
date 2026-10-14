
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createSimpleCrudHooks } from "./use-simple-crud"
import {
    warehousesApi,
    listWarehouseSitePayments,
    registerSitePayment,
    reverseSitePayment,
    markSoldItemsPaid,
    getWarehouseSoldOverview,
    getWarehouseSoldEquipment,
    getWarehouseSoldMaterials,
    getWarehouseMaterials,
    getWarehouseIndividualEquipment,
    getWarehouseBulkEquipment,
} from "@/lib/api/warehouses"
import type { MaterialsAtWarehouseParams, SoldEquipmentParams, SoldItemsDateParams, SoldMaterialsParams } from "@/lib/api/warehouses"
import type { SitePaymentListParams } from "@/lib/api/sites"
import type { RegisterSitePaymentRequest } from "@/types/api"
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
// ---- Site accounts: a site pays its warehouse in bulk, not per sale. ----

export function useWarehouseSitePayments(
    id: string | undefined,
    params: SitePaymentListParams & { siteId?: string } = {}
) {
    return useQuery({
        queryKey: queryKeys.warehouses.sitePayments(id ?? "", params),
        queryFn: () => listWarehouseSitePayments(id as string, params),
        enabled: !!id,
    })
}

// A payment or reversal moves the account balance, the cash entry and the
// analytics that read both; the site's own payables view reads the same data.
function useInvalidateSiteAccounts() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.sites.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventoryMovements.lists() })
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
        queryClient.invalidateQueries({ queryKey: ["analytics"] })
    }
}

export function useRegisterSitePayment() {
    const invalidate = useInvalidateSiteAccounts()
    return useMutation({
        mutationFn: ({ warehouseId, payload }: { warehouseId: string; payload: RegisterSitePaymentRequest }) =>
            registerSitePayment(warehouseId, payload),
        onSuccess: invalidate,
    })
}

export function useReverseSitePayment() {
    const invalidate = useInvalidateSiteAccounts()
    return useMutation({
        mutationFn: ({ warehouseId, paymentId, note }: { warehouseId: string; paymentId: string; note?: string }) =>
            reverseSitePayment(warehouseId, paymentId, { note }),
        onSuccess: invalidate,
    })
}

// Tracking label only — the balance never changes, so only the movement rows
// and the account's marked/unmarked split need a refresh.
export function useMarkSoldItemsPaid() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ warehouseId, movementIds, paid }: { warehouseId: string; movementIds: string[]; paid: boolean }) =>
            markSoldItemsPaid(warehouseId, { movementIds, paid }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryMovements.lists() })
        },
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