import type { ReactNode } from "react";

// The one place a list's filter block is laid out. It always sits directly
// above the table it filters (inside the tab that owns that table), as a single
// row that wraps: filters first, then any page-specific extras, with the sort
// control last and pushed to the right edge. Pages pass content in; they never
// choose their own wrapper or margins.
//
// Put a QueryFilters inside with className="contents" so its controls share
// this row instead of wrapping as a block of their own.
export function ListToolbar({ children, sort }: { children?: ReactNode; sort?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      {children}
      {sort ? <div className="w-full sm:ml-auto sm:w-auto">{sort}</div> : null}
    </div>
  );
}
