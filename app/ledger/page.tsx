"use client";

import { useMemo, useState } from "react";
import { PageHead, TableWrap, Stamp, Username } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useLedgers } from "@/hooks/use-ledgers";
import { useSitesInBulk } from "@/hooks/use-sites";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { SortSelect, type SortState } from "@/components/SortSelect";
import type { LedgerSortBy } from "@/lib/api/ledgers";

const LEDGER_SORT_OPTIONS: { value: LedgerSortBy; label: string }[] = [
  { value: "timestamp", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "createdAt", label: "Created" },
];

export default function LedgerPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const visibleSites = visibleSiteIds(store);

  const [filters, setFilters] = useState<QueryFilterValues>({});
  const [sort, setSort] = useState<SortState<LedgerSortBy>>({ sortBy: "timestamp", sortOrder: "desc" });
  const [page, setPage] = useState(1);

  const { data: ledgersData, isLoading: isLedgerLoading } = useLedgers({
    page,
    limit: 10,
    siteId: filters.siteId ? [filters.siteId] : undefined,
    licenseId: filters.licenseId ? [filters.licenseId] : undefined,
    sourceRefType: filters.sourceRefType ? [filters.sourceRefType] : undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    direction: filters.direction || undefined,
    minAmount: filters.minAmount || undefined,
    maxAmount: filters.maxAmount || undefined,
    includeReversed: filters.includeReversed || undefined,
    categoryId: filters.categoryId || undefined,
    search: filters.search || undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  });

  const rows = useMemo(() => {
    return (ledgersData?.data ?? []).filter((l) => {
      if (store.session.licenseId !== "all" && l.licenseId !== store.session.licenseId) return false;
      if (manager) return l.siteId ? visibleSites.has(l.siteId) : false;
      return true;
    });
  }, [manager, visibleSites, store.session.licenseId, ledgersData?.data]);

  const siteIds = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.siteId).filter((id): id is string => Boolean(id))));
  }, [rows]);

  const { data: bulkSitesData } = useSitesInBulk(siteIds);

  const sitesMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of bulkSitesData?.data ?? []) map.set(s.id, s.name);
    return map;
  }, [bulkSitesData]);

  return (
    <div>
      <PageHead
        kicker="System"
        title="Project Ledger"
      />

      <QueryFilters
        className="mb-3"
        searchPlaceholder="Description or note"
        fields={[
          "search",
          "licenseId",
          "siteId",
          "sourceRefType",
          "categoryId",
          "direction",
          "dateFrom",
          "dateTo",
          "minAmount",
          "maxAmount",
          "includeReversed",
        ]}
        values={filters}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
      />
      <div className="mb-6">
        <SortSelect
          options={LEDGER_SORT_OPTIONS}
          value={sort}
          onChange={(next) => {
            setSort(next);
            setPage(1);
          }}
        />
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
                const desc = row.description || (row.sourceRefType === "material" ? "Material transaction" : "Ledger entry");
                const isOut = Number(row.amount) < 0;
                const siteName = row.siteId ? sitesMap.get(row.siteId) ?? row.siteId : "HQ";

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
