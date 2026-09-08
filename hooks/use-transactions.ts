import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as transactionsApi from "@/lib/api/transactions"
import type { TransactionListParams, CreateTransactionPayload } from "@/lib/api/transactions"
import { queryKeys } from "@/lib/query/keys"
import { onActionSettled } from "@/lib/query/approval-invalidation"

export function useTransactions(params: TransactionListParams = {}) {
    return useQuery({
        queryKey: queryKeys.transactions.list(params),
        queryFn: () => transactionsApi.listTransactions(params),
    })
}

export function useTransaction(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.transactions.detail(id ?? ""),
        queryFn: () => transactionsApi.getTransaction(id as string),
        enabled: !!id,
    })
}

// Approval-gated (even for admins — auto-approved synchronously) per the doc.
export function useCreateTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: CreateTransactionPayload) => transactionsApi.createTransaction(payload),
        onSuccess: ({ data: transaction }) => {
            onActionSettled(
                queryClient,
                "transaction",
                transaction.id,
                transaction.approvalStatus,
                transaction.siteId ?? undefined
            )
        },
    })
}

export function useReverseTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => transactionsApi.reverseTransaction(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all })
        },
    })
}