"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, TableWrap, Stamp } from "@/components/ui";
import { qty } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useInventoryLocations } from "@/hooks/use-inventory";
import type { InventoryLocationSummary } from "@/types/api";

export default function InventoryPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSites = visibleSiteIds(store);
  const [q, setQ] = useState("");

  const { data: locationsData, isLoading } = useInventoryLocations();

  const locations = useMemo(() => {
    // If backend returns data, use it
    if (locationsData?.data) {
      return locationsData.data;
    }

    // Otherwise, compute fallback from store
    const computed: InventoryLocationSummary[] = [];

    // Group warehouses
    for (const w of store.warehouses) {
      if (manager) continue;
      const wBals = store.balances.filter(b => b.locationKind === "warehouse" && b.locationId === w.id && b.quantity > 0);
      const wEqs = store.equipment.filter(e => e.warehouseId === w.id);
      computed.push({
        id: w.id,
        name: w.name,
        type: "warehouse",
        materialTypesCount: wBals.length,
        materialQuantityTotal: wBals.reduce((sum, b) => sum + b.quantity, 0),
        equipmentCount: wEqs.length
      });
    }

    // Group sites
    for (const s of store.sites) {
      if (manager && !allowedSites.has(s.id)) continue;
      const sBals = store.balances.filter(b => b.locationKind === "site" && b.locationId === s.id && b.quantity > 0);
      const sEqs = store.equipment.filter(e => e.siteId === s.id);
      computed.push({
        id: s.id,
        name: s.name,
        type: "site",
        materialTypesCount: sBals.length,
        materialQuantityTotal: sBals.reduce((sum, b) => sum + b.quantity, 0),
        equipmentCount: sEqs.length
      });
    }

    return computed;
  }, [locationsData, store.balances, store.equipment, store.sites, store.warehouses, manager, allowedSites]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return locations;
    return locations.filter((l) => l.name.toLowerCase().includes(term));
  }, [locations, q]);

  return (
    <div>
      <PageHead kicker="Stock" title="Inventory Locations" />
      {manager ? (
        <p className="mb-4 text-sm text-black/60">Site desk shows only stock on your jobs — not central warehouses.</p>
      ) : null}
      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Search locations"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading && !locationsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading inventory locations...</div>
      ) : (
        <TableWrap>
          <table className="data w-full text-left">
            <thead>
              <tr>
                <th>Location</th>
                <th>Material Types</th>
                <th>Total Qty</th>
                <th>Equipment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/inventory/${l.id}`} className="font-medium hover:text-yellow">
                      {l.name}
                    </Link>
                    <span className="ml-3 font-mono text-[0.65rem] uppercase text-black/40">
                      {l.type}
                    </span>
                  </td>
                  <td className="font-mono">{l.materialTypesCount}</td>
                  <td className="font-mono">{qty(l.materialQuantityTotal, "")}</td>
                  <td className="font-mono">{l.equipmentCount}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-black/45">
                    No locations found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}

