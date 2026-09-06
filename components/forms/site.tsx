"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { uiOnly } from "@/components/forms/ui-only";
import { useCreateSite, useUpdateSite } from "@/hooks/use-sites";
import type { Site } from "@/types/api";
import type { Task, User, License } from "@/lib/types";

function dateValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function SiteForm({
  initial,
  licenses,
  users,
  onCancel,
  onDone,
}: {
  initial?: Site;
  licenses: { id: string; name: string }[];
  users: { id: string; name: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const createMutation = useCreateSite();
  const updateMutation = useUpdateSite();
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const licenseId = String(fd.get("licenseId") ?? "").trim();
    const address = String(fd.get("address") ?? "").trim();
    const status = String(fd.get("status") ?? "active") as "active" | "closed";
    const laborBudget = String(fd.get("laborBudget") ?? "").trim();
    const materialBudget = String(fd.get("materialBudget") ?? "").trim();
    const managerId = String(fd.get("managerId") ?? "").trim();

    if (!name || !licenseId) return;

    try {
      if (initial) {
        await updateMutation.mutateAsync({
          id: initial.id,
          payload: {
            name,
            licenseId,
            location: address || undefined,
            status,
            laborBudget: laborBudget || undefined,
            materialBudget: materialBudget || undefined,
            managerId: managerId || undefined,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name,
          licenseId,
          location: address || undefined,
          laborBudget: laborBudget || undefined,
          materialBudget: materialBudget || undefined,
          managerId: managerId || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save site");
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
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} disabled={isPending} />
      </Field>
      <Field label="License">
        <select className="field" name="licenseId" defaultValue={initial?.licenseId ?? licenses[0]?.id ?? ""} disabled={isPending}>
          {licenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Address">
        <input className="field" name="address" defaultValue={initial?.location ?? ""} disabled={isPending} />
      </Field>
      <Field label="Status">
        <select className="field" name="status" defaultValue={initial?.status ?? "active"} disabled={isPending}>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Closed</option>
        </select>
      </Field>
      <Field label="Labor budget (ETB)">
        <input className="field" name="laborBudget" defaultValue={initial?.laborBudget ?? ""} disabled={isPending} />
      </Field>
      <Field label="Material budget (ETB)">
        <input className="field" name="materialBudget" defaultValue={initial?.materialBudget ?? ""} disabled={isPending} />
      </Field>
      <Field label="Site manager">
        <select className="field" name="managerId" defaultValue={initial?.managerId ?? users[0]?.id ?? ""} disabled={isPending}>
          <option value="">None</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      <FormActions saveLabel={initial ? "Save site" : "Create site"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}

export function TaskForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: Task;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Title">
        <input className="field" name="title" required defaultValue={initial?.title ?? ""} />
      </Field>
      <Field label="Target date">
        <input className="field" type="date" name="targetDate" defaultValue={dateValue(initial?.targetDate)} />
      </Field>
      <label className="block text-sm sm:col-span-2">
        Body
        <textarea className="field mt-1 min-h-24" name="body" defaultValue={initial?.body ?? ""} />
      </label>
      <FormActions saveLabel={initial ? "Save task" : "Add task"} onCancel={onCancel} />
    </form>
  );
}

export function LifecycleForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  return (
    <form className="grid gap-3" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Note">
        <textarea className="field min-h-24" name="note" required placeholder="What changed on this site." />
      </Field>
      <FormActions saveLabel="Log note" onCancel={onCancel} />
    </form>
  );
}
