import { useQuery } from "@tanstack/react-query"
import * as inventoryApi from "@/lib/api/inventory"
import type { InventoryBalanceParams } from "@/lib/api/inventory"
import { queryKeys } from "@/lib/query/keys"

export function useInventoryBalances(params: InventoryBalanceParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventory.balances(params),
        queryFn: () => inventoryApi.getInventoryBalances(params),
    })
}

export function useMaterialTrace(catalogId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.inventory.trace(catalogId ?? ""),
        queryFn: () => inventoryApi.traceMaterialHistory(catalogId as string),
        enabled: !!catalogId,
    })
}