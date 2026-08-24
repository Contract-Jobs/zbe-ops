"use client";

import Link from "next/link";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { etb } from "@/lib/format";
import { siteSpend, useStore, visibleSites } from "@/lib/store";

export default function SitesPage() {
  const store = useStore();
  const sites = visibleSites(store);

  return (
    <div>
      <PageHead kicker="Jobs" title="Sites" />
      <TableWrap>
      <table className="data">
        <thead>
          <tr>
            <th>Site</th>
            <th className="hidden md:table-cell">License</th>
            <th className="hidden sm:table-cell">Labor budget</th>
            <th className="hidden sm:table-cell">Material budget</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => {
            const spend = siteSpend(site.id, store);
            const license = store.licenses.find((l) => l.id === site.licenseId);
            return (
              <tr key={site.id}>
                <td>
                  <Link href={`/sites/${site.id}`} className="font-medium hover:text-yellow">
                    {site.name}
                  </Link>
                  <p className="text-sm text-black/50">{site.address}</p>
                  <p className="mt-1 font-mono text-[0.7rem] text-black/45 sm:hidden">
                    Labor {etb(spend.labor)} · Mat {etb(spend.material)}
                  </p>
                </td>
                <td className="hidden md:table-cell">{license?.name}</td>
                <td className="hidden font-mono text-sm sm:table-cell">
                  {etb(spend.labor)} / {etb(site.laborBudget)}
                </td>
                <td className="hidden font-mono text-sm sm:table-cell">
                  {etb(spend.material)} / {etb(site.materialBudget)}
                </td>
                <td>
                  <Stamp value={site.status} tone={statusTone(site.status)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </TableWrap>
    </div>
  );
}
