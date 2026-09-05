// hooks/use-licenses.ts

import { createSimpleCrudHooks } from "./use-simple-crud"
import { licensesApi } from "@/lib/api/licenses"
import { queryKeys } from "@/lib/query/keys"

const {
    useList,
    useDetail,
    useCreate,
    useUpdate,
    useDelete,
    useRestore,
} = createSimpleCrudHooks(licensesApi, queryKeys.licenses)

export const useLicenses = useList
export const useLicense = useDetail
export const useCreateLicense = useCreate
export const useUpdateLicense = useUpdate
export const useDeleteLicense = useDelete
export const useRestoreLicense = useRestore