// Turns a SimpleCrudApi + its query-key set into six ready-to-use hooks.
// Internals are generic; each resource's own hook file (use-licenses.ts,
// etc.) exports the results under domain-specific names — the generic
// factory itself is never what your coworker imports directly.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { SimpleCrudApi } from "@/lib/api/simple-crud"
import type { ListParams } from "@/lib/api/list-params"

interface SimpleCrudKeys {
    lists: () => readonly unknown[]
    list: (params?: unknown) => readonly unknown[]
    detail: (id: string) => readonly unknown[]
}

export function createSimpleCrudHooks<T, TCreate, TUpdate = Partial<TCreate>>(
    api: SimpleCrudApi<T, TCreate, TUpdate>,
    keys: SimpleCrudKeys
) {
    function useList(params: ListParams = {}) {
        return useQuery({
            queryKey: keys.list(params),
            queryFn: () => api.list(params),
        })
    }

    function useDetail(id: string | undefined) {
        return useQuery({
            queryKey: keys.detail(id ?? ""),
            queryFn: () => api.get(id as string),
            enabled: !!id,
        })
    }

    function useCreate() {
        const queryClient = useQueryClient()
        return useMutation({
            mutationFn: (payload: TCreate) => api.create(payload),
            onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.lists() }),
        })
    }

    function useUpdate() {
        const queryClient = useQueryClient()
        return useMutation({
            mutationFn: ({ id, payload }: { id: string; payload: TUpdate }) => api.update(id, payload),
            onSuccess: (_result, variables) => {
                queryClient.invalidateQueries({ queryKey: keys.lists() })
                queryClient.invalidateQueries({ queryKey: keys.detail(variables.id) })
            },
        })
    }

    function useDelete() {
        const queryClient = useQueryClient()
        return useMutation({
            mutationFn: (id: string) => api.delete(id),
            onSuccess: (_result, id) => {
                queryClient.invalidateQueries({ queryKey: keys.lists() })
                queryClient.invalidateQueries({ queryKey: keys.detail(id) })
            },
        })
    }

    function useRestore() {
        const queryClient = useQueryClient()
        return useMutation({
            mutationFn: (id: string) => api.restore(id),
            onSuccess: (_result, id) => {
                queryClient.invalidateQueries({ queryKey: keys.lists() })
                queryClient.invalidateQueries({ queryKey: keys.detail(id) })
            },
        })
    }

    return { useList, useDetail, useCreate, useUpdate, useDelete, useRestore }
}