import { useQueries, useQuery } from "@tanstack/react-query"
import * as analyticsApi from "@/lib/api/analytics"
import { queryKeys } from "@/lib/query/keys"

// All pure reads, no mutations, no approval-invalidation involvement.
// Long-ish staleTime is reasonable here — these are aggregate reports,
// not row-level data someone's actively editing.
const ANALYTICS_STALE_TIME = 2 * 60 * 1000

export function useSpendAnalytics(
    params: Parameters<typeof analyticsApi.getSpendAnalytics>[0] = {},
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: queryKeys.analytics.spend(params),
        queryFn: () => analyticsApi.getSpendAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
        enabled: options.enabled ?? true,
    })
}

export function useBudgetOverview(params: Parameters<typeof analyticsApi.getBudgetOverview>[0] = {}) {
    return useQuery({
        queryKey: queryKeys.analytics.budget(params),
        queryFn: () => analyticsApi.getBudgetOverview(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

export function useInventoryAnalytics(
    params: Parameters<typeof analyticsApi.getInventoryAnalytics>[0] = {},
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: queryKeys.analytics.inventory(params),
        queryFn: () => analyticsApi.getInventoryAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
        enabled: options.enabled ?? true,
    })
}

export function useBudgetHealth(params: Parameters<typeof analyticsApi.getBudgetHealth>[0] = {}) {
    return useQuery({
        queryKey: queryKeys.analytics.budgetHealth(params),
        queryFn: () => analyticsApi.getBudgetHealth(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

// Company money per license: admin only (403 for a site manager), so callers
// pass enabled: false for them.
export function useLicenseAnalytics(
    params: Parameters<typeof analyticsApi.getLicenseAnalytics>[0] = {},
    options: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: queryKeys.analytics.licenses(params),
        queryFn: () => analyticsApi.getLicenseAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
        enabled: options.enabled ?? true,
    })
}

// Admin/superadmin only (company-wide revenue, COGS and every site's balance);
// a site_manager gets 403, so callers pass enabled: false for them.
export function useSalesAnalytics(
    params: Parameters<typeof analyticsApi.getSalesAnalytics>[0] = {},
    options: { enabled?: boolean } = {}
) {
    return useQuery({
        queryKey: queryKeys.analytics.sales(params),
        queryFn: () => analyticsApi.getSalesAnalytics(params),
        staleTime: ANALYTICS_STALE_TIME,
        enabled: options.enabled ?? true,
    })
}

// New in v2, admin/superadmin only — see docs/new_api.md §9.
export function useCompanyFinancials(params: Parameters<typeof analyticsApi.getCompanyFinancials>[0] = {}) {
    return useQuery({
        queryKey: queryKeys.analytics.company(params),
        queryFn: () => analyticsApi.getCompanyFinancials(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

// Admin/superadmin only.
export function useVatReport(params: Parameters<typeof analyticsApi.getVatReport>[0] = {}) {
    return useQuery({
        queryKey: queryKeys.analytics.vat(params),
        queryFn: () => analyticsApi.getVatReport(params),
        staleTime: ANALYTICS_STALE_TIME,
    })
}

// Budget health that is safe for either role. An admin asks once for every
// site. A site manager's call without a siteId only answers for their first
// site (and is refused with no site at all), so it asks per own site and merges.
export function useScopedBudgetHealth(scope: { manager: boolean; siteIds: string[] }) {
    const targets: { siteId?: string }[] = scope.manager ? scope.siteIds.map((siteId) => ({ siteId })) : [{}]
    const results = useQueries({
        queries: targets.map((params) => ({
            queryKey: queryKeys.analytics.budgetHealth(params),
            queryFn: () => analyticsApi.getBudgetHealth(params),
            staleTime: ANALYTICS_STALE_TIME,
        })),
    })
    return { data: results.flatMap((r) => r.data?.data ?? []) }
}
