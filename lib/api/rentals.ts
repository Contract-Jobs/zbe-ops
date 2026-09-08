// import { apiClient } from "./client"
// import { buildListParams } from "./list-params"
// import type { ListParams } from "./list-params"
// import type {
//     RentalAgreement,
//     RentalEvent,
//     Approval,
//     RentalCreatePayload,
//     RentalAdjustPayload,
//     RentalReturnPayload,
// } from "@/types/api"

// export type RentalListParams = ListParams<{
//     siteId?: string
//     licenseId?: string
//     equipmentId?: string
//     status?: string
// }>

// export function listRentals(params: RentalListParams = {}) {
//     return apiClient.get<RentalAgreement[]>("/api/rentals", buildListParams(params))
// }

// export function getRental(id: string) {
//     return apiClient.get<RentalAgreement>(`/api/rentals/${id}`)
// }

// // Note the response shapes here differ from Materials/Equipment — these
// // return a nested { agreement/event, approval } object rather than a single
// // record with its own approvalStatus field, per the doc.
// export function createRental(payload: RentalCreatePayload) {
//     return apiClient.post<{ agreement: RentalAgreement; event: RentalEvent; approval: Approval }>(
//         "/api/rentals",
//         payload
//     )
// }

// export function adjustRental(id: string, payload: RentalAdjustPayload) {
//     return apiClient.post<{ event: RentalEvent; approval: Approval }>(`/api/rentals/${id}/adjust`, payload)
// }

// export function returnRental(id: string, payload: RentalReturnPayload) {
//     return apiClient.post<{ event: RentalEvent; approval: Approval }>(`/api/rentals/${id}/return`, payload)
// }

import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type {
    RentalAgreement,
    RentalEvent,
    Approval,
    RentalCreatePayload,
    RentalAdjustPayload,
    RentalReturnPayload,
} from "@/types/api"

export type RentalListParams = ListParams<{
    siteId?: string[]
    licenseId?: string[]
    equipmentId?: string[]
    status?: string[]
    type?: string[]
}>

export function listRentals(params: RentalListParams = {}) {
    return apiClient.get<RentalAgreement[]>("/api/rentals", buildListParams(params))
}

export function getRental(id: string) {
    return apiClient.get<RentalAgreement>(`/api/rentals/${id}`)
}

// Response shapes differ from Materials/Equipment — these return a nested
// { agreement/event, approval } object rather than a single record with
// its own approvalStatus field, per the doc.
export function createRental(payload: RentalCreatePayload) {
    return apiClient.post<{ agreement: RentalAgreement; event: RentalEvent; approval: Approval }>(
        "/api/rentals",
        payload
    )
}

export function adjustRental(id: string, payload: RentalAdjustPayload) {
    return apiClient.post<{ event: RentalEvent; approval: Approval }>(`/api/rentals/${id}/adjust`, payload)
}

export function returnRental(id: string, payload: RentalReturnPayload) {
    return apiClient.post<{ event: RentalEvent; approval: Approval }>(`/api/rentals/${id}/return`, payload)
}