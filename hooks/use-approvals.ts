import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as approvalsApi from "@/lib/api/approvals"
import type { ApprovalListParams } from "@/lib/api/approvals"
import { queryKeys } from "@/lib/query/keys"
import { onApprovalProcessed } from "@/lib/query/approval-invalidation"
import { isAdmin, canApproveType, type Role } from "@/lib/auth/permissions"
import type { Approval } from "@/types/api"

export function useApprovals(params: ApprovalListParams = {}) {
    return useQuery({
        queryKey: queryKeys.approvals.list(params),
        queryFn: () => approvalsApi.listApprovals(params),
    })
}

export function useApproval(id: string | undefined) {
    return useQuery({
        queryKey: queryKeys.approvals.detail(id ?? ""),
        queryFn: () => approvalsApi.getApproval(id as string),
        enabled: !!id,
    })
}

// Approve response is {data: null} — we already have the approval row
// (approvalType/recordId) from wherever the user clicked "Approve", so
// that's passed in rather than read back from the response.
export function useApproveApproval() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({
            approval,
            notes,
        }: {
            approval: Pick<Approval, "id" | "approvalType" | "recordId">
            notes?: string
        }) => approvalsApi.processApproval(approval.id, { status: "approved", notes }),
        onSuccess: async (_result, variables) => {
            await onApprovalProcessed(queryClient, { ...variables.approval, status: "approved" })
        },
    })
}

export function useRejectApproval() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
            approvalsApi.processApproval(id, { status: "rejected", notes }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
            // Usually only the approval row itself changed, EXCEPT: rejecting a
            // pending transaction-reversal un-flags the original transaction's
            // isReversed server-side (new_api.md §5) — cheap enough to always
            // invalidate transactions rather than thread approvalType through
            // here just for that one case.
            queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all })
        },
    })
}

// Whether the current user can act on a specific approval. v2 has no
// single-record GET for inventory-movements/equipment-movements/rental-events
// (only list + create + reverse — see docs/new_api.md), so unlike the legacy
// API this can no longer pre-check "does the destination site match one the
// site_manager manages" client-side. That record-level check is enforced
// authoritatively server-side (ApprovalService.assertCanResolve) regardless —
// a site_manager who isn't actually allowed gets a 403 (surfaced via the
// apiClient's toast) when they try. So this now only gates on the type-level
// grant, which is enough to decide whether to *show* the controls at all;
// the server remains the real authority on whether the action succeeds.
export function useCanActOnApproval(approval: Approval | undefined, role: Role | null | undefined) {
    if (!approval) return { canAct: false, isLoading: false }
    if (isAdmin(role)) return { canAct: true, isLoading: false }
    return { canAct: canApproveType(role, approval.approvalType), isLoading: false }
}
