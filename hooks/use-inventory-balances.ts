import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as balancesApi from "@/lib/api/inventory-balances"
import type { InventoryBalanceParams } from "@/lib/api/inventory-balances"
import { queryKeys } from "@/lib/query/keys"
import { invalidateAllLocationInventoryQueries, invalidateInventoryNodeOverviewQueries } from "@/lib/query/approval-invalidation"

export function useInventoryBalances(params: InventoryBalanceParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventoryBalances.list(params),
        queryFn: () => balancesApi.getInventoryBalances(params),
    })
}

// Drill-down used to find the specific movement to reverse — there is no
// direct balance "adjust" action in v2 (docs/migration.md §3.1).
export function useBalanceMovements(params: { itemId: string; inventoryId: string; includeReversed?: boolean } | undefined) {
    return useQuery({
        queryKey: queryKeys.inventoryBalances.movements(params),
        queryFn: () => balancesApi.getBalanceMovements(params!),
        enabled: !!params?.itemId && !!params?.inventoryId,
    })
}

export function useVerifyInventoryBalance(itemId: string | undefined, inventoryId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.inventoryBalances.verify(itemId ?? "", inventoryId ?? ""),
        queryFn: () => balancesApi.verifyInventoryBalance({ itemId: itemId as string, inventoryId: inventoryId as string }),
        enabled: !!itemId && !!inventoryId,
    })
}

// Superadmin/admin recovery tool — recomputes every balance from the
// movement ledger from scratch.
export function useRebuildInventoryBalances() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: () => balancesApi.rebuildInventoryBalances(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryBalances.all })
            // A full rebuild changes every item's totalQuantity/totalValue and
            // every location's per-node tables/counts, not just the flat
            // balances list.
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.all })
            invalidateAllLocationInventoryQueries(queryClient)
            invalidateInventoryNodeOverviewQueries(queryClient)
        },
    })
}
