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


// Confirmed by backend dev: site managers may approve only these two
// types, and only when the record's toSiteId matches a site they manage.
// "inventory_movement" is legacy and never actually emitted, so not
// modeled here even though the backend defensively checks for it too.
const SITE_MANAGER_APPROVABLE_TYPES: ApprovalType[] = ["material_movement", "equipment_movement"]

// Necessary-but-not-sufficient: confirms the TYPE is approvable by this
// role. For Site Managers, the record's toSiteId must ALSO match one of
// their managed sites — see useCanActOnApproval in use-approvals.ts for
// the full check, since that requires fetching the record itself.
export function canApproveType(role: Role | null | undefined, approvalType: ApprovalType): boolean {
  if (isAdmin(role)) return true
  if (isSiteManager(role)) return SITE_MANAGER_APPROVABLE_TYPES.includes(approvalType)
  return false
}