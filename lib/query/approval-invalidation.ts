import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "./keys"
import * as tasksApi from "@/lib/api/tasks"
import type { Approval, ApprovalType } from "@/types/api"

type QueryKey = readonly unknown[]

// v2 has no single-record GET for inventory-movements/equipment-movements/
// rental-events (only list + create + reverse), so unlike the legacy
// material/equipment logs we can't resolve a settled movement's siteId to
// scope a `sites.summary(id)` invalidation precisely. Trade-off: invalidate
// every open site-summary query instead of a single one — correct, slightly
// wasteful. progress_log/transaction responses carry siteId directly and
// don't need this.
function invalidateAllSiteSummaries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "sites" && query.queryKey[2] === "summary",
  })
}

// Same problem as above, one level deeper: queryKeys.inventories/sites/
// warehouses .materials()/.equipments() are keyed by a specific node/site/
// warehouse id we don't have here (no single-record GET on the movement to
// read it back from), so a settled movement or reversal can't target the
// one location-detail query it actually changed. Sweep every open one of
// these instead — they're the "Inventory Balances"/"Bulk Equipment"/
// "Parked Equipment" tables on the three location-detail pages.
export function invalidateAllLocationInventoryQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      ["inventories", "sites", "warehouses"].includes(query.queryKey[0] as string) &&
      query.queryKey[1] === "detail" &&
      ["materials", "equipment", "bulk-equipment"].includes(query.queryKey[3] as string),
  })
}

// The `/inventory` locations overview reads queryKeys.inventories.list()/
// .detail(id) directly for each node's material/bulk-equipment/equipment
// item counts — a different pair of keys from the .materials()/.equipment()/
// .bulkEquipment() sub-tables the sweep above targets, so it needs its own
// sweep or every movement anywhere leaves that overview's counts stale.
export function invalidateInventoryNodeOverviewQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "inventories" &&
      (query.queryKey[1] === "list" || (query.queryKey[1] === "detail" && query.queryKey.length === 3)),
  })
}

// A warehouse's sold-items overview/logs are their own aggregate over
// `sale`-type movements — same "which warehouse?" problem as the location
// tables above, so sweep every open one rather than trying to thread
// movementType + warehouse id through this generic layer.
function invalidateAllSoldItemsQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "warehouses" &&
      query.queryKey[1] === "detail" &&
      ["sold-items", "sold-equipment", "sold-materials"].includes(query.queryKey[3] as string),
  })
}

// Every analytics endpoint aggregates over movements/transactions/rentals —
// none of the query keys carry a resolvable siteId/warehouseId either, so
// this is the same "invalidate the whole family" trade-off as above rather
// than nothing at all (which is what happened before: analytics never got
// invalidated by any settled action).
export function invalidateAnalytics(queryClient: QueryClient) {
  queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === "analytics",
  })
}

const approvalFanOut: Record<ApprovalType, (recordId: string, siteId?: string) => QueryKey[]> = {
  inventory_movement: () => [
    queryKeys.inventoryMovements.all,
    queryKeys.inventoryBalances.all,
    queryKeys.inventoryItems.all,
    queryKeys.ledgers.all,
    // A purchase/sale carries its own transactionId (same as equipment
    // movements below) — this was missing before, so a material/bulk-
    // equipment purchase never refreshed the transactions list.
    queryKeys.transactions.all,
  ],
  equipment_movement: (recordId) => [
    queryKeys.equipmentMovements.all,
    queryKeys.equipment.lists(),
    queryKeys.equipment.detail(recordId),
    queryKeys.ledgers.all,
    queryKeys.transactions.all,
  ],
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
    siteId ? [queryKeys.sites.tasksAll(siteId), queryKeys.sites.summary(siteId)] : [],
  // recordId here is the rental EVENT's id, not the agreement's — there's no
  // single-record GET to resolve one to the other in v2, so this can only
  // sweep .all rather than target one agreement's .detail() precisely.
  rental_event: () => [
    queryKeys.rentals.all,
    queryKeys.equipmentMovements.all,
    queryKeys.equipment.lists(),
    queryKeys.transactions.all,
    queryKeys.ledgers.all,
  ],
}

const pendingCreationKeys: Record<ApprovalType, QueryKey[]> = {
  inventory_movement: [queryKeys.inventoryMovements.all],
  equipment_movement: [queryKeys.equipmentMovements.all],
  transaction: [queryKeys.transactions.all],
  progress_log: [],
  rental_event: [queryKeys.rentals.all],
}

function invalidate(queryClient: QueryClient, approvalType: ApprovalType, keys: QueryKey[]) {
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
  keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
  if (approvalType === "inventory_movement" || approvalType === "equipment_movement" || approvalType === "rental_event") {
    invalidateAllSiteSummaries(queryClient)
    // inventory_movement covers materials + bulk equipment (same
    // inventory-movements/inventory-balances tables); equipment_movement
    // and rental_event cover individually-tracked equipment. Either way
    // the per-location materials/equipments tables need a refresh.
    invalidateAllLocationInventoryQueries(queryClient)
    invalidateInventoryNodeOverviewQueries(queryClient)
    invalidateAllSoldItemsQueries(queryClient)
  }
  if (approvalType === "inventory_movement" || approvalType === "equipment_movement" || approvalType === "transaction" || approvalType === "rental_event") {
    invalidateAnalytics(queryClient)
  }
}

// For action-endpoint responses (InventoryMovement/IndividualEquipmentMovement/
// SiteTask/rental events/Transaction) — transaction and progress_log already
// carry their own siteId directly, no lookup needed. Used by
// usePurchaseInventoryItem, useClaimSiteTask, etc.
export function onActionSettled(
  queryClient: QueryClient,
  approvalType: ApprovalType,
  recordId: string,
  status: "pending" | "approved" | "rejected",
  siteId?: string
) {
  if (status === "approved") {
    invalidate(queryClient, approvalType, approvalFanOut[approvalType](recordId, siteId))
  } else {
    invalidate(queryClient, approvalType, pendingCreationKeys[approvalType])
  }
}

// For the central Approvals screen (useApproveApproval/useRejectApproval).
// PATCH /api/approvals/[id] returns {data: null} on approve, so the caller
// passes in the approval row it already has (approvalType/recordId) rather
// than reading them back from the response. siteId is only resolvable here
// for progress_log (via tasksApi.getTask) — inventory/equipment movements
// and rental events have no single-record GET in v2, so those fall back to
// the broad invalidateAllSiteSummaries() sweep in invalidate() above.
export async function onApprovalProcessed(
  queryClient: QueryClient,
  approval: Pick<Approval, "approvalType" | "recordId" | "status">
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all })
  if (approval.status !== "approved") return

  let siteId: string | undefined
  try {
    if (approval.approvalType === "progress_log") {
      const { data: task } = await tasksApi.getTask(approval.recordId)
      siteId = task.siteId
    }
  } catch {
    // best-effort — non-site-specific fan-out still runs below
  }

  invalidate(queryClient, approval.approvalType, approvalFanOut[approval.approvalType](approval.recordId, siteId))
}
