import { apiClient } from "./client"
import { buildListParams } from "./list-params"
import type { ListParams } from "./list-params"
import type { Approval } from "@/types/api"

export type ApprovalListParams = ListParams<{ status?: string[]; approvalType?: string[] }>

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