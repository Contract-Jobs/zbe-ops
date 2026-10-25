import { apiClient, type Pagination } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type {
    InventoryMovement,
    InventoryMovementCreatePayload,
    QuantityMovementType,
    Transaction,
    RecordSalePaymentRequest,
    ReverseSalePaymentRequest,
} from "@/types/api"

export type InventoryMovementListParams = ListParams<{
    itemId?: string
    movementType?: QuantityMovementType
    fromDate?: string
    toDate?: string
    isReversal?: string
    includeReversed?: string
    buyerSiteId?: string
    isInternal?: string
    // Sales to a site ticked / not ticked as paid (tracking label only).
    isMarkedPaid?: string
}>

// movementType: "loss" is silently redirected server-side to the
// loss-specific handler (requires metadata.reason) — the generic path
// refuses it outright, so this create fn covers both without a branch.
export function createInventoryMovement(payload: InventoryMovementCreatePayload) {
    return apiClient.post<InventoryMovement>("/api/inventory-movements", payload)
}

// The list has come back in two shapes: a plain array with a top-level
// `pagination`, and `{ movements, total }` under `data` (what the sync doc
// documents). Callers get one shape either way — an array in `data` and a
// `pagination` — so a server change can't crash a page with ".map is not a
// function".
export async function listInventoryMovements(
    params: InventoryMovementListParams = {}
): Promise<{ data: InventoryMovement[]; pagination?: Pagination }> {
    const res = await apiClient.get<InventoryMovement[] | { movements?: InventoryMovement[]; total?: number }>(
        "/api/inventory-movements",
        buildListParams(params)
    )
    const raw = res.data
    if (Array.isArray(raw)) return { data: raw, pagination: res.pagination }

    const movements = raw?.movements ?? []
    const total = raw?.total ?? movements.length
    const page = params.page ?? 1
    const limit = params.limit ?? Math.max(movements.length, 1)
    return {
        data: movements,
        pagination: res.pagination ?? { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
    }
}

export function reverseInventoryMovement(id: string, payload: { notes?: string } = {}) {
    return apiClient.post<InventoryMovement>(`/api/inventory-movements/${id}/reverse`, payload)
}

export function listInventoryMovementPayments(id: string) {
    return apiClient.get<Transaction[]>(`/api/inventory-movements/${id}/payments`)
}

export function recordInventoryMovementPayment(id: string, payload: RecordSalePaymentRequest) {
    return apiClient.post<{ transaction: Transaction; movement: InventoryMovement }>(
        `/api/inventory-movements/${id}/payments`,
        payload
    )
}

export function reverseInventoryMovementPayment(id: string, paymentId: string, payload: ReverseSalePaymentRequest = {}) {
    return apiClient.post<{ reversalTransaction: Transaction; movement: InventoryMovement }>(
        `/api/inventory-movements/${id}/payments/${paymentId}/reverse`,
        payload
    )
}


// Admin/superadmin only. Sales only (not reversed, not a reversal). Changes
// unitCost/totalCost/saleStatus; stock and COGS stay as they were.
export function updateInventoryMovementPrice(
    id: string,
    // vatExempt: charge 0% VAT on this sale (or false to charge it again).
    payload: { unitCost: string; reason?: string; vatExempt?: boolean },
) {
    return apiClient.patch<InventoryMovement>(`/api/inventory-movements/${id}`, payload)
}
