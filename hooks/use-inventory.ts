import { useQuery } from "@tanstack/react-query"
import * as inventoryApi from "@/lib/api/inventory"
import type { InventoryBalanceParams } from "@/lib/api/inventory"
import type { ListParams } from "@/lib/api/list-params"
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

export function useInventoryLocations() {
    return useQuery({
        queryKey: queryKeys.inventory.locations(),
        queryFn: () => inventoryApi.getInventoryLocations(),
    })
}

export function useInventoryLocationMaterials(id: string | undefined, params: ListParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventory.locationMaterials(id ?? "", params),
        queryFn: () => inventoryApi.getInventoryLocationMaterials(id as string, params),
        enabled: !!id,
    })
}

export function useInventoryLocationEquipments(id: string | undefined, params: ListParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventory.locationEquipments(id ?? "", params),
        queryFn: () => inventoryApi.getInventoryLocationEquipments(id as string, params),
        enabled: !!id,
    })
}