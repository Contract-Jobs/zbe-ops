"use client";

import { Field, FormActions } from "@/components/ui";
import { uiOnly } from "@/components/forms/ui-only";
import type { License, Tender, Warehouse } from "@/lib/types";

function dateValue(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export function TenderForm({
  initial,
  licenses,
  onCancel,
  onDone,
}: {
  initial?: Tender;
  licenses: License[];
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
      <Field label="Status">
        <select className="field" name="status" defaultValue={initial?.status ?? "draft"}>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </Field>
      <Field label="Submission date">
        <input className="field" type="date" name="submissionDate" defaultValue={dateValue(initial?.submissionDate)} />
      </Field>
      <Field label="Value (ETB)">
        <input className="field" name="value" defaultValue={initial?.value != null ? String(initial.value) : ""} />
      </Field>
      <FormActions saveLabel={initial ? "Save tender" : "Create tender"} onCancel={onCancel} />
    </form>
  );
}

export function LicenseForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: License;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <form className="grid gap-3" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} />
      </Field>
      <FormActions saveLabel={initial ? "Save license" : "Create license"} onCancel={onCancel} />
    </form>
  );
}

export function WarehouseForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: Warehouse;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} />
      </Field>
      <Field label="Location">
        <input className="field" name="location" defaultValue={initial?.location ?? ""} />
      </Field>
      <FormActions saveLabel={initial ? "Save yard" : "Create yard"} onCancel={onCancel} />
    </form>
  );
}

export function CategoryForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  return (
    <form className="grid gap-3" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required />
      </Field>
      <FormActions saveLabel="Create category" onCancel={onCancel} />
    </form>
  );
}
