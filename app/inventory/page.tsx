"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, TableWrap } from "@/components/ui";
import { qty } from "@/lib/format";
import { isSiteManager, locationName, useStore, visibleSiteIds } from "@/lib/store";
import { useInventoryBalances } from "@/hooks/use-inventory";
import { useMaterials } from "@/hooks/use-materials";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import type { InventoryBalance, MaterialCatalog, Site, Warehouse } from "@/types/api";

export default function InventoryPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSites = visibleSiteIds(store);
  const [q, setQ] = useState("");

  const { data: balancesData, isLoading: isBalancesLoading } = useInventoryBalances();
  const { data: materialsData } = useMaterials();
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();

  const materials = materialsData?.data ?? (store.materials as unknown as MaterialCatalog[]);
  const sitesList = sitesData?.data ?? (store.sites as unknown as Site[]);
  const warehousesList = warehousesData?.data ?? (store.warehouses as unknown as Warehouse[]);

  const balances = balancesData?.data ?? (store.balances as unknown as InventoryBalance[]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return balances
      .filter((b) => b.quantity !== 0)
      .map((b) => {
        const materialId = (b as unknown as { catalogId?: string }).catalogId ?? b.materialId;
        const locationKind =
          (b as unknown as { locationKind?: "site" | "warehouse" }).locationKind ??
          (b.siteId ? "site" : "warehouse");
        const locationId = (b as unknown as { locationId?: string }).locationId ?? (b.siteId || b.warehouseId || "");
        const mat = materials.find((m) => m.id === materialId);

        let locName = locationName(locationKind, locationId, store);
        if (locationKind === "site") {
          const s = sitesList.find((site) => site.id === locationId);
          if (s) locName = s.name;
        } else if (locationKind === "warehouse") {
          const w = warehousesList.find((wh) => wh.id === locationId);
          if (w) locName = w.name;
        }

        return {
          id: b.id ?? `${materialId}-${locationKind}-${locationId}`,
          materialId,
          locationKind,
          locationId,
          locationName: locName,
          quantity: b.quantity,
          name: mat?.name ?? materialId,
          unit: mat?.unit ?? "pcs",
        };
      })
      .filter((b) => {
        if (!manager) return true;
        if (b.locationKind === "warehouse") return false;
        return allowedSites.has(b.locationId);
      })
      .filter((b) => (term ? b.name.toLowerCase().includes(term) : true));
  }, [allowedSites, balances, manager, materials, q, sitesList, store, warehousesList]);

  return (
    <div>
      <PageHead kicker="Stock" title="Inventory balances" />
      {manager ? (
        <p className="mb-4 text-sm text-black/60">Site desk shows only stock on your jobs — not central yards.</p>
      ) : null}
      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isBalancesLoading && !balancesData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading inventory balances...</div>
      ) : (
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Material</th>
                <th>Location</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/materials/${b.materialId}`} className="font-medium hover:text-yellow">
                      {b.name}
                    </Link>
                  </td>
                  <td>
                    {b.locationName}
                    <span className="block font-mono text-[0.65rem] uppercase text-black/40">
                      {b.locationKind}
                    </span>
                  </td>
                  <td className="font-mono">{qty(b.quantity, b.unit)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-sm text-black/45">
                    No inventory balances found.
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

