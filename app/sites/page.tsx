"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteForm } from "@/components/forms/site";
import {
  closedMode,
  DeleteConfirm,
  FormPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  type RecordMode,
} from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, siteSpend, useStore, visibleSites } from "@/lib/store";
import type { Site } from "@/lib/types";

export default function SitesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const sites = visibleSites(store);
  const [mode, setMode] = useState<RecordMode<Site>>(closedMode);

  return (
    <div>
      <PageHead
        kicker="Jobs"
        title="Sites"
        action={canMutate ? <RecordActions newLabel="New site" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Jobs" title="New site" onClose={() => setMode(closedMode())}>
          <SiteForm
            licenses={store.licenses}
            users={store.users}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Jobs" title="Edit site" onClose={() => setMode(closedMode())}>
          <SiteForm
            initial={mode.record}
            licenses={store.licenses}
            users={store.users}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <TableWrap>
        <table className="data">
          <thead>
            <tr>
              <th>Site</th>
              <th className="hidden md:table-cell">License</th>
              <th className="hidden sm:table-cell">Labor budget</th>
              <th className="hidden sm:table-cell">Material budget</th>
              <th>Status</th>
              {canMutate ? <th></th> : null}
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
                  {canMutate ? (
                    <td>
                      <RecordActions
                        onEdit={() => setMode({ kind: "edit", record: site })}
                        onDelete={() => setMode({ kind: "delete", record: site, label: site.name })}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <DeleteConfirm mode={mode} restore onClose={() => setMode(closedMode())} />
    </div>
  );
}
