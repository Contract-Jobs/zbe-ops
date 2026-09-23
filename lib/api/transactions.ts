import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Transaction } from "@/types/api"

// v2's create schema has no isReversal/reversalOfId fields — a reversal can
// only be produced by POST /api/transactions/[id]/reverse, which resolves
// and links the original itself. See docs/api-v2-migration-plan.md §3.6.
export interface CreateTransactionPayload {
    type: "money_in" | "money_out"
    amount: string
    licenseId?: string
    siteId?: string
    warehouseId?: string
    categoryId?: string
    equipmentId?: string
    description?: string
    transactionDate?: string
}

export type TransactionListParams = ListParams<{
    siteId?: string[]
    categoryId?: string[]
    licenseId?: string[]
    equipmentId?: string[]
    type?: string[]
    dateFrom?: string[]
    dateTo?: string[]
    // Excludes the automatic financial side-effect entries of purchase/sale
    // movements by default wherever this is passed — callers opt in to see
    // them, matching every other "hidden by default" list flag in the app.
    isSystemGenerated?: string[]
}>

export function listTransactions(params: TransactionListParams = {}) {
    return apiClient.get<Transaction[]>("/api/transactions", buildListParams(params))
}

export function getTransaction(id: string) {
    return apiClient.get<Transaction>(`/api/transactions/${id}`)
}

export function createTransaction(payload: CreateTransactionPayload) {
    return apiClient.post<Transaction>("/api/transactions", payload)
}

export function reverseTransaction(id: string, payload: { description?: string } = {}) {
    return apiClient.post<Transaction>(`/api/transactions/${id}/reverse`, payload)
}