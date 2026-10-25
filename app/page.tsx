"use client";

import { APPROVALS_VISIBLE } from "@/lib/features";
import Link from "next/link";
import { useMemo, useState } from "react";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useApprovals } from "@/hooks/use-approvals";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useSites } from "@/hooks/use-sites";
import { useSpendAnalytics, useScopedBudgetHealth, useSalesAnalytics } from "@/hooks/use-analytics";
import type { Approval, BudgetHealthEntry, IndividualEquipmentItem, Site } from "@/types/api";

export default function BoardPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSiteIds = visibleSiteIds(store);

  const { data: approvalsData } = useApprovals({ status: ["pending"] });
  // These stat tiles count across ALL equipment — the endpoint's default
  // page size of 10 was silently undercounting "on loan"/maintenance once
  // the fleet grew past that.
  const { data: equipmentData } = useEquipmentList({ limit: 50 });
  const [sitePage, setSitePage] = useState(1);
  const [spendFilters, setSpendFilters] = useState<QueryFilterValues>({});
  const [salesFilters, setSalesFilters] = useState<QueryFilterValues>({});
  const { data: sitesData } = useSites({ page: sitePage, limit: 50 });
  // A site manager's analytics always name one of their own sites (the API
  // refuses another site, a warehouse filter, or no site at all).
  const ownSiteIds = Array.from(allowedSiteIds).sort();
  const noSite = manager && ownSiteIds.length === 0;
  const spendSiteId = spendFilters.siteId || (manager ? ownSiteIds[0] : undefined);
  const { data: spendData } = useSpendAnalytics(
    {
      siteId: spendSiteId,
      warehouseId: manager ? undefined : spendFilters.warehouseId || undefined,
      licenseId: spendFilters.licenseId || undefined,
      dateFrom: spendFilters.dateFrom || undefined,
      dateTo: spendFilters.dateTo || undefined,
    },
    { enabled: !noSite },
  );
  const { data: budgetHealth } = useScopedBudgetHealth({ manager, siteIds: ownSiteIds });
  const { data: salesAnalyticsData } = useSalesAnalytics(
    {
      warehouseId: salesFilters.warehouseId || undefined,
      licenseId: salesFilters.licenseId || undefined,
      dateFrom: salesFilters.dateFrom || undefined,
      dateTo: salesFilters.dateTo || undefined,
    },
    { enabled: !manager },
  );

  const sites = useMemo(() => {
    const list = sitesData?.data ?? (store.sites as unknown as Site[]);
    return list
      .filter((s) => !s.deletedAt)
      .filter((s) => (manager ? allowedSiteIds.has(s.id) : true));
  }, [allowedSiteIds, manager, sitesData?.data, store.sites]);

  const pending = useMemo(() => {
    const list = approvalsData?.data ?? (store.approvals as unknown as Approval[]);
    return list.filter((a) => a.status === "pending");
  }, [approvalsData?.data, store.approvals]);

  const equipment = useMemo(() => {
    const list: IndividualEquipmentItem[] = equipmentData?.data ?? [];
    return list.filter((e) => !e.deletedAt);
  }, [equipmentData?.data]);

  const onLoan = useMemo(() => {
    return equipment.filter((e) => e.assignmentStatus === "rented_to_client" || e.assignmentStatus === "rented_from_client");
  }, [equipment]);

  const maintenance = useMemo(() => {
    return equipment.filter((e) => e.condition === "under_maintenance");
  }, [equipment]);

  const totalSpendDisplay = spendData?.data ? Number(spendData.data.totalSpend) : 0;

  const healths: BudgetHealthEntry[] = budgetHealth;

  const getHealthEntry = (siteId: string): BudgetHealthEntry | undefined =>
    healths.find((h) => h.siteId === siteId);

  const salesAnalytics = salesAnalyticsData?.data;
  const profitability = salesAnalytics?.profitability;
  const siteSales = salesAnalytics?.siteSales;

  return (
    <div>
      <PageHead kicker="Today" title={manager ? "Sites board" : "Warehouse and site board"} />

      <div className="grid gap-px bg-black/10 sm:grid-cols-2">
        {APPROVALS_VISIBLE ? <Stat label="Pending approvals" value={String(pending.length)} href="/approvals" /> : null}
        <Stat label="Plant on loan" value={String(onLoan.length)} href="/equipment" />
      </div>

      <QueryFilters
        className="mt-8 mb-3"
        title="Spend"
        fields={manager ? ["siteId", "licenseId", "dateFrom", "dateTo"] : ["siteId", "warehouseId", "licenseId", "dateFrom", "dateTo"]}
        values={manager ? { ...spendFilters, siteId: spendSiteId ?? "" } : spendFilters}
        onChange={setSpendFilters}
      />

      {spendData?.data && (
        <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total Spent" value={etb(totalSpendDisplay)} href="/ledger" />
          <Stat label="Material Spend" value={etb(Number(spendData.data.materialSpend))} href="/ledger" />
          <Stat label="Labour Spend" value={etb(Number(spendData.data.laborSpend))} href="/ledger" />
          <Stat label="Other Spend" value={etb(Number(spendData.data.otherSpend))} href="/ledger" />
          <Stat label="Equipment Capital" value={etb(Number(spendData.data.equipmentValue))} href="/equipment" />
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="kicker mb-3">Budget health</p>
          <TableWrap pagination={sitesData?.pagination} onPageChange={setSitePage}>
            <table className="data">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Labor Performance</th>
                  <th className="hidden md:table-cell">Material Performance</th>
                  <th className="hidden lg:table-cell">Other Spends</th>
                  <th className="hidden sm:table-cell">Budget Performance</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  const entry = getHealthEntry(site.id);
                  const laborSpent = Number(entry?.laborSpent ?? 0);
                  const laborBudget = Number(entry?.laborBudget ?? site.laborBudget ?? 0);
                  const materialSpent = Number(entry?.materialSpent ?? 0);
                  const materialBudget = Number(entry?.materialBudget ?? site.materialBudget ?? 0);
                  const otherSpent = Number(entry?.otherSpent ?? 0);
                  const totalSpent = Number(entry?.totalSpent ?? 0);
                  const totalBudget = Number(entry?.totalBudget ?? (laborBudget + materialBudget));

                  return (
                    <tr key={site.id}>
                      <td>
                        <Link href={`/sites/${site.id}`} className="font-medium hover:text-yellow">
                          {site.name}
                        </Link>
                        <div className="mt-1">
                          <Stamp value={site.status} tone={statusTone(site.status)} />
                        </div>
                      </td>

                      {/* Labor Performance */}
                      <td className="font-mono text-sm">
                        {etb(laborSpent)}
                        <span className="block text-[0.7rem] text-black/45">of {etb(laborBudget)}</span>
                        <Bar used={laborSpent} max={laborBudget} />
                      </td>

                      {/* Material Performance */}
                      <td className="hidden font-mono text-sm md:table-cell">
                        {etb(materialSpent)}
                        <span className="block text-[0.7rem] text-black/45">of {etb(materialBudget)}</span>
                        <Bar used={materialSpent} max={materialBudget} />
                      </td>

                      {/* Other Spends */}
                      <td className="hidden font-mono text-sm lg:table-cell">
                        {etb(otherSpent)}
                      </td>

                      {/* Total Budget Performance */}
                      <td className="hidden font-mono text-sm sm:table-cell">
                        {etb(totalSpent)}
                        <span className="block text-[0.7rem] text-black/45">of {etb(totalBudget)}</span>
                        <Bar used={totalSpent} max={totalBudget} />
                      </td>
                    </tr>
                  );
                })}
                {sites.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-black/45">
                      No active sites found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section className="flex flex-col gap-10">
          {!manager ? (
          <div>
            <p className="kicker mb-3">Sales Overview</p>
            <QueryFilters
              fields={["warehouseId", "licenseId", "dateFrom", "dateTo"]}
              values={salesFilters}
              onChange={setSalesFilters}
            />
            {salesAnalytics ? (
              <>
              <div className="grid gap-px bg-black/10">
                <div className="bg-white p-4">
                  <p className="text-sm font-medium text-black/60">Revenue before VAT</p>
                  <p className="mt-1 font-mono text-xl">{etb(salesAnalytics.totalRevenue)}</p>
                </div>
                {salesAnalytics.totalVat !== undefined ? (
                  <div className="bg-white p-4">
                    <p className="text-sm font-medium text-black/60">VAT charged</p>
                    <p className="mt-1 font-mono text-xl">{etb(salesAnalytics.totalVat)}</p>
                  </div>
                ) : null}
                {salesAnalytics.totalGrossRevenue !== undefined ? (
                  <div className="bg-white p-4">
                    <p className="text-sm font-medium text-black/60">Invoiced incl. VAT</p>
                    <p className="mt-1 font-mono text-xl">{etb(salesAnalytics.totalGrossRevenue)}</p>
                    <p className="mt-1 text-xs text-black/50">Cash collected and what is owed are counted on this.</p>
                  </div>
                ) : null}
                <div className="bg-white p-4">
                  <p className="text-sm font-medium text-black/60">Sold Equipment</p>
                  <p className="mt-1 font-mono text-xl">{salesAnalytics.equipmentSaleCount} <span className="text-sm text-black/50">units</span></p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-sm font-medium text-black/60">Sold Materials</p>
                  <p className="mt-1 font-mono text-xl">{salesAnalytics.materialSaleCount} <span className="text-sm text-black/50">batches</span></p>
                </div>
              </div>
              {profitability ? (
                <div className="mt-6">
                  <p className="kicker mb-3">Material profitability (external buyers)</p>
                  <div className="grid gap-px bg-black/10 sm:grid-cols-2">
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Revenue</p>
                      <p className="mt-1 font-mono text-xl">{etb(profitability.revenue)}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Cost of goods sold</p>
                      <p className="mt-1 font-mono text-xl">{etb(profitability.cogs)}</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Gross profit</p>
                      <p className="mt-1 font-mono text-xl">{etb(profitability.grossProfit)}</p>
                      <p className="mt-1 font-mono text-xs text-black/50">{profitability.marginPct} margin</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Profit on cash collected (before VAT)</p>
                      <p className="mt-1 font-mono text-xl">{etb(profitability.actualProfit)}</p>
                      <p className="mt-1 font-mono text-xs text-black/50">
                        {etb(profitability.unrealizedProfit)} still in receivables
                      </p>
                    </div>
                  </div>
                  {profitability.estimatedCogsSaleCount > 0 ? (
                    <p className="mt-2 text-xs text-black/55">
                      Includes {profitability.estimatedCogsSaleCount} sale
                      {profitability.estimatedCogsSaleCount === 1 ? "" : "s"} with estimated cost.
                    </p>
                  ) : null}
                  {profitability.missingCogsSaleCount > 0 ? (
                    <p className="mt-2 text-xs text-[var(--warn)]">
                      {profitability.missingCogsSaleCount} sale
                      {profitability.missingCogsSaleCount === 1 ? " has" : "s have"} no cost recorded and{" "}
                      {profitability.missingCogsSaleCount === 1 ? "is" : "are"} left out of these figures. Ask an
                      administrator to run the cost backfill.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {siteSales && siteSales.saleCount > 0 ? (
                <div className="mt-6">
                  <p className="kicker mb-3">Sales to sites</p>
                  <div className="grid gap-px bg-black/10 sm:grid-cols-2">
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Revenue before VAT</p>
                      <p className="mt-1 font-mono text-xl">{etb(siteSales.revenue)}</p>
                      <p className="mt-1 font-mono text-xs text-black/50">
                        {siteSales.saleCount} sales
                        {siteSales.vat !== undefined ? ` · VAT ${etb(siteSales.vat)}` : ""}
                      </p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Gross profit</p>
                      <p className="mt-1 font-mono text-xl">{etb(siteSales.profitability.grossProfit)}</p>
                      <p className="mt-1 font-mono text-xs text-black/50">{siteSales.profitability.marginPct} margin</p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Received from sites</p>
                      <p className="mt-1 font-mono text-xl">
                        {siteSales.cashReceived === null ? "—" : etb(siteSales.cashReceived)}
                      </p>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-sm font-medium text-black/60">Sites owe</p>
                      <p className="mt-1 font-mono text-xl">
                        {siteSales.outstandingBalance === null ? "—" : etb(siteSales.outstandingBalance)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-black/55">
                    Profit is counted before VAT, when the material is sold, since sites pay a balance (VAT included) rather than each sale.
                    {siteSales.cashReceived === null ? " Cash and balance are not shown under a license filter." : ""}
                  </p>
                  {siteSales.profitability.estimatedCogsSaleCount > 0 ? (
                    <p className="mt-1 text-xs text-black/55">
                      Includes {siteSales.profitability.estimatedCogsSaleCount} with estimated cost.
                    </p>
                  ) : null}
                  {siteSales.profitability.missingCogsSaleCount > 0 ? (
                    <p className="mt-1 text-xs text-[var(--warn)]">
                      {siteSales.profitability.missingCogsSaleCount} have no cost recorded and are left out of the
                      profit figures.
                    </p>
                  ) : null}
                </div>
              ) : null}
              </>
            ) : (
              <p className="text-sm text-black/45">No sales in this range.</p>
            )}
          </div>
          ) : null}

          <div>
            {APPROVALS_VISIBLE ? (
              <>
            <p className="kicker mb-3">Waiting on you</p>
            <ul className="border border-black/10">
              {pending.slice(0, 6).map((a) => {
                const summary = (a as unknown as { summary?: string }).summary ??
                  (a.notes || `${a.approvalType.replaceAll("_", " ")} #${a.recordId?.slice(0, 8) ?? a.id.slice(0, 8)}`);

                return (
                  <li key={a.id} className="border-b border-black/10 last:border-0">
                    <Link href={`/approvals/${a.id}`} className="block border-l-2 border-yellow px-4 py-3 hover:bg-paper/50">
                      <p className="text-sm font-medium leading-snug">{summary}</p>
                      <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-black/45">
                        {a.approvalType.replaceAll("_", " ")}
                      </p>
                    </Link>
                  </li>
                );
              })}
              {pending.length === 0 ? (
                <li className="px-4 py-8 text-center text-black/45">Queue is clear.</li>
              ) : null}
            </ul>
              </>
            ) : null}
            {maintenance.length > 0 ? (
              <p className="mt-6 text-sm text-black/70">
                In the shop: {maintenance.map((e) => e.identifier).join(", ")}.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="block bg-white p-5 hover:bg-paper/60">
      <p className="kicker">{label}</p>
      <p className="mt-3 break-words text-[1.45rem] tracking-[-0.04em] sm:text-[1.85rem]">{value}</p>
    </Link>
  );
}

function Bar({ used, max }: { used: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((used / max) * 100));
  return (
    <span className="mt-1 block h-1 w-full max-w-28 bg-black/10">
      <span className="block h-1 bg-yellow" style={{ width: `${pct}%` }} />
    </span>
  );
}

