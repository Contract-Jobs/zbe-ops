import { useQuery } from "@tanstack/react-query"
import * as ledgersApi from "@/lib/api/ledgers"
import type { LedgerListParams } from "@/lib/api/ledgers"
import { queryKeys } from "@/lib/query/keys"

export function useLedgers(params: LedgerListParams = {}) {
    return useQuery({
        queryKey: queryKeys.ledgers.list(params),
        queryFn: () => ledgersApi.listLedgers(params),
    })
}