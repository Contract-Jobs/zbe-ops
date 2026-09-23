import type { Role } from "@/types/api"
import type { ApprovalType } from "@/types/api"

interface SessionUser {
  id: string;
  role: Role | null;
}
export type { Role }
// const ADMIN_ROLES: Role[] = ["admin", "superadmin"];

// export function isAdmin(role: Role | null | undefined): boolean {
//   return !!role && ADMIN_ROLES.includes(role);
// }

// export function isSiteManager(role: Role | null | undefined): boolean {
//   return role === "site_manager";
// }


const ADMIN_ROLES: Role[] = ["admin", "superadmin"]

export function isAdmin(role: Role | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role)
}

export function isSiteManager(role: Role | null | undefined): boolean {
  return role === "site_manager"
}

// Approve/reject, reverse logs, manage master data, create manual transactions
export function canApprove(role: Role | null | undefined): boolean {
  return isAdmin(role);
}

export function canManageMasterData(role: Role | null | undefined): boolean {
  return isAdmin(role);
}

// Site Managers only see/act on sites they're assigned to (managerId match).
// Admins bypass this check entirely.
export function canAccessSite(
  role: Role | null | undefined,
  userId: string,
  site: { managerId: string | null },
): boolean {
  if (isAdmin(role)) return true;
  return isSiteManager(role) && site.managerId === userId;
}

// Site Managers cannot withdraw materials from warehouses (doc: "Constraints:
// Site managers cannot withdraw from warehouses" on Transfer Material).
export function canWithdrawFromWarehouse(
  role: Role | null | undefined,
): boolean {
  return isAdmin(role);
}

// Task completion approval — Admin/Superadmin only per doc.
export function canCompleteTask(role: Role | null | undefined): boolean {
  return isAdmin(role);
}


// Per docs/new_api.md's site-manager approval fallback: a site_manager may
// resolve a pending inventory_movement, equipment_movement, or rental_event
// approval if they manage the site the record's destination inventory (or
// rental agreement) resolves to. A warehouse-anchored record has no
// site-manager fallback at all — admin/superadmin only. transaction/
// progress_log approvals are never resolvable by a site_manager this way.
const SITE_MANAGER_APPROVABLE_TYPES: ApprovalType[] = ["inventory_movement", "equipment_movement", "rental_event"]

// Necessary-but-not-sufficient: confirms the TYPE is approvable by this
// role. The record-level "do they manage the destination site" check is
// enforced authoritatively server-side (ApprovalService.assertCanResolve) —
// v2 has no single-record GET for movements/rental events to precompute it
// client-side, so useCanActOnApproval no longer tries; see that hook.
export function canApproveType(role: Role | null | undefined, approvalType: ApprovalType): boolean {
  if (isAdmin(role)) return true
  if (isSiteManager(role)) return SITE_MANAGER_APPROVABLE_TYPES.includes(approvalType)
  return false
}