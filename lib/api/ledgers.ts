import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { ProjectLedger } from "@/types/api"

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