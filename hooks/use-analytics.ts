import { useQuery } from "@tanstack/react-query"
import * as analyticsApi from "@/lib/api/analytics"
import { queryKeys } from "@/lib/query/keys"

// All pure reads, no mutations, no approval-invalidation involvement.
// Long-ish staleTime is reasonable here — these are aggregate reports,
// not row-level data someone's actively editing.
const ANALYTICS_STALE_TIME = 2 * 60 * 1000

export function useSpendAnalytics(params: Parameters<typeof analyticsApi.getSpendAnalytics>[0] = {}) {
    return useQuery({
        queryKey: [...queryKeys.analytics.spend, params],
        queryFn: () => analyticsApi.getSpendAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useBudgetOverview(params: Parameters<typeof analyticsApi.getBudgetOverview>[0] = {}) {
    return useQuery({
        queryKey: [...queryKeys.analytics.budget, params],
        queryFn: () => analyticsApi.getBudgetOverview(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useInventoryAnalytics(params: Parameters<typeof analyticsApi.getInventoryAnalytics>[0] = {}) {
    return useQuery({
        queryKey: [...queryKeys.analytics.inventory, params],
        queryFn: () => analyticsApi.getInventoryAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useBudgetHealth(params: Parameters<typeof analyticsApi.getBudgetHealth>[0] = {}) {
    return useQuery({
        queryKey: [...queryKeys.analytics.budgetHealth, params],
        queryFn: () => analyticsApi.getBudgetHealth(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useLicenseAnalytics(params: Parameters<typeof analyticsApi.getLicenseAnalytics>[0] = {}) {
    return useQuery({
        queryKey: [...queryKeys.analytics.licenses, params],
        queryFn: () => analyticsApi.getLicenseAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useCostBreakdown(params: Parameters<typeof analyticsApi.getCostBreakdown>[0] | undefined) {
    return useQuery({
        queryKey: params ? [...queryKeys.analytics.costBreakdown(params.siteId, params.dateFrom, params.dateTo)] : [],
        queryFn: () => analyticsApi.getCostBreakdown(params!),
        enabled: !!params?.siteId,
    })
}