export type Role = "admin" | "superadmin" | "site_manager";

interface SessionUser {
  id: string;
  role: Role | null;
}

const ADMIN_ROLES: Role[] = ["admin", "superadmin"];

export function isAdmin(role: Role | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function isSiteManager(role: Role | null | undefined): boolean {
  return role === "site_manager";
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
