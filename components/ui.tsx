"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { stamp } from "@/lib/format";
import { useUser } from "@/hooks/use-user";
import { useSession } from "@/lib/auth/client";
import type { Pagination } from "@/lib/api/client";

export type RecordMode<T> =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "view"; record: T }
  | { kind: "edit"; record: T }
  | { kind: "claim"; record: T }
  | { kind: "complete"; record: T }
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
  title: ReactNode;
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

export function TableWrap<T>({
  children,
  data,
  pagination,
  onPageChange,
  onSortChange,
  sortOptions = [],
  itemsPerPage = 10,
  showPagination = true,
  showSort = true,
}: {
  children: ReactNode | ((paginatedData: T[]) => ReactNode);
  data?: T[];
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  onSortChange?: (sort: string) => void;
  sortOptions?: { label: string; value: string; sortFn?: (a: T, b: T) => number }[];
  itemsPerPage?: number;
  showPagination?: boolean;
  showSort?: boolean;
}) {
  // Client-side fallback state
  const [clientPage, setClientPage] = useState(1);
  const [clientSort, setClientSort] = useState(sortOptions[0]?.value || "default");

  const processedData = useMemo(() => {
    if (!data || pagination) return data || [];
    const result = [...data];
    const activeSort = sortOptions.find(o => o.value === clientSort);
    if (activeSort?.sortFn) {
      result.sort(activeSort.sortFn);
    }
    return result;
  }, [data, pagination, sortOptions, clientSort]);

  const totalPages = pagination ? pagination.totalPages : Math.max(1, Math.ceil(processedData.length / itemsPerPage));
  const currentPage = pagination ? pagination.page : Math.min(clientPage, totalPages);
  const totalItems = pagination ? pagination.total : processedData.length;

  const paginatedData = useMemo(() => {
    if (!data) return [];
    if (!showPagination || pagination) return processedData;
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, showPagination, currentPage, itemsPerPage, data, pagination]);

  const handleNext = () => {
    const next = Math.min(totalPages, currentPage + 1);
    if (onPageChange) onPageChange(next);
    else setClientPage(next);
  };

  const handlePrev = () => {
    const prev = Math.max(1, currentPage - 1);
    if (onPageChange) onPageChange(prev);
    else setClientPage(prev);
  };

  const handleSortChange = (val: string) => {
    if (onSortChange) onSortChange(val);
    else {
      setClientSort(val);
      setClientPage(1);
    }
  };

  // Determine if we should show the empty placeholder or actual pagination stats
  const isFallbackEmpty = !data && !pagination;

  return (
    <div className="flex flex-col border border-black/10 bg-white mb-6">
      {showSort && (sortOptions.length > 0 || isFallbackEmpty) && (
        <div className="flex items-center justify-end gap-2 border-b border-black/10 bg-black/1 p-2 px-3 text-sm">
          <span className="text-black/50">Sort by:</span>
          <select
            className="bg-transparent font-medium outline-none"
            value={onSortChange ? "default" : clientSort}
            onChange={e => handleSortChange(e.target.value)}
            disabled={isFallbackEmpty && sortOptions.length === 0}
          >
            {sortOptions.length > 0 ? (
              sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))
            ) : (
              <>
                <option value="default">Default</option>
                <option value="az">Name (A-Z)</option>
                <option value="za">Name (Z-A)</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </>
            )}
          </select>
        </div>
      )}

      <div className="table-wrap max-h-[50vh] overflow-y-auto">
        {typeof children === "function" ? children(!isFallbackEmpty ? paginatedData : ([] as unknown as T[])) : children}
      </div>

      {showPagination && (
        <div className="flex items-center justify-between border-t border-black/10 bg-black/1 p-2 px-3 text-sm">
          {!isFallbackEmpty ? (
            <span className="text-black/50">
              Showing {totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems}
            </span>
          ) : (
            <span className="text-black/50">Showing 1-10 of 100</span>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={handlePrev}
              disabled={isFallbackEmpty || currentPage <= 1}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={handleNext}
              disabled={isFallbackEmpty || currentPage >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Username({ userId, fallback }: { userId?: string | null; fallback?: ReactNode }) {
  const { data: session } = useSession();
  const { data: user, isLoading, error } = useUser(userId);

  if (!userId) {
    return <span>{fallback ?? "None"}</span>;
  }

  if (session?.user?.id === userId) {
    return <span>You</span>;
  }

  if (isLoading) {
    return <span className="inline-block w-20 h-4 bg-black/10 animate-pulse rounded align-middle" />;
  }

  if (error || !user?.name) {
    return <span>{fallback ?? userId}</span>;
  }

  return <span>{user.name}</span>;
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

export function ModalPanel({
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
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-white/5 backdrop-blur-[5px]!">
      <button type="button" className="absolute inset-0" aria-label="Dismiss" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-full overflow-y-auto border border-black bg-white p-6 shadow-xl"
      >
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="kicker">{kicker}</p>
            <p className="mt-1 text-xl font-medium tracking-tight">{title}</p>
          </div>
          <button type="button" className="btn btn-ghost shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormActions({
  saveLabel,
  onCancel,
  loading,
}: {
  saveLabel: string;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
      <button className="btn w-full sm:w-auto" type="submit" disabled={loading}>
        {loading ? "Saving…" : saveLabel}
      </button>
      <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={onCancel} disabled={loading}>
        Cancel
      </button>
    </div>
  );
}

/** New / Edit / Delete buttons for a record. */
export function RecordActions({
  onNew,
  newDisabled,
  onEdit,
  editDisabled,
  onDelete,
  deleteDisabled,
  newLabel = "New",
}: {
  onNew?: () => void;
  newDisabled?: boolean;
  onEdit?: () => void;
  editDisabled?: boolean,
  onDelete?: () => void;
  deleteDisabled?: boolean;
  newLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {onNew ? (
        <button disabled={newDisabled} type="button" className="btn" onClick={onNew}>
          {newLabel}
        </button>
      ) : null}
      {onEdit ? (
        <button disabled={editDisabled} type="button" className="btn btn-ghost" onClick={onEdit}>
          Edit
        </button>
      ) : null}
      {onDelete ? (
        <button disabled={deleteDisabled} type="button" className="btn btn-ghost-bad" onClick={onDelete}>
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
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
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
  loading,
  onClose,
  onConfirm,
}: {
  mode: RecordMode<T>;
  restore: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
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
      onConfirm={onConfirm ?? onClose}
    />
  );
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  onCreateNew,
  createNewLabel = "+ Create New",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; subLabel?: string }[];
  placeholder?: string;
  onCreateNew?: () => void;
  createNewLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    (o.subLabel && o.subLabel.toLowerCase().includes(query.toLowerCase()))
  );

  const selectedOption = options.find(o => o.id === value);
  const isNew = value === "new";

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        className="field w-full text-left flex justify-between items-center bg-white"
        onClick={() => setOpen(!open)}
      >
        <span className={selectedOption || isNew ? "" : "text-black/50"}>
          {isNew ? createNewLabel : (selectedOption ? selectedOption.label : placeholder)}
        </span>
        <span className="text-black/40 text-[0.6rem]">▼</span>
      </button>

      {open && (
        <div className="absolute z-10 w-full mt-1 border border-black bg-white shadow-xl max-h-[300px] flex flex-col">
          <div className="p-2 border-b border-black/10 shrink-0">
            <input
              type="text"
              className="field w-full text-sm py-1.5"
              placeholder="Search..."
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {onCreateNew && (
              <button
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm font-medium border-b border-black/5 transition-colors hover:bg-black/5"
                onClick={() => {
                  onCreateNew();
                  setOpen(false);
                  setQuery("");
                }}
              >
                {createNewLabel}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-black/50 text-center">No matches found.</div>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-black/5 ${value === opt.id ? 'bg-black/5 font-medium' : ''}`}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <div className="truncate">{opt.label}</div>
                  {opt.subLabel && <div className="text-[0.65rem] text-black/50 truncate mt-0.5">{opt.subLabel}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
