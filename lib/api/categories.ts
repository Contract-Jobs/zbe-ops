import { createSimpleCrudApi } from "./simple-crud"
import { apiClient } from "./client"
import type { TransactionCategory } from "@/types/api"

export interface CreateCategoryPayload {
    name: string
}

export type UpdateCategoryPayload = CreateCategoryPayload // doc shows `name` as required on update, not optional

const baseCategoriesApi = createSimpleCrudApi<TransactionCategory, CreateCategoryPayload, UpdateCategoryPayload>(
    "/api/transactions/categories"
)

export const categoriesApi = {
    ...baseCategoriesApi,
    inBulk: (ids: string[]) =>
        apiClient.get<TransactionCategory[]>("/api/categories/in-bulk", { ids: ids.join(",") })
            .catch(() => apiClient.get<TransactionCategory[]>("/api/transactions/categories/in-bulk", { ids: ids.join(",") })),
}