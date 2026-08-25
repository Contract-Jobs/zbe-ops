"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { uiOnly } from "@/components/forms/ui-only";
import type { Material, MaterialSubitem } from "@/lib/types";

export function MaterialForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: Material;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState(initial?.type ?? "single");
  const [lines, setLines] = useState<Array<{ name: string; quantity: string }>>([{ name: "", quantity: "1" }]);

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} />
      </Field>
      <Field label="Unit">
        <input className="field" name="unit" defaultValue={initial?.unit ?? "pcs"} />
      </Field>
      <Field label="Type">
        <select
          className="field"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as Material["type"])}
        >
          <option value="single">Single</option>
          <option value="set">Set</option>
        </select>
      </Field>
      {type === "set" ? (
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
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setLines([...lines, { name: "", quantity: "1" }])}
          >
            Add part
          </button>
        </div>
      ) : null}
      <FormActions saveLabel={initial ? "Save material" : "Create material"} onCancel={onCancel} />
    </form>
  );
}

export function SubitemForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: MaterialSubitem;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => uiOnly(e, onDone)}>
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} />
      </Field>
      <Field label="Quantity">
        <input className="field" name="quantity" required defaultValue={initial ? String(initial.quantity) : "1"} />
      </Field>
      <FormActions saveLabel={initial ? "Save part" : "Add part"} onCancel={onCancel} />
    </form>
  );
}
