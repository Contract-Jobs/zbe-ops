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
                transaction.isApproved ? "approved" : "pending",
                transaction.siteId ?? undefined
            )
        },
    })
}

// A reversal is itself staged through the approval flow (auto-approved for
// admin/superadmin, else pending) — mirrors useCreateTransaction so a
// pending reversal shows up in Approvals and an auto-approved one refreshes
// the site's ledger/summary immediately instead of only on next reload.
export function useReverseTransaction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => transactionsApi.reverseTransaction(id),
        onSuccess: ({ data: reversal }) => {
            onActionSettled(
                queryClient,
                "transaction",
                reversal.id,
                reversal.isApproved ? "approved" : "pending",
                reversal.siteId ?? undefined
            )
        },
    })
}