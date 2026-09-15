"use client";

import { useMemo, useState } from "react";
import { PageHead, TableWrap, Stamp, Username } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useLedgers } from "@/hooks/use-ledgers";
import { useSites } from "@/hooks/use-sites";
import { useLicenses } from "@/hooks/use-licenses";
import type { ProjectLedger, Site, License } from "@/types/api";

export default function LedgerPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const visibleSites = visibleSiteIds(store);

  const [siteId, setSiteId] = useState<string>("");
  const [licenseId, setLicenseId] = useState<string>("");
  const [sourceRefType, setSourceRefType] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: ledgersData, isLoading: isLedgerLoading } = useLedgers({
    page,
    limit: 10,
    siteId: siteId ? [siteId] : undefined,
    licenseId: licenseId ? [licenseId] : undefined,
    sourceRefType: sourceRefType ? [sourceRefType] : undefined,
  });

  const { data: sitesData } = useSites();
  const { data: licensesData } = useLicenses();

  const ledgers = ledgersData?.data ?? [];
  const allSites = (sitesData?.data ?? (store.sites as unknown as Site[])).filter((s) => !s.deletedAt);
  const licenses = (licensesData?.data ?? (store.licenses as unknown as License[])).filter((l) => !l.deletedAt);

  const rows = useMemo(() => {
    return (ledgersData?.data ?? []).filter((l) => {
      if (store.session.licenseId !== "all" && l.licenseId !== store.session.licenseId) return false;
      if (manager) return l.siteId ? visibleSites.has(l.siteId) : false;
      return true;
    });
  }, [manager, visibleSites, store.session.licenseId, ledgersData?.data]);

  return (
    <div>
      <PageHead
        kicker="System"
        title="Project Ledger"
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <select className="field w-48" value={licenseId} onChange={(e) => setLicenseId(e.target.value)}>
          <option value="">All licenses</option>
          {licenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>

        <select className="field w-48" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">All sites</option>
          {allSites
            .filter((s) => (manager ? visibleSites.has(s.id) : true))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>

        <select className="field w-48" value={sourceRefType} onChange={(e) => setSourceRefType(e.target.value)}>
          <option value="">All source types</option>
          <option value="transaction">Transaction</option>
          <option value="material_log">Material Log</option>
          <option value="equipment_log">Equipment Log</option>
          <option value="rental_event">Rental Event</option>
        </select>
      </div>

      {isLedgerLoading && !ledgersData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading ledger entries...</div>
      ) : (
        <TableWrap pagination={ledgersData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Location</th>
                <th>Source</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const desc = row.description || (row.sourceRefType === "material_log" ? "Material transaction" : "Ledger entry");
                const isOut = Number(row.amount) < 0;
                const siteName = row.siteId ? allSites.find(s => s.id === row.siteId)?.name : "HQ";

                return (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap text-sm text-black/60">
                      {day(row.timestamp)}
                    </td>
                    <td className="whitespace-nowrap">
                      {siteName}
                    </td>
                    <td className="whitespace-nowrap text-sm font-mono">
                      {row.sourceRefType}
                      {row.isReversal ? <span className="ml-2"><Stamp value="reversal" tone="bad" /></span> : null}
                    </td>
                    <td className="text-sm">
                      <div className="font-medium">{desc}</div>
                      {row.loggedBy && <div className="text-black/50 mt-1">By <Username userId={row.loggedBy} fallback={row.loggedBy} /></div>}
                    </td>
                    <td className={`font-mono text-sm ${isOut ? "text-red-600" : "text-green-600"}`}>
                      {isOut ? "-" : "+"}
                      {etb(Math.abs(Number(row.amount)))}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-black/45">
                    No ledger entries found matching filters.
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
