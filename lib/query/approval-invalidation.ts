import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "./keys"
import * as materialsApi from "@/lib/api/materials"
import * as equipmentApi from "@/lib/api/equipment"
import * as tasksApi from "@/lib/api/tasks"
import type { Approval, ApprovalType } from "@/types/api"

type QueryKey = readonly unknown[]

const approvalFanOut: Record<ApprovalType, (recordId: string, siteId?: string) => QueryKey[]> = {
  material_movement: (recordId, siteId) => {
    const keys: QueryKey[] = [
      queryKeys.materials.logs(),
      queryKeys.materials.log(recordId),
      queryKeys.materials.lists(),
      queryKeys.inventory.balances(),
      queryKeys.ledgers.all,
    ]
    if (siteId) keys.push(queryKeys.sites.summary(siteId))
    return keys
  },
  equipment_movement: (recordId, siteId) => {
    const keys: QueryKey[] = [
      queryKeys.equipment.logs(),
      queryKeys.equipment.log(recordId),
      queryKeys.equipment.lists(),
      queryKeys.equipment.detail(recordId),
      queryKeys.ledgers.all,
      queryKeys.transactions.all,
    ]
    if (siteId) keys.push(queryKeys.sites.summary(siteId))
    return keys
  },
  transaction: (recordId, siteId) => {
    const keys: QueryKey[] = [
      queryKeys.transactions.all,
      queryKeys.transactions.detail(recordId),
      queryKeys.ledgers.all,
    ]
    if (siteId) keys.push(queryKeys.sites.summary(siteId))
    return keys
  },
  progress_log: (recordId, siteId) =>
    siteId ? [queryKeys.sites.tasks(siteId), queryKeys.sites.summary(siteId)] : [],
  rental_event: (recordId) => [
    queryKeys.rentals.all,
    queryKeys.rentals.detail(recordId),
    queryKeys.equipment.all,
    queryKeys.transactions.all,
    queryKeys.ledgers.all,
  ],
}

const pendingCreationKeys: Record<ApprovalType, QueryKey[]> = {
  material_movement: [queryKeys.materials.logs()],
  equipment_movement: [queryKeys.equipment.logs()],
  transaction: [queryKeys.transactions.all],
  progress_log: [],
  rental_event: [queryKeys.rentals.all],
}

function invalidate(queryClient: QueryClient, keys: QueryKey[]) {
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
  keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
}

// For action-endpoint responses (MaterialLog/EquipmentLog/SiteTask/rental
// events/Transaction) — these already carry their own siteId fields
// directly, no lookup needed. Used by usePurchaseMaterial, useClaimTask, etc.
export function onActionSettled(
  queryClient: QueryClient,
  approvalType: ApprovalType,
  recordId: string,
  status: "pending" | "approved" | "rejected",
  siteId?: string
) {
  if (status === "approved") {
    invalidate(queryClient, approvalFanOut[approvalType](recordId, siteId))
  } else {
    invalidate(queryClient, pendingCreationKeys[approvalType])
  }
}

// For the central Approvals screen (useApproveApproval/useRejectApproval).
// PATCH /api/approvals/[id] returns {data: null} on approve, so the caller
// passes in the approval row it already has (approvalType/recordId) rather
// than reading them back from the response. If approved, resolves siteId
// by fetching the underlying record via the now-real flat endpoints
// (getMaterialLog / getEquipmentLog / tasksApi.getTask).
export async function onApprovalProcessed(
  queryClient: QueryClient,
  approval: Pick<Approval, "approvalType" | "recordId" | "status">
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
  if (approval.status !== "approved") return

  let siteId: string | undefined
  try {
    if (approval.approvalType === "material_movement") {
      const { data: log } = await materialsApi.getMaterialLog(approval.recordId)
      siteId = log.toSiteId ?? log.fromSiteId ?? undefined
    } else if (approval.approvalType === "equipment_movement") {
      const { data: log } = await equipmentApi.getEquipmentLog(approval.recordId)
      siteId = log.toSiteId ?? log.fromSiteId ?? undefined
    } else if (approval.approvalType === "progress_log") {
      const { data: task } = await tasksApi.getTask(approval.recordId)
      siteId = task.siteId
    }
  } catch {
    // best-effort — non-site-specific fan-out still runs below
  }

  approvalFanOut[approval.approvalType](approval.recordId, siteId).forEach((key) =>
    queryClient.invalidateQueries({ queryKey: key })
  )
}