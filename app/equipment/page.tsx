"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { etb } from "@/lib/format";
import { locationName, useStore, visibleSiteIds, isSiteManager } from "@/lib/store";

export default function EquipmentPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const sites = visibleSiteIds(store);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return store.equipment
      .filter((e) => !e.deletedAt)
      .filter((e) => {
        if (!manager) return true;
        return e.siteId ? sites.has(e.siteId) : false;
      })
      .filter((e) => (term ? e.name.toLowerCase().includes(term) || (e.serialNumber ?? "").toLowerCase().includes(term) : true));
  }, [manager, q, sites, store.equipment]);

  return (
    <div>
      <PageHead kicker="Plant" title="Equipment" />
      <input className="field mb-5 w-full max-w-sm" placeholder="Search name or serial" value={q} onChange={(e) => setQ(e.target.value)} />
      <TableWrap>
      <table className="data">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Where</th>
            <th className="hidden sm:table-cell">Value</th>
            <th className="hidden md:table-cell">Ownership</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td>
                <Link href={`/equipment/${e.id}`} className="font-medium hover:text-yellow">
                  {e.name}
                </Link>
                {e.serialNumber ? <p className="font-mono text-[0.7rem] text-black/45">{e.serialNumber}</p> : null}
              </td>
              <td>
                {e.siteId
                  ? locationName("site", e.siteId, store)
                  : e.warehouseId
                    ? locationName("warehouse", e.warehouseId, store)
                    : "—"}
              </td>
              <td className="hidden font-mono text-sm sm:table-cell">{etb(e.value)}</td>
              <td className="hidden md:table-cell">
                <Stamp value={e.ownershipStatus} />
              </td>
              <td>
                <Stamp value={e.status} tone={statusTone(e.status)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </TableWrap>
    </div>
  );
}
