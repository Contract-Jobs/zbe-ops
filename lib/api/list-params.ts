// export type SortOrder = "asc" | "desc";

// // A filter value can be a single string, an array (multi-select), or undefined (omit it)
// export type FilterValue = string | string[] | undefined;

// export interface BaseListParams {
//   page?: number;
//   limit?: number;
//   search?: string;
//   sortBy?: string;
//   sortOrder?: SortOrder;
// }

// export type ListParams<TFilters extends Record<string, FilterValue> = {}> =
//   BaseListParams & TFilters;

// export function buildListParams(
//   params: ListParams<Record<string, FilterValue>> = {},
// ): URLSearchParams {
//   const search = new URLSearchParams();

//   for (const [key, value] of Object.entries(params)) {
//     if (value === undefined || value === null || value === "") continue;

//     if (Array.isArray(value)) {
//       for (const item of value) {
//         if (item !== undefined && item !== null && item !== "") {
//           search.append(key, String(item));
//         }
//       }
//     } else {
//       search.append(key, String(value));
//     }
//   }

//   return search;
// }

// lib/api/list-params.ts

export type SortOrder = "asc" | "desc"
export type FilterValue = string | string[] | undefined

export interface BaseListParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: SortOrder
}

export type ListParams<TFilters extends Record<string, FilterValue> = {}> = BaseListParams & TFilters

// Generic over `object`, not Record<string, FilterValue> — avoids the index
// signature mismatch entirely, and stops rejecting page/limit (numbers)
// which never fit FilterValue in the first place. The Record cast below is
// purely for iteration; it's not part of the public signature.
export function buildListParams<T extends object>(params: T = {} as T): URLSearchParams {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          search.append(key, String(item))
        }
      }
    } else {
      search.append(key, String(value))
    }
  }

  return search
}