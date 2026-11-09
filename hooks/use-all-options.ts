import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query/keys"
import { listInventoryItems } from "@/lib/api/inventory-items"
import type { InventoryItemListParams } from "@/lib/api/inventory-items"
import { listSites } from "@/lib/api/sites"
import type { SiteListParams } from "@/lib/api/sites"
import { listEquipment } from "@/lib/api/equipment"
import type { EquipmentListParams } from "@/lib/api/equipment"
import { warehousesApi } from "@/lib/api/warehouses"
import { licensesApi } from "@/lib/api/licenses"
import type { Pagination } from "@/lib/api/client"

// Pickers (SearchableSelect, <select>) filter client-side, so they need the
// WHOLE list. List endpoints return one page (default 10, and the server may
// clamp `limit`), so a single `limit: 50` call silently drops everything past
// it. This walks `pagination.totalPages` instead of trusting any one limit.
const PAGE_SIZE = 100
const MAX_PAGES = 50 // runaway guard: 5000 rows is not a "picker" any more

type Page<T> = { data: T[]; pagination?: Pagination }

export async function fetchAllPages<T>(fetchPage: (page: number, limit: number) => Promise<Page<T>>): Promise<{ data: T[] }> {
  const rows: T[] = []
  let page = 1
  let totalPages = 1
  do {
    const res = await fetchPage(page, PAGE_SIZE)
    rows.push(...res.data)
    totalPages = res.pagination?.totalPages ?? 1
    page += 1
  } while (page <= totalPages && page <= MAX_PAGES)
  return { data: rows }
}

type WithoutPaging<P> = Omit<P, "page" | "limit">

export function useAllInventoryItems(params: WithoutPaging<InventoryItemListParams> = {}) {
  return useQuery({
    queryKey: queryKeys.inventoryItems.list({ ...params, all: true }),
    queryFn: () => fetchAllPages((page, limit) => listInventoryItems({ ...params, page, limit })),
  })
}

export function useAllSites(params: WithoutPaging<SiteListParams> = {}) {
  return useQuery({
    queryKey: queryKeys.sites.list({ ...params, all: true }),
    queryFn: () => fetchAllPages((page, limit) => listSites({ ...params, page, limit })),
  })
}

export function useAllWarehouses() {
  return useQuery({
    queryKey: queryKeys.warehouses.list({ all: true }),
    queryFn: () => fetchAllPages((page, limit) => warehousesApi.list({ page, limit })),
  })
}

// GET /api/equipment answers a site manager with 403 unless an `inventoryId`
// of their own site is passed, so callers must gate `enabled` on that.
export function useAllEquipment(params: WithoutPaging<EquipmentListParams> = {}, enabled = true) {
  return useQuery({
    enabled,
    queryKey: queryKeys.equipment.list({ ...params, all: true }),
    queryFn: () => fetchAllPages((page, limit) => listEquipment({ ...params, page, limit })),
  })
}

export function useAllLicenses() {
  return useQuery({
    queryKey: queryKeys.licenses.list({ all: true }),
    queryFn: () => fetchAllPages((page, limit) => licensesApi.list({ page, limit })),
  })
}
