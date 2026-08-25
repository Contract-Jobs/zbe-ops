"use client";

import { Field, FormActions } from "@/components/ui";
import { uiOnly } from "@/components/forms/ui-only";
import type { Equipment, License } from "@/lib/types";

export function EquipmentForm({
  initial,
  licenses,
  onCancel,
  onDone,
}: {
  initial?: Equipment;
  licenses: License[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const creating = !initial;
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} />
      </Field>
      <Field label="Serial">
        <input className="field" name="serialNumber" defaultValue={initial?.serialNumber ?? ""} />
      </Field>
      {creating ? (
        <>
          <Field label="License">
            <select className="field" name="licenseId" defaultValue={licenses[0]?.id ?? ""}>
              {licenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Original value (ETB)">
            <input className="field" name="originalValue" defaultValue="" />
          </Field>
          <p className="text-sm text-black/55 sm:col-span-2">
            Rent rate is set by hire events, not on create. Location and book value move through Approvals.
          </p>
        </>
      ) : (
        <p className="text-sm text-black/55 sm:col-span-2">
          Site, yard, value, and rent rate cannot be patched here — raise an event.
        </p>
      )}
      <FormActions saveLabel={initial ? "Save equipment" : "Create equipment"} onCancel={onCancel} />
    </form>
  );
}
