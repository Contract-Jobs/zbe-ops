import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as rentalsApi from "@/lib/api/rentals"
import type { RentalListParams } from "@/lib/api/rentals"
import { queryKeys } from "@/lib/query/keys"
import { onApprovalProcessed } from "@/lib/query/approval-invalidation"
import type { RentalCreatePayload, RentalAdjustPayload, RentalReturnPayload } from "@/types/api"

export function useRentals(params: RentalListParams = {}) {
    return useQuery({
        queryKey: queryKeys.rentals.list(params),
        queryFn: () => rentalsApi.listRentals(params),
    })
}

export function useRental(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.rentals.detail(id ?? ""),
        queryFn: () => rentalsApi.getRental(id as string),
        enabled: !!id,
    })
}

export function useCreateRental() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: RentalCreatePayload) => rentalsApi.createRental(payload),
        onSuccess: ({ data }) => {
            // Rentals' response carries a full Approval object, not just an
            // approvalStatus field — so this goes through onApprovalProcessed
            // (the Approval-shaped path), not onActionSettled.
            onApprovalProcessed(queryClient, data.approval)
            queryClient.invalidateQueries({ queryKey: queryKeys.rentals.lists() })
        },
    })
}

export function useAdjustRental(rentalId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: RentalAdjustPayload) => rentalsApi.adjustRental(rentalId, payload),
        onSuccess: ({ data }) => {
            onApprovalProcessed(queryClient, data.approval)
            queryClient.invalidateQueries({ queryKey: queryKeys.rentals.detail(rentalId) })
        },
    })
}

export function useReturnRental(rentalId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (payload: RentalReturnPayload) => rentalsApi.returnRental(rentalId, payload),
        onSuccess: ({ data }) => {
            onApprovalProcessed(queryClient, data.approval)
            queryClient.invalidateQueries({ queryKey: queryKeys.rentals.detail(rentalId) })
        },
    })
}