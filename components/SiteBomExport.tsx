"use client";

import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ModalPanel } from "@/components/ui";
import type { Pagination } from "@/lib/api/client";
import { getInventoriesInBulk, getInventoryMaterials } from "@/lib/api/inventories";
import { getBalanceMovements } from "@/lib/api/inventory-balances";
import { getInventoryItemsInBulk, listSubitems } from "@/lib/api/inventory-items";
import { listInventoryMovements } from "@/lib/api/inventory-movements";
import { licensesApi } from "@/lib/api/licenses";
import { buildBom, DIRECT_SOURCE, sourceOf, type BomLookups, type BomMovement } from "@/lib/bom";
import { downloadCsv, safeFilePart, toCsv } from "@/lib/csv";
import type { InventoryItem, InventoryItemSubitem } from "@/types/api";

const PAGE_SIZE = 100;
const BULK_CHUNK = 50;
const PARALLEL = 5;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function fetchAll<T>(fetchPage: (page: number) => Promise<{ data: T[]; pagination?: Pagination }>): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await fetchPage(page);
    all.push(...res.data);
    totalPages = res.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}

interface Loaded {
  movements: BomMovement[];
  lookups: BomLookups;
}

// 1. Sales to this site, from every warehouse it bought from.
// 2. Purchases into the site's own inventory. The movements list can't filter
//    by destination, so read the movement log of each item the site has held
//    (zero balances included) and keep the purchases into this node.
async function loadSiteBom(siteId: string, nodeId: string | undefined): Promise<Loaded> {
  const sales = await fetchAll((page) =>
    listInventoryMovements({ buyerSiteId: siteId, movementType: "sale", page, limit: PAGE_SIZE }),
  );

  const purchases: BomMovement[] = [];
  if (nodeId) {
    const stock = await fetchAll((page) => getInventoryMaterials(nodeId, { includeZeroQuantity: "true", page, limit: PAGE_SIZE }));
    const stockItemIds = Array.from(new Set(stock.map((s) => s.itemId)));
    for (const batch of chunk(stockItemIds, PARALLEL)) {
      const logs: Awaited<ReturnType<typeof getBalanceMovements>>[] = await Promise.all(batch.map((itemId) => getBalanceMovements({ itemId, inventoryId: nodeId })));
      for (const log of logs) {
        for (const m of log.data) {
          if (m.movementType === "purchase" && m.destinationInventoryId === nodeId) purchases.push(m);
        }
      }
    }
  }

  const movements: BomMovement[] = [...sales, ...purchases];
  const itemIds = Array.from(new Set(movements.map((m) => m.itemId)));
  const nodeIds = Array.from(new Set(sales.map((s) => s.sourceInventoryId).filter((v): v is string => Boolean(v))));
  const licenseIds = Array.from(new Set(movements.map((m) => m.licenseId).filter((v): v is string => Boolean(v))));

  const [itemRes, nodeRes, licenseRes] = await Promise.all([
    Promise.all(chunk(itemIds, BULK_CHUNK).map((ids) => getInventoryItemsInBulk(ids))),
    Promise.all(chunk(nodeIds, BULK_CHUNK).map((ids) => getInventoriesInBulk(ids))),
    Promise.all(chunk(licenseIds, BULK_CHUNK).map((ids) => licensesApi.inBulk(ids))),
  ]);

  const items = new Map<string, InventoryItem>();
  for (const r of itemRes) for (const i of r.data) items.set(i.id, i);
  for (const m of movements) if (m.item) items.set(m.itemId, m.item);

  const setIds = [...items.values()].filter((i) => i.compositionType === "set").map((i) => i.id);
  const subitems = new Map<string, InventoryItemSubitem[]>();
  const subRes = await Promise.all(setIds.map((id) => listSubitems(id)));
  setIds.forEach((id, i) => subitems.set(id, subRes[i].data.filter((s) => !s.deletedAt)));

  const nodes = new Map<string, { id: string; name: string }>();
  for (const r of nodeRes) {
    for (const n of r.data) {
      if (n.warehouse) nodes.set(n.id, { id: n.warehouse.id, name: n.warehouse.name });
    }
  }
  const licenses = new Map<string, string>();
  for (const r of licenseRes) for (const l of r.data) licenses.set(l.id, l.name);

  return { movements, lookups: { items, subitems, nodes, licenses } };
}

// Bill of materials for one site: what it bought from each warehouse and what
// it bought directly. Lives on the site page because a site can buy from many
// warehouses and also buy for itself.
export function SiteBomExport({ siteId, siteName, nodeId }: { siteId: string; siteName: string; nodeId?: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function openDialog() {
    setOpen(true);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const loaded = await loadSiteBom(siteId, nodeId);
      setData(loaded);
      const live = loaded.movements.filter((m) => !m.isReversed && !m.isReversal);
      setSelected(new Set(live.map((m) => sourceOf(m, loaded.lookups))));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this site's purchases.");
    } finally {
      setLoading(false);
    }
  }

  // The sources that actually have purchases, with their counts.
  const sources = useMemo(() => {
    if (!data) return [];
    const counts = new Map<string, { label: string; count: number }>();
    for (const m of data.movements) {
      if (m.isReversed || m.isReversal) continue;
      const key = sourceOf(m, data.lookups);
      const label =
        key === DIRECT_SOURCE
          ? "Bought directly"
          : `From ${(m.sourceInventoryId && data.lookups.nodes.get(m.sourceInventoryId)?.name) || "unknown warehouse"}`;
      counts.set(key, { label, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    return [...counts.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => (a.key === DIRECT_SOURCE ? 1 : b.key === DIRECT_SOURCE ? -1 : a.label.localeCompare(b.label)));
  }, [data]);

  const chosen = useMemo(() => {
    if (!data) return [];
    return data.movements.filter((m) => {
      if (m.isReversed || m.isReversal) return false;
      if (!selected.has(sourceOf(m, data.lookups))) return false;
      const day = m.movementDate.slice(0, 10);
      return (!from || day >= from) && (!to || day <= to);
    });
  }, [data, selected, from, to]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  function download() {
    if (!data) return;
    const { columns, rows } = buildBom(chosen, data.lookups);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`Bill-of-materials_${safeFilePart(siteName)}_${date}.csv`, toCsv(columns, rows));
    toast.success("Bill of materials downloaded.");
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={openDialog}>
        Bill of materials
      </button>
      {open ? (
        <ModalPanel kicker="Site" title={`Bill of materials · ${siteName}`} onClose={() => setOpen(false)}>
          <p className="mb-4 text-sm text-black/60">
            Everything this site bought, in one list with a total at the end (before VAT, VAT and with VAT). Choose
            what to include.
          </p>

          {loading ? <p className="py-8 text-center text-sm text-black/50">Loading purchases…</p> : null}
          {error ? <p className="mb-3 text-sm text-bad">{error}</p> : null}

          {data && !loading ? (
            sources.length === 0 ? (
              <p className="border border-dashed border-black/20 p-6 text-center text-sm text-black/50">
                This site has no purchases to list yet.
              </p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-black/50">Include</span>
                  <span className="flex gap-3">
                    <button type="button" className="hover:underline" onClick={() => setSelected(new Set(sources.map((s) => s.key)))}>
                      Select all
                    </button>
                    <button type="button" className="hover:underline" onClick={() => setSelected(new Set())}>
                      Clear
                    </button>
                  </span>
                </div>
                <ul className="max-h-60 divide-y divide-black/10 overflow-y-auto border border-black/10">
                  {sources.map((s) => (
                    <li key={s.key}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-paper/50">
                        <input type="checkbox" checked={selected.has(s.key)} onChange={() => toggle(s.key)} />
                        <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                        <span className="font-mono text-xs text-black/50">
                          {s.count} {s.count === 1 ? "purchase" : "purchases"}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                {!nodeId ? (
                  <p className="mt-2 text-xs text-black/50">Direct purchases could not be loaded for this site.</p>
                ) : null}

                <DateRangeFilter
                  className="mt-4"
                  label="Bought between"
                  from={from}
                  to={to}
                  onChange={(nextFrom, nextTo) => {
                    setFrom(nextFrom);
                    setTo(nextTo);
                  }}
                />
              </>
            )
          ) : null}

          <div className="mt-5 flex items-center justify-between gap-2">
            <span className="text-xs text-black/50">{data ? `${chosen.length} purchases selected` : ""}</span>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn" disabled={loading || chosen.length === 0} onClick={download}>
                Download CSV
              </button>
            </div>
          </div>
        </ModalPanel>
      ) : null}
    </>
  );
}
