import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  tender: ["create", "read", "update", "delete"],
  site: ["create", "read", "update", "delete"],
  asset: ["create", "read", "update", "delete"],
  warehouse: ["create", "read", "update", "delete"],
  license: ["create", "read", "update", "delete"],
  inventory: ["create", "read", "update", "delete", "approve"],
  transaction: ["create", "read", "update", "delete", "approve"],
  progress_log: ["create", "read", "update", "delete", "approve"],
  budget: ["create", "read", "update", "delete", "approve"],
  approval: ["create", "read", "update", "delete", "approve"],
  rental: ["create", "read", "update", "delete", "approve"],
} as const;

export const ac = createAccessControl(statement);

export const site_manager = ac.newRole({
  tender: ["read"],
  site: ["read", "update"],
  asset: ["read"],
  warehouse: ["read"],
  license: ["read"],
  inventory: ["create", "read", "approve"],
  transaction: ["create", "read", "approve"],
  progress_log: ["create", "read", "update"],
  budget: ["read"],
  approval: ["create", "read"],
  rental: ["create", "read", "approve"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  user: ["create", "list", "set-role", "ban", "impersonate", "delete", "set-password", "set-email", "get", "update"], // NO impersonate-admins
  tender: ["create", "read", "update", "delete"],
  site: ["create", "read", "update", "delete"],
  asset: ["create", "read", "update", "delete"],
  warehouse: ["create", "read", "update", "delete"],
  license: ["create", "read", "update", "delete"],
  inventory: ["create", "read", "update", "delete", "approve"],
  transaction: ["create", "read", "update", "delete", "approve"],
  progress_log: ["create", "read", "update", "delete", "approve"],
  budget: ["create", "read", "update", "delete", "approve"],
  approval: ["create", "read", "update", "delete", "approve"],
  rental: ["create", "read", "update", "delete", "approve"],
});

export const superadmin = ac.newRole({
  ...adminAc.statements,
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  tender: ["create", "read", "update", "delete"],
  site: ["create", "read", "update", "delete"],
  asset: ["create", "read", "update", "delete"],
  warehouse: ["create", "read", "update", "delete"],
  license: ["create", "read", "update", "delete"],
  inventory: ["create", "read", "update", "delete", "approve"],
  transaction: ["create", "read", "update", "delete", "approve"],
  progress_log: ["create", "read", "update", "delete", "approve"],
  budget: ["create", "read", "update", "delete", "approve"],
  approval: ["create", "read", "update", "delete", "approve"],
  rental: ["create", "read", "update", "delete", "approve"],
});

export const roles = { site_manager, admin, superadmin };

export type Role = keyof typeof roles;
export type Action = "create" | "read" | "update" | "delete" | "approve";
export type Resource = Exclude<keyof typeof statement, "user" | "session">;

export function can(roleName: string | undefined | null, action: Action, resource: Resource) {
  if (!roleName) return false;
  const roleObj = roles[roleName as Role];
  if (!roleObj) return false;
  return roleObj.authorize({ [resource]: [action] }).success;
}
