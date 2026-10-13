"use client";

import { Field } from "@/components/ui";

export type SortOrder = "asc" | "desc";

export interface SortState<T extends string> {
  sortBy: T;
  sortOrder: SortOrder;
}

// Field + direction for a server-sorted list. Options mirror the sortBy
// values the endpoint accepts — pass only those, the API rejects others.
export function SortSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: SortState<T>;
  onChange: (next: SortState<T>) => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="w-full sm:w-44">
        <Field label="Sort by">
          <select
            className="field"
            value={value.sortBy}
            onChange={(e) => onChange({ ...value, sortBy: e.target.value as T })}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        aria-label={value.sortOrder === "asc" ? "Ascending, switch to descending" : "Descending, switch to ascending"}
        onClick={() => onChange({ ...value, sortOrder: value.sortOrder === "asc" ? "desc" : "asc" })}
      >
        {value.sortOrder === "asc" ? "Asc ↑" : "Desc ↓"}
      </button>
    </div>
  );
}
