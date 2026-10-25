"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListToolbar } from "@/components/ListToolbar";
import { SortSelect, type SortState } from "@/components/SortSelect";

type SiteSortBy = "name" | "location" | "status" | "createdAt" | "updatedAt" | "laborBudget" | "materialBudget" | "otherBudget";

const SITE_SORT_OPTIONS: { value: SiteSortBy; label: string }[] = [
  { value: "createdAt", label: "Created" },
  { value: "name", label: "Name" },
  { value: "location", label: "Location" },
  { value: "status", label: "Status" },
  { value: "updatedAt", label: "Updated" },
  { value: "laborBudget", label: "Labor budget" },
  { value: "materialBudget", label: "Material budget" },
  { value: "otherBudget", label: "Other budget" },
];
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
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useSites, useDeleteSite, useRestoreSite } from "@/hooks/use-sites";
import { useLicenses, useLicensesInBulk } from "@/hooks/use-licenses";
import { useScopedBudgetHealth } from "@/hooks/use-analytics";
import type { Site } from "@/types/api";

export default function SitesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Site>>(closedMode);
  const [showDeleted, setShowDeleted] = useState(false);

  const [page, setPage] = useState(1);

  const [sort, setSort] = useState<SortState<SiteSortBy>>({ sortBy: "createdAt", sortOrder: "desc" });

  const { data: sitesData, isLoading } = useSites({ page, limit: 10, ...sort });
  const { data: licensesData } = useLicenses();
  const { data: budgetHealth } = useScopedBudgetHealth({ manager: isSiteManager(store), siteIds: Array.from(visibleSiteIds(store)).sort() });
  const deleteMutation = useDeleteSite();
  const restoreMutation = useRestoreSite();

  const sites = sitesData ? sitesData.data : (store.sites as unknown as Site[]);
  const licensesList = licensesData ? licensesData.data : store.licenses;
  const spendBySite = new Map(budgetHealth.map((b) => [b.siteId, b]));

  const licenseIds = useMemo(() => {
    return Array.from(new Set(sites.map((s) => s.licenseId).filter(Boolean)));
  }, [sites]);

  const { data: bulkLicensesData } = useLicensesInBulk(licenseIds);

  const licensesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of bulkLicensesData?.data ?? []) map.set(l.id, l.name);
    return map;
  }, [bulkLicensesData]);

  // Site manager scoping: filter client-side against visible sites from the store
  const visibleIds = useMemo(() => Array.from(visibleSiteIds(store)), [store]);

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

  async function handleRestore(id: string) {
    try {
      await restoreMutation.mutateAsync(id);
    } catch {
      // Handled
    }
  }

  return (
    <div>
      <PageHead
        kicker="Jobs"
        title="Sites"
        action={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show deleted
            </label>
            {canMutate ? <RecordActions newLabel="New site" onNew={() => setMode({ kind: "create" })} /> : undefined}
          </div>
        }
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
      <ListToolbar
        sort={
          <SortSelect
            options={SITE_SORT_OPTIONS}
            value={sort}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      />
      {isLoading && !sitesData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading sites...</div>
      ) : (
        <TableWrap pagination={sitesData?.pagination} onPageChange={setPage}>
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
                const spend = spendBySite.get(site.id);
                return (
                  <tr key={site.id}>
                    <td>
                      <Link href={`/sites/${site.id}`} className="font-medium hover:text-yellow">
                        {site.name}
                      </Link>
                      <p className="text-sm text-black/50">{site.name}</p>
                      <p className="mt-1 font-mono text-[0.7rem] text-black/45 sm:hidden">
                        Labor {etb(spend?.laborSpent ?? "0.00")} · Mat {etb(spend?.materialSpent ?? "0.00")}
                      </p>
                    </td>
                    <td className="hidden md:table-cell">{licensesMap.get(site.licenseId)}</td>
                    <td className="hidden font-mono text-sm sm:table-cell">
                      {etb(spend?.laborSpent ?? "0.00")} / {site.laborBudget ? etb(Number(site.laborBudget)) : "—"}
                    </td>
                    <td className="hidden font-mono text-sm sm:table-cell">
                      {etb(spend?.materialSpent ?? "0.00")} / {site.materialBudget ? etb(Number(site.materialBudget)) : "—"}
                    </td>
                    <td>
                      <Stamp value={site.status} tone={statusTone(site.status)} />
                    </td>
                    {canMutate ? (
                      <td>
                        <RecordActions
                          onEdit={!site.deletedAt ? () => setMode({ kind: "edit", record: site }) : undefined}
                          onDelete={!site.deletedAt ? () => setMode({ kind: "delete", record: site, label: site.name }) : undefined}
                          onRestore={site.deletedAt ? () => handleRestore(site.id) : undefined}
                          restoreDisabled={restoreMutation.isPending}
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
