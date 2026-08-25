"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { stamp } from "@/lib/format";

export type RecordMode<T> =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; record: T }
  | { kind: "delete"; record: T; label: string };

export function closedMode<T>(): RecordMode<T> {
  return { kind: "closed" };
}

export function PageHead({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
      <div className="min-w-0">
        <p className="kicker">{kicker}</p>
        <h1 className="mt-2 text-[1.65rem] font-normal leading-[1.05] tracking-[-0.04em] sm:text-[2rem] sm:leading-none">
          {title}
        </h1>
      </div>
      {action}
    </div>
  );
}

export function Stamp({
  value,
  tone = "ink",
}: {
  value: string;
  tone?: "ink" | "ok" | "warn" | "bad" | "yellow";
}) {
  const cls = {
    ink: "border-black/25 text-black/70",
    ok: "border-ok/40 text-ok",
    warn: "border-warn/40 text-warn",
    bad: "border-bad/40 text-bad",
    yellow: "border-yellow bg-yellow/15 text-black",
  }[tone];
  return (
    <span className={`inline-block border px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.08em] ${cls}`}>
      {stamp(value)}
    </span>
  );
}

export function statusTone(status: string): "ink" | "ok" | "warn" | "bad" | "yellow" {
  if (["active", "available", "completed", "approved", "won", "money_in"].includes(status)) return "ok";
  if (["pending", "claimed", "submitted", "draft", "on_hold", "maintenance", "rented_in", "rented_out"].includes(status))
    return "yellow";
  if (["closed", "lost", "sold", "disposed", "rejected", "missing"].includes(status)) return "bad";
  if (["deployed", "open"].includes(status)) return "warn";
  return "ink";
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="border border-dashed border-black/20 px-4 py-10 text-center text-black/50">{children}</p>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

export function RowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium hover:text-yellow">
      {children}
    </Link>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function FormPanel({
  kicker,
  title,
  onClose,
  children,
}: {
  kicker: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mb-8 border border-black/10 bg-paper/40 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker">{kicker}</p>
          <p className="mt-1 text-lg tracking-tight">{title}</p>
        </div>
        <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </div>
  );
}

export function FormActions({ saveLabel, onCancel }: { saveLabel: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
      <button className="btn w-full sm:w-auto" type="submit">
        {saveLabel}
      </button>
      <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/** New / Edit / Delete buttons for a record. */
export function RecordActions({
  onNew,
  onEdit,
  onDelete,
  newLabel = "New",
}: {
  onNew?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  newLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {onNew ? (
        <button type="button" className="btn" onClick={onNew}>
          {newLabel}
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" className="btn btn-ghost" onClick={onEdit}>
          Edit
        </button>
      ) : null}
      {onDelete ? (
        <button type="button" className="btn btn-ghost" onClick={onDelete}>
          Delete
        </button>
      ) : null}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm delete",
  danger = true,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Dismiss" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md border border-black bg-white p-5"
      >
        <h2 id="confirm-title" className="text-xl tracking-tight">
          {title}
        </h2>
        <p className="mt-3 text-sm text-black/70">{body}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn w-full sm:w-auto ${danger ? "btn-bad" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteConfirm<T>({
  mode,
  restore,
  onClose,
}: {
  mode: RecordMode<T>;
  restore: boolean;
  onClose: () => void;
}) {
  if (mode.kind !== "delete") return null;
  return (
    <ConfirmDialog
      open
      title="Are you sure?"
      body={
        restore
          ? `${mode.label} will be removed from the desk. It can be restored later.`
          : `${mode.label} will be removed. There is no restore on this record.`
      }
      onCancel={onClose}
      onConfirm={onClose}
    />
  );
}
