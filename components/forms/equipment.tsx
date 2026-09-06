"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { useCreateEquipment, useUpdateEquipment } from "@/hooks/use-equipment";
import type { Equipment } from "@/types/api";

export function EquipmentForm({
  initial,
  licenses,
  onCancel,
  onDone,
}: {
  initial?: Equipment;
  licenses: { id: string; name: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const creating = !initial;
  const createMutation = useCreateEquipment();
  const updateMutation = useUpdateEquipment();
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const serialNumber = String(fd.get("serialNumber") ?? "").trim();
    const licenseId = String(fd.get("licenseId") ?? "").trim();
    const originalValue = String(fd.get("originalValue") ?? "").trim();
    
    if (!name) return;

    try {
      if (initial) {
        await updateMutation.mutateAsync({
          id: initial.id,
          payload: {
            name,
            serialNumber: serialNumber || undefined,
            // licenseId could be updated but our form doesn't expose it on edit currently
          }
        });
      } else {
        await createMutation.mutateAsync({
          name,
          serialNumber: serialNumber || undefined,
          licenseId: licenseId || undefined,
          originalValue: originalValue || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save equipment");
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
      <Field label="Serial">
        <input className="field" name="serialNumber" defaultValue={initial?.serialNumber ?? ""} disabled={isPending} />
      </Field>
      {creating ? (
        <>
          <Field label="License">
            <select className="field" name="licenseId" defaultValue={licenses[0]?.id ?? ""} disabled={isPending}>
              {licenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Original value (ETB)">
            <input className="field" name="originalValue" defaultValue="" disabled={isPending} />
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
      <FormActions saveLabel={initial ? "Save equipment" : "Create equipment"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}
