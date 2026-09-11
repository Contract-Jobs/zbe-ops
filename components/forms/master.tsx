"use client";

import { useState } from "react";
import { Field, FormActions } from "@/components/ui";
import { useCreateLicense, useUpdateLicense } from "@/hooks/use-licenses";
import { useCreateWarehouse, useUpdateWarehouse } from "@/hooks/use-warehouses";
import { useCreateTender, useUpdateTender } from "@/hooks/use-tenders";
import { useCreateCategory } from "@/hooks/use-categories";

function dateValue(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function TenderForm({
  initial,
  licenses,
  onCancel,
  onDone,
}: {
  initial?: {
    id: string;
    name: string;
    licenseId: string;
    status?: string;
    submissionDate?: string | null;
    estimatedBudget?: string | null;
    value?: number | null;
  };
  licenses: { id: string; name: string }[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const createMutation = useCreateTender();
  const updateMutation = useUpdateTender();
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const licenseId = String(fd.get("licenseId") ?? "").trim();
    const status = String(fd.get("status") ?? "draft");
    const submissionDate = String(fd.get("submissionDate") ?? "").trim() || undefined;
    const estimatedBudget = String(fd.get("estimatedBudget") ?? "").trim() || undefined;

    if (!name || !licenseId) return;

    try {
      if (initial) {
        await updateMutation.mutateAsync({
          id: initial.id,
          payload: { name, licenseId, status, submissionDate, estimatedBudget },
        });
      } else {
        await createMutation.mutateAsync({ name, licenseId, status, submissionDate, estimatedBudget });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tender");
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
      <Field label="Status">
        <select className="field" name="status" defaultValue={initial?.status ?? "draft"} disabled={isPending}>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
      </Field>
      <Field label="Submission date">
        <input className="field" type="date" name="submissionDate" defaultValue={dateValue(initial?.submissionDate)} disabled={isPending} />
      </Field>
      <Field label="Estimated budget (ETB)">
        <input className="field" name="estimatedBudget" defaultValue={initial?.estimatedBudget ?? ""} disabled={isPending} />
      </Field>
      <FormActions saveLabel={initial ? "Save tender" : "Create tender"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}

export function LicenseForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: { id: string; name: string };
  onCancel: () => void;
  onDone: () => void;
}) {
  const createMutation = useCreateLicense();
  const updateMutation = useUpdateLicense();
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    try {
      if (initial) {
        await updateMutation.mutateAsync({ id: initial.id, payload: { name } });
      } else {
        await createMutation.mutateAsync({ name });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save license");
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>
      ) : null}
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} disabled={isPending} />
      </Field>
      <FormActions saveLabel={initial ? "Save license" : "Create license"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}

export function WarehouseForm({
  initial,
  onCancel,
  onDone,
}: {
  initial?: { id: string; name: string; location?: string | null };
  onCancel: () => void;
  onDone: () => void;
}) {
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const [error, setError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const location = String(fd.get("location") ?? "").trim() || undefined;
    if (!name) return;
    try {
      if (initial) {
        await updateMutation.mutateAsync({ id: initial.id, payload: { name, location } });
      } else {
        await createMutation.mutateAsync({ name, location });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save yard");
    }
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)] sm:col-span-2">{error}</p>
      ) : null}
      <Field label="Name">
        <input className="field" name="name" required defaultValue={initial?.name ?? ""} disabled={isPending} />
      </Field>
      <Field label="Location">
        <input className="field" name="location" defaultValue={initial?.location ?? ""} disabled={isPending} />
      </Field>
      <FormActions saveLabel={initial ? "Save yard" : "Create yard"} onCancel={onCancel} loading={isPending} />
    </form>
  );
}

export function CategoryForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const createMutation = useCreateCategory();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync({ name });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>
      ) : null}
      <Field label="Name">
        <input className="field" name="name" required disabled={createMutation.isPending} />
      </Field>
      <FormActions saveLabel="Create category" onCancel={onCancel} loading={createMutation.isPending} />
    </form>
  );
}
