
import { createSimpleCrudHooks } from "./use-simple-crud"
// import { warehousesApi } from "@/lib/api/warehouses"
import { warehousesApi } from "@/lib/api/warehouses"
import { queryKeys } from "@/lib/query/keys"

const {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
    useRestore,
} = createSimpleCrudHooks(warehousesApi, queryKeys.warehouses)

export const useWarehouses = useList
export const useWarehouse = useDetail
export const useCreateWarehouse = useCreate
export const useUpdateWarehouse = useUpdate
export const useDeleteWarehouse = useDelete
export const useRestoreWarehouse = useRestore