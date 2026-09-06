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
import { useSites, useDeleteSite } from "@/hooks/use-sites";
import { useLicenses } from "@/hooks/use-licenses";
import type { Site } from "@/types/api";

export default function SitesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Site>>(closedMode);

  const { data: sitesData, isLoading } = useSites();
  const { data: licensesData } = useLicenses();
  const deleteMutation = useDeleteSite();

  const sites = sitesData ? sitesData.data : (store.sites as unknown as Site[]);
  const licensesList = licensesData ? licensesData.data : store.licenses;

  async function handleDelete() {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
      } catch {
        // Handled
      }
    }
  }

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
            licenses={licensesList}
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
            licenses={licensesList}
            users={store.users}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      {isLoading && !sitesData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading sites...</div>
      ) : (
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
                const license = licensesList.find((l) => l.id === site.licenseId);
                
                // Keep dummy spend for visual until we have the summary API mapped
                const spend = siteSpend(site.id, store);
                
                return (
                  <tr key={site.id}>
                    <td>
                      <Link href={`/sites/${site.id}`} className="font-medium hover:text-yellow">
                        {site.name}
                      </Link>
                      <p className="text-sm text-black/50">{site.location}</p>
                      <p className="mt-1 font-mono text-[0.7rem] text-black/45 sm:hidden">
                        Labor {etb(spend.labor)} · Mat {etb(spend.material)}
                      </p>
                    </td>
                    <td className="hidden md:table-cell">{license?.name}</td>
                    <td className="hidden font-mono text-sm sm:table-cell">
                      {etb(spend.labor)} / {site.laborBudget ? etb(Number(site.laborBudget)) : "—"}
                    </td>
                    <td className="hidden font-mono text-sm sm:table-cell">
                      {etb(spend.material)} / {site.materialBudget ? etb(Number(site.materialBudget)) : "—"}
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
      )}
      <DeleteConfirm 
        mode={mode} 
        restore 
        loading={deleteMutation.isPending}
        onClose={() => setMode(closedMode())} 
        onConfirm={handleDelete}
      />
    </div>
  );
}
