// Single source of truth for "what changes when an approval settles."
// Every action mutation (purchase/transfer/sell/consume/report-missing,
// equipment actions, rentals, manual transactions, task claim) and the
// explicit approve/reject hooks all funnel through the two functions below —
// nobody hand-writes invalidation logic anywhere else.

import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import type { Approval, ApprovalType } from "@/types/api";

type QueryKey = readonly unknown[];

// Fan-out per approvalType, confirmed against the backend's documented
// side-effect list. Runs identically whether the action was manually
// approved later, or auto-approved instantly for an Admin/Superadmin —
// the two are indistinguishable once the response comes back.
const approvalFanOut: Record<ApprovalType, (approval: Approval) => QueryKey[]> =
  {
    material_movement: (approval) => {
      const keys: QueryKey[] = [
        queryKeys.materials.logs(),
        queryKeys.materials.log(approval.targetId),
        queryKeys.materials.lists(), // totalQuantity can change
        queryKeys.inventory.balances(),
        queryKeys.ledgers.all,
      ];
      const siteId = extractSiteId(approval);
      if (siteId) keys.push(queryKeys.sites.summary(siteId));
      return keys;
    },

    equipment_movement: (approval) => {
      const keys: QueryKey[] = [
        queryKeys.equipment.logs(),
        queryKeys.equipment.log(approval.targetId),
        queryKeys.equipment.lists(),
        queryKeys.equipment.detail(approval.targetId),
        queryKeys.ledgers.all,
        queryKeys.transactions.all, // maintenance can auto-generate a transaction
      ];
      const siteId = extractSiteId(approval);
      if (siteId) keys.push(queryKeys.sites.summary(siteId));
      return keys;
    },

    transaction: (approval) => [
      queryKeys.transactions.all,
      queryKeys.transactions.detail(approval.targetId),
      queryKeys.ledgers.all,
    ],

    progress_log: (approval) => {
      const siteId = extractSiteId(approval);
      return siteId
        ? [queryKeys.sites.tasks(siteId), queryKeys.sites.summary(siteId)]
        : [];
    },

    rental_event: (approval) => [
      queryKeys.rentals.all,
      queryKeys.rentals.detail(approval.targetId),
      queryKeys.equipment.all,
      queryKeys.transactions.all,
      queryKeys.ledgers.all,
    ],
  };

// While still pending, the underlying log/record already exists in the DB
// the moment the action is submitted — refresh its list even before a
// decision is made, per the earlier catch that pending isn't a no-op.
const pendingCreationKeys: Record<ApprovalType, QueryKey[]> = {
  material_movement: [queryKeys.materials.logs()],
  equipment_movement: [queryKeys.equipment.logs()],
  transaction: [queryKeys.transactions.all],
  progress_log: [], // the task's own response already reflects "claimed" — no separate log resource
  rental_event: [queryKeys.rentals.all],
};

function invalidate(queryClient: QueryClient, keys: QueryKey[]) {
  queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
  keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
}

// Call from every action mutation's onSuccess — purchase/transfer/sell/
// consume/report-missing, equipment actions, rentals, manual transactions,
// task claim. Same call regardless of who performed it or what role they have.
export function onActionSettled(queryClient: QueryClient, approval: Approval) {
  if (approval.status === "approved") {
    invalidate(queryClient, approvalFanOut[approval.approvalType](approval));
  } else {
    invalidate(queryClient, pendingCreationKeys[approval.approvalType]);
  }
}

// Call from useApproveApproval / useRejectApproval's onSuccess.
export function onApprovalProcessed(
  queryClient: QueryClient,
  approval: Approval,
) {
  if (approval.status === "approved") {
    invalidate(queryClient, approvalFanOut[approval.approvalType](approval));
  } else {
    // rejected — nothing downstream happened, only the approval record changed
    queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all });
  }
}

// TODO: confirm the exact keys on `approval.payload` with the backend dev.
// This guesses common shapes (destination/source location refs, a bare
// siteId for task claims) since `payload: jsonb` isn't itemized in the doc.
function extractSiteId(approval: Approval): string | undefined {
  const payload = approval.payload as Record<string, any> | undefined;
  if (!payload) return undefined;
  if (payload.siteId) return payload.siteId;
  if (payload.destination?.type === "site") return payload.destination.id;
  if (payload.source?.type === "site") return payload.source.id;
  return undefined;
}
