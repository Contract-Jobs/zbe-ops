import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as equipmentApi from "@/lib/api/equipment"
import type { EquipmentListParams, CreateEquipmentPayload, UpdateEquipmentPayload } from "@/lib/api/equipment"
import { queryKeys } from "@/lib/query/keys"
import { onActionSettled } from "@/lib/query/approval-invalidation"
import type { EquipmentLogAction } from "@/types/api"

export function useEquipmentList(params: EquipmentListParams = {}) {
    return useQuery({
        queryKey: queryKeys.equipment.list(params),
        queryFn: () => equipmentApi.listEquipment(params),
    })
}

export function useEquipment(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.equipment.detail(id ?? ""),
        queryFn: () => equipmentApi.getEquipment(id as string),
        enabled: !!id,
    })
}

export function useCreateEquipment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: CreateEquipmentPayload) => equipmentApi.createEquipment(payload),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() }),
    })
}

export function useUpdateEquipment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateEquipmentPayload }) =>
            equipmentApi.updateEquipment(id, payload),
        onSuccess: (_result, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.equipment.detail(variables.id) })
        },
    })
}

export function useDeleteEquipment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => equipmentApi.deleteEquipment(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.equipment.detail(id) })
        },
    })
}

export function useRestoreEquipment() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => equipmentApi.restoreEquipment(id),
        onSuccess: (_result, id) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.equipment.lists() })
            queryClient.invalidateQueries({ queryKey: queryKeys.equipment.detail(id) })
        },
    })
}

// ---- Actions ----

function useLogAction() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: EquipmentLogAction) => equipmentApi.createEquipmentLog(payload),
        onSuccess: ({ data: log }) => {
            const siteId = log.toSiteId ?? log.fromSiteId ?? undefined
            onActionSettled(queryClient, "equipment_movement", log.id, log.approvalStatus, siteId)
        },
    })
}

type ActionPayload<A extends EquipmentLogAction["action"]> = Omit<Extract<EquipmentLogAction, { action: A }>, "action">

function makeActionHook<A extends EquipmentLogAction["action"]>(action: A) {
    return function useAction() {
        const { mutate, mutateAsync, isPending, error } = useLogAction()
        return {
            mutate: (payload: ActionPayload<A>) => mutate({ action, ...payload } as EquipmentLogAction),
            mutateAsync: (payload: ActionPayload<A>) => mutateAsync({ action, ...payload } as EquipmentLogAction),
            isPending,
            error,
        }
    }
}

export const usePurchaseEquipment = makeActionHook("purchased")
export const useTransferEquipment = makeActionHook("transferred")
export const useSellEquipment = makeActionHook("sold")
export const useConsumeEquipment = makeActionHook("used_up")
export const useReportMissingEquipment = makeActionHook("missing")
export const useMaintenanceDispatch = makeActionHook("maintenance_dispatch")
export const useMaintenanceReturn = makeActionHook("maintenance_return")
export const useDegradeEquipment = makeActionHook("degraded")
export const useAppreciateEquipment = makeActionHook("appreciated")

// ---- Logs list/detail/reverse ----

export function useEquipmentLogs(params: Parameters<typeof equipmentApi.listEquipmentLogs>[0] = {}) {
    return useQuery({
        queryKey: queryKeys.equipment.logs(params),
        queryFn: () => equipmentApi.listEquipmentLogs(params),
    })
}

export function useEquipmentLog(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.equipment.log(id ?? ""),
        queryFn: () => equipmentApi.getEquipmentLog(id as string),
        enabled: !!id,
    })
}

export function useReverseEquipmentLog() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => equipmentApi.reverseEquipmentLog(id),
        onSuccess: ({ data: log }) => {
            const siteId = log.toSiteId ?? log.fromSiteId ?? undefined
            onActionSettled(queryClient, "equipment_movement", log.id, log.approvalStatus, siteId)
        },
    })
}