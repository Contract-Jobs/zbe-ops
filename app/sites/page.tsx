"use client";

import Link from "next/link";
import { PageHead, Stamp, statusTone } from "@/components/ui";
import { etb } from "@/lib/format";
import { siteSpend, useStore, visibleSites } from "@/lib/store";

export default function SitesPage() {
  const store = useStore();
  const sites = visibleSites(store);

  return (
    <div>
      <PageHead kicker="Jobs" title="Sites" />
      <table className="data">
        <thead>
          <tr>
            <th>Site</th>
            <th>License</th>
            <th>Labor budget</th>
            <th>Material budget</th>
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
                </td>
                <td>{license?.name}</td>
                <td className="font-mono text-sm">
                  {etb(spend.labor)} / {etb(site.laborBudget)}
                </td>
                <td className="font-mono text-sm">
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
    </div>
  );
}
