import { createSimpleCrudApi } from "./simple-crud"
import type { TransactionCategory } from "@/types/api"

export interface CreateCategoryPayload {
    name: string
}

export type UpdateCategoryPayload = CreateCategoryPayload // doc shows `name` as required on update, not optional

export const categoriesApi = createSimpleCrudApi<TransactionCategory, CreateCategoryPayload, UpdateCategoryPayload>(
    "/api/transactions/categories"
)