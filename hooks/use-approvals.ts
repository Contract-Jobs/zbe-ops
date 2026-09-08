import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import * as approvalsApi from "@/lib/api/approvals"
import * as materialsApi from "@/lib/api/materials"
import * as equipmentApi from "@/lib/api/equipment"
import type { ApprovalListParams } from "@/lib/api/approvals"
import { queryKeys } from "@/lib/query/keys"
import { onApprovalProcessed } from "@/lib/query/approval-invalidation"
import { isAdmin, isSiteManager, canApproveType, type Role } from "@/lib/auth/permissions"
import { useSites } from "./use-sites"
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
            // rejection returns {data: Approval}, but nothing downstream changed
            // — only the approval row itself — so a flat invalidate is enough
            queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
        },
    })
}

// Whether the current user can act on a specific approval — combines the
// cheap type check above with the record-level toSiteId check the backend
// actually enforces for Site Managers. Admins short-circuit immediately;
// Site Managers require fetching the underlying record plus their own
// site list (which the backend already scopes to "sites I manage" for a
// Site Manager's own GET /api/sites call — no extra filtering needed here).
export function useCanActOnApproval(
    approval: Approval | undefined,
    role: Role | null | undefined
) {
    const typeAllowed = approval ? canApproveType(role, approval.approvalType) : false
    const needsRecordCheck = typeAllowed && isSiteManager(role) && !!approval

    const recordQuery = useQuery({
        queryKey: ["approval-target-site", approval?.approvalType, approval?.recordId],
        queryFn: async () => {
            if (approval!.approvalType === "material_movement") {
                const { data } = await materialsApi.getMaterialLog(approval!.recordId)
                return data.toSiteId
            }
            const { data } = await equipmentApi.getEquipmentLog(approval!.recordId)
            return data.toSiteId
        },
        enabled: needsRecordCheck,
    })

    const managedSites = useSites({})

    if (!approval) return { canAct: false, isLoading: false }
    if (isAdmin(role)) return { canAct: true, isLoading: false }
    if (!typeAllowed) return { canAct: false, isLoading: false }

    const isLoading = recordQuery.isLoading || managedSites.isLoading
    const targetSiteId = recordQuery.data
    const canAct = !!targetSiteId && !!managedSites.data?.data.some((s) => s.id === targetSiteId)

    return { canAct, isLoading }
}