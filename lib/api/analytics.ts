import { apiClient } from "./client"
import type {
    SpendAnalytics,
    BudgetOverview,
    InventoryAnalytics,
    BudgetHealthEntry,
    LicenseAnalytics,
    SalesAnalytics,
    CompanyFinancialSummary,
} from "@/types/api"

interface DateRangeParams {
    dateFrom?: string
    dateTo?: string
}

function toSearchParams<T extends object>(params: T): URLSearchParams {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
        if (value !== undefined && value !== null && value !== "") {
            search.append(key, String(value))
        }
    }
    return search
}

// Site Managers are restricted to their own site server-side regardless of
// what's passed here — siteId only meaningfully narrows results for Admins.
export function getSpendAnalytics(params: { siteId?: string } & DateRangeParams = {}) {
    return apiClient.get<SpendAnalytics>("/api/analytics/spend", toSearchParams(params))
}

export function getBudgetOverview(params: { siteId?: string } = {}) {
    return apiClient.get<BudgetOverview>("/api/analytics/budget", toSearchParams(params))
}

export function getInventoryAnalytics(
    params: { siteId?: string; warehouseId?: string; materialId?: string; licenseId?: string } & DateRangeParams = {}
) {
    return apiClient.get<InventoryAnalytics>("/api/analytics/inventory", toSearchParams(params))
}

export function getBudgetHealth(params: { siteId?: string } = {}) {
    return apiClient.get<BudgetHealthEntry[]>("/api/analytics/budget-health", toSearchParams(params))
}

export function getLicenseAnalytics(params: DateRangeParams = {}) {
    return apiClient.get<LicenseAnalytics[]>("/api/analytics/licenses", toSearchParams(params))
}

// Cost breakdown moved to /api/ledgers/cost-breakdown in v2 — see lib/api/ledgers.ts.

export function getSalesAnalytics(params: { warehouseId?: string; licenseId?: string } & DateRangeParams = {}) {
    return apiClient.get<SalesAnalytics>("/api/analytics/sales", toSearchParams(params))
}

// New in v2, admin/superadmin only — no legacy equivalent.
export function getCompanyFinancials(params: { licenseId?: string } & DateRangeParams = {}) {
    return apiClient.get<CompanyFinancialSummary>("/api/analytics/company", toSearchParams(params))
}