import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as movementsApi from "@/lib/api/inventory-movements"
import type { InventoryMovementListParams } from "@/lib/api/inventory-movements"
import { queryKeys } from "@/lib/query/keys"
import { onActionSettled } from "@/lib/query/approval-invalidation"
import type { InventoryMovementCreatePayload } from "@/types/api"

function useCreateMovement() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: InventoryMovementCreatePayload) => movementsApi.createInventoryMovement(payload),
        onSuccess: ({ data: movement }) => {
            onActionSettled(queryClient, "inventory_movement", movement.id, movement.isApproved ? "approved" : "pending")
        },
    })
}

type MovementPayload<T extends InventoryMovementCreatePayload["movementType"]> = Omit<
    Extract<InventoryMovementCreatePayload, { movementType: T }>,
    "movementType"
>

function typedMovement<T extends InventoryMovementCreatePayload["movementType"]>(movementType: T) {
    const { mutate, mutateAsync, isPending, error } = useCreateMovement()
    return {
        mutate: (payload: MovementPayload<T>) =>
            mutate({ movementType, ...payload } as unknown as InventoryMovementCreatePayload),
        mutateAsync: (payload: MovementPayload<T>) =>
            mutateAsync({ movementType, ...payload } as unknown as InventoryMovementCreatePayload),
        isPending,
        error,
    }
}

export function usePurchaseInventoryItem() {
    return typedMovement("purchase")
}

export function useTransferInventoryItem() {
    return typedMovement("transfer")
}

export function useSellInventoryItem() {
    return typedMovement("sale")
}

export function useConsumeInventoryItem() {
    return typedMovement("consume")
}

// The only way to create a "loss" movement — requires metadata.reason.
export function useLogInventoryLoss() {
    return typedMovement("loss")
}

export function useInventoryMovements(params: InventoryMovementListParams = {}) {
    return useQuery({
        queryKey: queryKeys.inventoryMovements.list(params),
        queryFn: () => movementsApi.listInventoryMovements(params),
    })
}

// Commits immediately — no approval staging, unlike creation.
export function useReverseInventoryMovement() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, notes }: { id: string; notes?: string }) => movementsApi.reverseInventoryMovement(id, { notes }),
        onSuccess: ({ data: movement }) => {
            onActionSettled(queryClient, "inventory_movement", movement.id, "approved")
        },
    })
}
