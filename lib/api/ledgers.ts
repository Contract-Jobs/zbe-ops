import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { ProjectLedger, CostBreakdown, VerifyLedgerResult } from "@/types/api"

export type LedgerListParams = ListParams<{
    siteId?: string[]
    licenseId?: string[]
    sourceRefType?: string[]
    isReversal?: string[]
    loggedBy?: string[]
}>

export function listLedgers(params: LedgerListParams = {}) {
    return apiClient.get<ProjectLedger[]>("/api/ledgers", buildListParams(params))
}

// Lives under /api/ledgers, not /api/analytics — see docs/new_api.md §7.
export function getCostBreakdown(params: { siteId: string; dateFrom?: string; dateTo?: string }) {
    const search = new URLSearchParams()
    search.set("siteId", params.siteId)
    if (params.dateFrom) search.set("dateFrom", params.dateFrom)
    if (params.dateTo) search.set("dateTo", params.dateTo)
    return apiClient.get<CostBreakdown>("/api/ledgers/cost-breakdown", search)
}

// Admin/superadmin only — wipes and replays one site's ledger from every
// source event. Heavy recovery tool, not routine UI action.
export function rebuildSiteLedger(siteId: string) {
    return apiClient.post<{ rebuilt: true }>(`/api/ledgers/${siteId}/rebuild`)
}

export function verifySiteLedger(siteId: string) {
    return apiClient.get<VerifyLedgerResult>(`/api/ledgers/${siteId}/verify`)
}