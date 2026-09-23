import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as movementsApi from "@/lib/api/equipment-movements"
import type { EquipmentMovementListParams } from "@/lib/api/equipment-movements"
import { queryKeys } from "@/lib/query/keys"
import { onActionSettled } from "@/lib/query/approval-invalidation"
import type { EquipmentMovementCreatePayload } from "@/types/api"

function useCreateMovement() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: EquipmentMovementCreatePayload) => movementsApi.createEquipmentMovement(payload),
        onSuccess: ({ data: movement }) => {
            // The fan-out's equipment.detail()/.trace() keys are keyed by the
            // EQUIPMENT's id, not the movement's own id — passing movement.id
            // here built a cache key nothing ever reads, silently leaving
            // /equipment/[id] stale after every purchase/transfer/sale/etc.
            onActionSettled(queryClient, "equipment_movement", movement.individualItemId, movement.isApproved ? "approved" : "pending")
        },
    })
}

type MovementPayload<T extends EquipmentMovementCreatePayload["movementType"]> = Omit<
    Extract<EquipmentMovementCreatePayload, { movementType: T }>,
    "movementType"
>

function typedMovement<T extends EquipmentMovementCreatePayload["movementType"]>(movementType: T) {
    const { mutate, mutateAsync, isPending, error } = useCreateMovement()
    return {
        mutate: (payload: MovementPayload<T>) => mutate({ movementType, ...payload } as EquipmentMovementCreatePayload),
        mutateAsync: (payload: MovementPayload<T>) =>
            mutateAsync({ movementType, ...payload } as EquipmentMovementCreatePayload),
        isPending,
        error,
    }
}

export function usePurchaseEquipment() {
    return typedMovement("purchase")
}

// The legacy single "transfer" action splits into four v2 movement types,
// chosen by source/destination node type — see
// docs/api-v2-migration-plan.md §3.2. destinationInventoryId is a real
// inventory NODE id (hooks/use-inventories.ts), not a site/warehouse id.
export function useDeployToSite() {
    return typedMovement("deploy_to_site")
}

export function useReturnToWarehouse() {
    return typedMovement("return_to_warehouse")
}

export function useTransferBetweenSites() {
    return typedMovement("transfer_between_sites")
}

export function useTransferBetweenWarehouses() {
    return typedMovement("transfer_between_warehouses")
}

export function useSendToMaintenance() {
    return typedMovement("send_to_maintenance")
}

export function useReturnFromMaintenance() {
    return typedMovement("return_from_maintenance")
}

export function useSellEquipment() {
    return typedMovement("sale")
}

export function useDisposeEquipment() {
    return typedMovement("dispose")
}

// Subtract-only, clamped at zero — v2 has no equipment-appreciation
// movement (docs/migration.md §3.2).
export function useDegradeEquipment() {
    return typedMovement("degrade")
}

export function useEquipmentMovements(params: EquipmentMovementListParams = {}) {
    return useQuery({
        queryKey: queryKeys.equipmentMovements.list(params),
        queryFn: () => movementsApi.listEquipmentMovements(params),
    })
}

export function useReverseEquipmentMovement() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, notes }: { id: string; notes?: string }) => movementsApi.reverseEquipmentMovement(id, { notes }),
        onSuccess: ({ data: movement }) => {
            onActionSettled(queryClient, "equipment_movement", movement.individualItemId, "approved")
        },
    })
}
