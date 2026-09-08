import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as materialsApi from "@/lib/api/materials"
import type { MaterialListParams, CreateMaterialPayload, UpdateMaterialPayload } from "@/lib/api/materials"
import { queryKeys } from "@/lib/query/keys"
import { onActionSettled } from "@/lib/query/approval-invalidation"
import type { MaterialLogAction } from "@/types/api"

export function useMaterials(params: MaterialListParams = {}) {
    return useQuery({
        queryKey: queryKeys.materials.list(params),
        queryFn: () => materialsApi.listMaterials(params),
    })
}

export function useMaterial(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.materials.detail(id ?? ""),
        queryFn: () => materialsApi.getMaterial(id as string),
        enabled: !!id,
    })
}

export function useCreateMaterial() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: CreateMaterialPayload) => materialsApi.createMaterial(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.materials.lists() }),
    })
}

export function useUpdateMaterial() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateMaterialPayload }) =>
            materialsApi.updateMaterial(id, payload),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(variables.id) })
        },
    })
}

export function useDeleteMaterial() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => materialsApi.deleteMaterial(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(id) })
        },
    })
}

export function useRestoreMaterial() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => materialsApi.restoreMaterial(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(id) })
        },
    })
}

export function useSubItems(materialId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.materials.subItems(materialId ?? ""),
        queryFn: () => materialsApi.listSubItems(materialId as string),
        enabled: !!materialId,
    })
}

export function useAddSubItem(materialId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: Parameters<typeof materialsApi.addSubItem>[1]) =>
            materialsApi.addSubItem(materialId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.subItems(materialId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(materialId) })
        },
    })
}

export function useUpdateSubItem(materialId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ subItemId, payload }: { subItemId: string; payload: Parameters<typeof materialsApi.updateSubItem>[2] }) =>
            materialsApi.updateSubItem(materialId, subItemId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.subItems(materialId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(materialId) })
        },
    })
}

export function useRemoveSubItem(materialId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (subItemId: string) => materialsApi.removeSubItem(materialId, subItemId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.subItems(materialId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.materials.detail(materialId) })
        },
    })
}

function useLogAction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: MaterialLogAction) => materialsApi.createMaterialLog(payload),
        onSuccess: ({ data: log }) => {
            const siteId = log.toSiteId ?? log.fromSiteId ?? undefined
            onActionSettled(queryClient, "material_movement", log.id, log.approvalStatus, siteId)
        },
    })
}

type ActionPayload<A extends MaterialLogAction["action"]> = Omit<Extract<MaterialLogAction, { action: A }>, "action">

export function usePurchaseMaterial() {
    const { mutate, mutateAsync, isPending, error } = useLogAction()
    return {
        mutate: (payload: ActionPayload<"purchase">) => mutate({ action: "purchase", ...payload }),
        mutateAsync: (payload: ActionPayload<"purchase">) => mutateAsync({ action: "purchase", ...payload }),
        isPending,
        error,
    }
}

export function useTransferMaterial() {
    const { mutate, mutateAsync, isPending, error } = useLogAction()
    return {
        mutate: (payload: ActionPayload<"transfer">) => mutate({ action: "transfer", ...payload }),
        mutateAsync: (payload: ActionPayload<"transfer">) => mutateAsync({ action: "transfer", ...payload }),
        isPending,
        error,
    }
}

export function useSellMaterial() {
    const { mutate, mutateAsync, isPending, error } = useLogAction()
    return {
        mutate: (payload: ActionPayload<"sold">) => mutate({ action: "sold", ...payload }),
        mutateAsync: (payload: ActionPayload<"sold">) => mutateAsync({ action: "sold", ...payload }),
        isPending,
        error,
    }
}

export function useConsumeMaterial() {
    const { mutate, mutateAsync, isPending, error } = useLogAction()
    return {
        mutate: (payload: ActionPayload<"used_up">) => mutate({ action: "used_up", ...payload }),
        mutateAsync: (payload: ActionPayload<"used_up">) => mutateAsync({ action: "used_up", ...payload }),
        isPending,
        error,
    }
}

export function useReportMissingMaterial() {
    const { mutate, mutateAsync, isPending, error } = useLogAction()
    return {
        mutate: (payload: ActionPayload<"missing">) => mutate({ action: "missing", ...payload }),
        mutateAsync: (payload: ActionPayload<"missing">) => mutateAsync({ action: "missing", ...payload }),
        isPending,
        error,
    }
}

export function useMaterialLogs(params: Parameters<typeof materialsApi.listMaterialLogs>[0] = {}) {
    return useQuery({
        queryKey: queryKeys.materials.logs(params),
        queryFn: () => materialsApi.listMaterialLogs(params),
    })
}

export function useMaterialLog(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.materials.log(id ?? ""),
        queryFn: () => materialsApi.getMaterialLog(id as string),
        enabled: !!id,
    })
}

export function useReverseMaterialLog() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => materialsApi.reverseMaterialLog(id),
        onSuccess: ({ data: log }) => {
            const siteId = log.toSiteId ?? log.fromSiteId ?? undefined
            onActionSettled(queryClient, "material_movement", log.id, log.approvalStatus, siteId)
        },
    })
}