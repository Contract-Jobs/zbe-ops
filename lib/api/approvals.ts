import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Approval, BulkApprovalResult } from "@/types/api"

export type ApprovalListParams = ListParams<{
    status?: string[]
    approvalType?: string[]
    // User ids. approvedBy is whoever resolved it (approver or rejecter).
    submittedBy?: string[]
    approvedBy?: string[]
    // The approval(s) for one movement / transaction / etc.
    recordId?: string[]
    // On when it was submitted (createdAt). A date-only dateTo includes that day.
    dateFrom?: string
    dateTo?: string
    // On when it was last updated, i.e. resolved for approved / rejected rows.
    resolvedFrom?: string
    resolvedTo?: string
}>

export type ApprovalSortBy = "createdAt" | "updatedAt" | "status" | "approvalType"

export function listApprovals(params: ApprovalListParams = {}) {
    return apiClient.get<Approval[]>("/api/approvals", buildListParams(params))
}

export function getApproval(id: string) {
    return apiClient.get<Approval>(`/api/approvals/${id}`)
}

// Response is {data: null} when approved, {data: Approval} when rejected —
// callers must already have the approval's approvalType/recordId in hand
// (they clicked "Approve" on a row they already have), since it can't be
// read back from this response.
export function processApproval(id: string, payload: { status: "approved" | "rejected"; notes?: string }) {
    return apiClient.patch<Approval | null>(`/api/approvals/${id}`, payload)
}

export const BULK_APPROVAL_LIMIT = 100

// Same rules as processApproval, checked per approval and applied oldest
// first. atomic:false (default) reports failures per row and lets the rest
// through; atomic:true rolls the whole batch back on the first failure.
export function bulkProcessApprovals(payload: {
    approvalIds: string[]
    status: "approved" | "rejected"
    notes?: string
    atomic?: boolean
}) {
    return apiClient.post<BulkApprovalResult>("/api/approvals/bulk", payload)
}
