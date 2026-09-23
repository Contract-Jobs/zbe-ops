import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as rentalsApi from "@/lib/api/rentals"
import type { RentalListParams, RentalEventListParams } from "@/lib/api/rentals"
import { queryKeys } from "@/lib/query/keys"
import { onApprovalProcessed } from "@/lib/query/approval-invalidation"
import type { RentalCreatePayload, RentalAdjustPayload, RentalReturnPayload } from "@/types/api"
import type { ListParams } from "@/lib/api/list-params"

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

export function useRentalEvents(id: string | undefined, params: ListParams = {}) {
    return useQuery({
        queryKey: [...queryKeys.rentals.detail(id ?? ""), "events", params],
        queryFn: () => rentalsApi.getRentalEvents(id as string, params),
        enabled: !!id,
    })
}

// Flat listing across every agreement — for an all-events view, not scoped
// to one rental's detail page.
export function useAllRentalEvents(params: RentalEventListParams = {}) {
    return useQuery({
        queryKey: queryKeys.rentals.allEvents(params),
        queryFn: () => rentalsApi.listAllRentalEvents(params),
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