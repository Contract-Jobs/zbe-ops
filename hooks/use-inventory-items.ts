import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as itemsApi from "@/lib/api/inventory-items"
import type { InventoryItemListParams, CreateInventoryItemPayload, UpdateInventoryItemPayload, ItemBalancesParams, ItemHistoryParams } from "@/lib/api/inventory-items"
import { queryKeys } from "@/lib/query/keys"

export function useInventoryItems(params: InventoryItemListParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventoryItems.list(params),
        queryFn: () => itemsApi.listInventoryItems(params),
    })
}

export function useInventoryItem(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.inventoryItems.detail(id ?? ""),
        queryFn: () => itemsApi.getInventoryItem(id as string),
        enabled: !!id,
    })
}

export function useCreateInventoryItem() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: CreateInventoryItemPayload) => itemsApi.createInventoryItem(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.lists() }),
    })
}

export function useUpdateInventoryItem() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateInventoryItemPayload }) =>
            itemsApi.updateInventoryItem(id, payload),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.detail(variables.id) })
        },
    })
}

export function useDeleteInventoryItem() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => itemsApi.deleteInventoryItem(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.detail(id) })
        },
    })
}

export function useRestoreInventoryItem() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => itemsApi.restoreInventoryItem(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.detail(id) })
        },
    })
}

export function useItemBalances(id: string | undefined, params: ItemBalancesParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventoryItems.balances(id ?? "", params),
        queryFn: () => itemsApi.getItemBalances(id as string, params),
        enabled: !!id,
    })
}

export function useItemHistory(id: string | undefined, params: ItemHistoryParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventoryItems.history(id ?? "", params),
        queryFn: () => itemsApi.getItemHistory(id as string, params),
        enabled: !!id,
    })
}

export function useSubitems(itemId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.inventoryItems.subitems(itemId ?? ""),
        queryFn: () => itemsApi.listSubitems(itemId as string),
        enabled: !!itemId,
    })
}

export function useAddSubitem(itemId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: Parameters<typeof itemsApi.addSubitem>[1]) => itemsApi.addSubitem(itemId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.subitems(itemId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.detail(itemId) })
        },
    })
}

export function useUpdateSubitem(itemId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ subitemId, payload }: { subitemId: string; payload: Parameters<typeof itemsApi.updateSubitem>[2] }) =>
            itemsApi.updateSubitem(itemId, subitemId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.subitems(itemId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.detail(itemId) })
        },
    })
}

export function useRemoveSubitem(itemId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (subitemId: string) => itemsApi.removeSubitem(itemId, subitemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.subitems(itemId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.inventoryItems.detail(itemId) })
        },
    })
}
