import { createSimpleCrudHooks } from "./use-simple-crud"
import { tendersApi } from "@/lib/api/tenders"
import { queryKeys } from "@/lib/query/keys"

const {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
    useRestore,
} = createSimpleCrudHooks(tendersApi, queryKeys.tenders)

export const useTenders = useList
export const useTender = useDetail
export const useCreateTender = useCreate
export const useUpdateTender = useUpdate
export const useDeleteTender = useDelete
export const useRestoreTender = useRestore