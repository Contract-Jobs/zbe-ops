import { createSimpleCrudHooks } from "./use-simple-crud"
import { categoriesApi } from "@/lib/api/categories"
import { queryKeys } from "@/lib/query/keys"

const {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
    useRestore,
} = createSimpleCrudHooks(categoriesApi, queryKeys.categories)

export const useCategories = useList
export const useCategory = useDetail
export const useCreateCategory = useCreate
export const useUpdateCategory = useUpdate
export const useDeleteCategory = useDelete
export const useRestoreCategory = useRestore