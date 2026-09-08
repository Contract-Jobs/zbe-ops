import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Transaction } from "@/types/api"

// export interface CreateTransactionPayload {
//     type: "money_in" | "money_out"
//     amount: string
//     licenseId?: string
//     siteId?: string
//     warehouseId?: string
//     categoryId?: string
//     equipmentId?: string
//     description?: string
//     transactionDate?: string
//     // isReversal?/reversalofId? intentionally omitted — the latest doc lists
//     // them on this payload alongside a separate POST .../reverse endpoint,
//     // which is odd; not building against them until confirmed with backend dev.
// }

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
    isReversal?: boolean
    reversalOfId?: string // capital O — confirmed by backend dev
}

export type TransactionListParams = ListParams<{
    siteId?: string[]
    categoryId?: string[]
    licenseId?: string[]
    equipmentId?: string[]
    type?: string[]
    dateFrom?: string[]
    dateTo?: string[]
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

export function reverseTransaction(id: string) {
    return apiClient.post<Transaction>(`/api/transactions/${id}/reverse`)
}