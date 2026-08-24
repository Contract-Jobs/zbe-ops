"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead } from "@/components/ui";
import { qty } from "@/lib/format";
import { isSiteManager, locationName, useStore, visibleSiteIds } from "@/lib/store";

export default function InventoryPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSites = visibleSiteIds(store);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return store.balances
      .filter((b) => b.quantity !== 0)
      .filter((b) => {
        if (!manager) return true;
        if (b.locationKind === "warehouse") return false;
        return allowedSites.has(b.locationId);
      })
      .map((b) => {
        const mat = store.materials.find((m) => m.id === b.catalogId);
        return { ...b, name: mat?.name ?? b.catalogId, unit: mat?.unit ?? "pcs" };
      })
      .filter((b) => (term ? b.name.toLowerCase().includes(term) : true));
  }, [allowedSites, manager, q, store.balances, store.materials]);

  return (
    <div>
      <PageHead kicker="Stock" title="Inventory balances" />
      {manager ? (
        <p className="mb-4 text-sm text-black/60">Site desk shows only stock on your jobs — not central yards.</p>
      ) : null}
      <input className="field mb-5 max-w-sm" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
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
            <tr key={`${b.catalogId}-${b.locationKind}-${b.locationId}`}>
              <td>
                <Link href={`/materials/${b.catalogId}`} className="font-medium hover:text-yellow">
                  {b.name}
                </Link>
              </td>
              <td>
                {locationName(b.locationKind, b.locationId, store)}
                <span className="block font-mono text-[0.65rem] uppercase text-black/40">{b.locationKind}</span>
              </td>
              <td className="font-mono">{qty(b.quantity, b.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
