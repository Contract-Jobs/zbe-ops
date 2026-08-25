"use client";

import { Field, FormActions } from "@/components/ui";
import { uiOnly } from "@/components/forms/ui-only";
import type { License, Site, Task, User } from "@/lib/types";

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
  licenses: License[];
  users: User[];
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} />
      </Field>
      <Field label="License">
        <select className="field" name="licenseId" defaultValue={initial?.licenseId ?? licenses[0]?.id ?? ""}>
          {licenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Address">
        <input className="field" name="address" defaultValue={initial?.address ?? ""} />
      </Field>
      <Field label="Status">
        <select className="field" name="status" defaultValue={initial?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Closed</option>
        </select>
      </Field>
      <Field label="Labor budget (ETB)">
        <input className="field" name="laborBudget" defaultValue={initial ? String(initial.laborBudget) : ""} />
      </Field>
      <Field label="Material budget (ETB)">
        <input className="field" name="materialBudget" defaultValue={initial ? String(initial.materialBudget) : ""} />
      </Field>
      <Field label="Site manager">
        <select className="field" name="managerUserId" defaultValue={initial?.managerUserId ?? users[0]?.id ?? ""}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      <FormActions saveLabel={initial ? "Save site" : "Create site"} onCancel={onCancel} />
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
