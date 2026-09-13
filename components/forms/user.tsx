"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { useSetUserRole, useBanUser, useUnbanUser, useCreateUser, useUpdateUser } from "@/hooks/use-users";
import type { User, Role } from "@/types/api";

export function UserForm({
  initial,
  onCancel,
  onDone,
  canSetAdmin,
}: {
  initial?: User;
  onCancel: () => void;
  onDone: () => void;
  canSetAdmin: boolean;
}) {
  const setRoleMutation = useSetUserRole();
  const banMutation = useBanUser();
  const unbanMutation = useUnbanUser();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const [error, setError] = useState<string | null>(null);

  const isPending =
    setRoleMutation.isPending ||
    banMutation.isPending ||
    unbanMutation.isPending ||
    createUserMutation.isPending ||
    updateUserMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const email = String(fd.get("email") ?? "");
    const role = String(fd.get("role") ?? "site_manager") as Role;
    const status = String(fd.get("status") ?? "active");
    const password = initial ? undefined : String(fd.get("password") ?? "");

    try {
      if (!initial) {
        // Creating a new user
        await createUserMutation.mutateAsync({ name, email, password, role });
      } else {
        // Updating existing user
        if (initial.name !== name || initial.email !== email) {
          await updateUserMutation.mutateAsync({
            userId: initial.id,
            data: { name, email },
          });
        }
        if (initial.role !== role) {
          await setRoleMutation.mutateAsync({ userId: initial.id, role });
        }
        if (status === "banned" && !initial.banned) {
          await banMutation.mutateAsync({ userId: initial.id });
        } else if (status === "active" && initial.banned) {
          await unbanMutation.mutateAsync({ userId: initial.id });
        }
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)] sm:col-span-2">
          {error}
        </p>
      ) : null}
      <Field label="Name">
        <input className="field" name="name" defaultValue={initial?.name} disabled={isPending} required />
      </Field>
      <Field label="Email">
        <input className="field" name="email" type="email" defaultValue={initial?.email} disabled={isPending} required />
      </Field>
      {!initial ? (
        <Field label="Password">
          <input className="field" name="password" type="password" disabled={isPending} required minLength={8} />
        </Field>
      ) : null}
      <Field label="Role">
        <select className="field" name="role" defaultValue={initial?.role ?? "site_manager"} disabled={isPending}>
          <option value="site_manager">Site Manager</option>
          {canSetAdmin ? <option value="admin">Admin</option> : null}
          {initial?.role === "superadmin" || canSetAdmin ? <option value="superadmin">Superadmin</option> : null}
        </select>
      </Field>
      {initial ? (
        <Field label="Status">
          <select className="field" name="status" defaultValue={initial.banned ? "banned" : "active"} disabled={isPending}>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </Field>
      ) : null}
      <div className="sm:col-span-2">
        <FormActions saveLabel={initial ? "Save changes" : "Create user"} onCancel={onCancel} loading={isPending} />
      </div>
    </form>
  );
}
