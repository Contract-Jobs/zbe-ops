"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { useCreateInventoryItem, useUpdateInventoryItem, useAddSubitem, useUpdateSubitem } from "@/hooks/use-inventory-items";
import type { InventoryItem, InventoryItemSubitem } from "@/types/api";

export function MaterialForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: InventoryItem;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [compositionType, setCompositionType] = useState(initial?.compositionType ?? "single");
  const [lines, setLines] = useState<Array<{ name: string; quantity: string }>>([{ name: "", quantity: "1" }]);
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const unit = String(fd.get("unit") ?? "").trim();

    if (!name) return;

    try {
      if (initial) {
        await updateMutation.mutateAsync({
          id: initial.id,
          payload: { name, unit: unit || undefined },
        });
      } else {
        await createMutation.mutateAsync({
          name,
          unit: unit || undefined,
          category: "material",
          tracking: "quantity",
          compositionType,
          subitems:
            compositionType === "set" ? lines.map((l) => ({ name: l.name, quantity: Number(l.quantity) })) : undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save material");
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
      <Field label="Unit">
        <input className="field" name="unit" defaultValue={initial?.unit ?? "pcs"} disabled={isPending} />
      </Field>
      <Field label="Type">
        <select
          className="field"
          name="compositionType"
          value={compositionType}
          onChange={(e) => setCompositionType(e.target.value as "single" | "set")}
          disabled={!!initial || isPending}
        >
          <option value="single">Single</option>
          <option value="set">Set</option>
        </select>
      </Field>
      {compositionType === "set" ? (
        <div className="sm:col-span-2">
          <p className="kicker mb-2">Set contents</p>
          {lines.map((line, index) => (
            <div key={index} className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input
                className="field"
                placeholder="Part name"
                value={line.name}
                onChange={(e) => {
                  const next = [...lines];
                  const current = next[index];
                  if (!current) return;
                  next[index] = { ...current, name: e.target.value };
                  setLines(next);
                }}
              />
              <input
                className="field sm:w-28"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  const current = next[index];
                  if (!current) return;
                  next[index] = { ...current, quantity: e.target.value };
                  setLines(next);
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
                disabled={isPending}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setLines([...lines, { name: "", quantity: "1" }])}
            disabled={isPending}
          >
            Add part
          </button>
        </div>
      ) : null}
      <FormActions saveLabel={initial ? "Save material" : "Create material"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}

export function SubitemForm({
  materialId,
  initial,
  onCancel,
  onDone,
}: {
  materialId: string;
  initial?: InventoryItemSubitem;
  onCancel: () => void;
  onDone: () => void;
}) {
  const addMutation = useAddSubitem(materialId);
  const updateMutation = useUpdateSubitem(materialId);
  const [error, setError] = useState<string | null>(null);

  const isPending = addMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const quantity = String(fd.get("quantity") ?? "1").trim();

    if (!name) return;

    try {
      if (initial) {
        await updateMutation.mutateAsync({ subitemId: initial.id, payload: { name, quantity } });
      } else {
        await addMutation.mutateAsync({ name, quantity });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save part");
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
      <Field label="Quantity">
        <input className="field" name="quantity" required defaultValue={initial ? String(initial.quantity) : "1"} disabled={isPending} />
      </Field>
      <FormActions saveLabel={initial ? "Save part" : "Add part"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}
