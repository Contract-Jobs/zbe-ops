"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { useUpdateEquipment } from "@/hooks/use-equipment";
import type { IndividualEquipmentItem } from "@/types/api";

// Direct create is disabled server-side in v2 — equipment can only
// originate from a purchase equipment-movement (see
// EquipmentMovementForm's "purchase" action) or a rental's
// equipmentId: "new". This form is edit-only.
export function EquipmentForm({
  initial,
  onCancel,
  onDone,
}: {
  initial: IndividualEquipmentItem;
  onCancel: () => void;
  onDone: () => void;
}) {
  const updateMutation = useUpdateEquipment();
  const [error, setError] = useState<string | null>(null);

  const isPending = updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get("identifier") ?? "").trim();
    const vendorName = String(fd.get("vendorName") ?? "").trim();
    const originalValue = String(fd.get("originalValue") ?? "").trim();
    const bookValue = String(fd.get("bookValue") ?? "").trim();

    try {
      await updateMutation.mutateAsync({
        id: initial.id,
        payload: {
          identifier: identifier || undefined,
          vendorName: vendorName || undefined,
          originalValue: originalValue || undefined,
          bookValue: bookValue || undefined,
        },
      });
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
      <Field label="Identifier">
        <input className="field" name="identifier" defaultValue={initial.identifier} disabled={isPending} />
      </Field>
      <Field label="Vendor">
        <input className="field" name="vendorName" defaultValue={initial.vendorName ?? ""} disabled={isPending} />
      </Field>
      <Field label="Original value (ETB)">
        <input className="field" name="originalValue" defaultValue={initial.originalValue} disabled={isPending} />
      </Field>
      <Field label="Book value (ETB)">
        <input className="field" name="bookValue" defaultValue={initial.bookValue ?? ""} disabled={isPending} />
      </Field>
      <p className="text-sm text-black/55 sm:col-span-2">
        Location, condition, assignment, and lifecycle cannot be patched here — raise a movement.
      </p>
      <FormActions saveLabel="Save equipment" onCancel={onCancel} loading={isPending} />
    </form>
  );
}
