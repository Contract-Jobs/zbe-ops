import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as ledgersApi from "@/lib/api/ledgers"
import type { LedgerListParams } from "@/lib/api/ledgers"
import { queryKeys } from "@/lib/query/keys"
import { invalidateAnalytics } from "@/lib/query/approval-invalidation"

const ANALYTICS_STALE_TIME = 2 * 60 * 1000

export function useLedgers(params: LedgerListParams = {}) {
    return useQuery({
        queryKey: queryKeys.ledgers.list(params),
        queryFn: () => ledgersApi.listLedgers(params),
    })
}

// Lives under /api/ledgers in v2, not /api/analytics — see docs/new_api.md §7.
export function useCostBreakdown(params: Parameters<typeof ledgersApi.getCostBreakdown>[0] | undefined) {
    return useQuery({
        queryKey: queryKeys.ledgers.costBreakdown(params?.siteId ?? "", params?.dateFrom, params?.dateTo),
        queryFn: () => ledgersApi.getCostBreakdown(params!),
        enabled: !!params?.siteId,
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useVerifySiteLedger(siteId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.ledgers.verify(siteId ?? ""),
        queryFn: () => ledgersApi.verifySiteLedger(siteId as string),
        enabled: !!siteId,
    })
}

// Admin/superadmin only — heavy recovery tool.
export function useRebuildSiteLedger() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (siteId: string) => ledgersApi.rebuildSiteLedger(siteId),
        onSuccess: (_result, siteId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.ledgers.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.sites.summary(siteId) })
            // Budget health and other analytics aggregate ledger data too.
            invalidateAnalytics(queryClient)
        },
    })
}
