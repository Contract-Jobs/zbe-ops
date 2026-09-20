"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useApprovals } from "@/hooks/use-approvals";
import { useEquipmentList } from "@/hooks/use-equipment";
import { useSites } from "@/hooks/use-sites";
import { useSpendAnalytics, useBudgetHealth, useSalesAnalytics } from "@/hooks/use-analytics";
import type { Approval, BudgetHealthEntry, Equipment, Site } from "@/types/api";

export default function BoardPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const allowedSiteIds = visibleSiteIds(store);

  const { data: approvalsData } = useApprovals({ status: ["pending"] });
  const { data: equipmentData } = useEquipmentList();
  const [sitePage, setSitePage] = useState(1);
  const { data: sitesData } = useSites({ page: sitePage, limit: 20000 });
  const { data: spendData } = useSpendAnalytics();
  const { data: budgetHealthData } = useBudgetHealth();
  const { data: salesAnalyticsData } = useSalesAnalytics();

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
    const list = equipmentData?.data ?? (store.equipment as unknown as Equipment[]);
    return list.filter((e) => !e.deletedAt);
  }, [equipmentData?.data, store.equipment]);

  const onLoan = useMemo(() => {
    return equipment.filter((e) => (e as unknown as { isOnLoan?: boolean }).isOnLoan);
  }, [equipment]);

  const maintenance = useMemo(() => {
    return equipment.filter(
      (e) => e.currentStatus === "maintenance" || (e as unknown as { status?: string }).status === "maintenance"
    );
  }, [equipment]);

  const totalSpendDisplay = spendData?.data ? Number(spendData.data.totalSpend) : 0;

  const healths: BudgetHealthEntry[] = budgetHealthData?.data ?? [];

  const getHealthEntry = (siteId: string): BudgetHealthEntry | undefined =>
    healths.find((h) => h.siteId === siteId);

  let salesAnalytics = salesAnalyticsData?.data;
  if (!salesAnalyticsData) {
    let eqTotal = 0;
    let eqCount = 0;
    store.equipmentLogs
      .filter((l) => l.logType === "sale" && !l.isReversal)
      .forEach((l) => {
        eqCount++;
        eqTotal += Number(l.price) || 0;
      });

    let matTotal = 0;
    let matCount = 0;
    store.materialLogs
      .filter((l) => l.logType === "sale" && !l.isReversal)
      .forEach((l) => {
        matCount++;
        matTotal += Number(l.unitPrice) || 0;
      });

    salesAnalytics = {
      soldEquipmentCount: eqCount,
      soldEquipmentTotal: String(eqTotal),
      soldMaterialCount: matCount,
      soldMaterialTotal: String(matTotal),
      totalCount: eqCount + matCount,
      totalRevenue: String(eqTotal + matTotal),
    } as import("@/types/api").SalesAnalytics;
  }

  return (
    <div>
      <PageHead kicker="Today" title="Warehouse and site board" />

      <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pending approvals" value={String(pending.length)} href="/approvals" />
        <Stat label="Total Spent" value={etb(totalSpendDisplay)} href="/ledger" />
        <Stat label="Plant on loan" value={String(onLoan.length)} href="/equipment" />
      </div>

      {spendData?.data && (
        <div className="mt-px grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Material Spend" value={etb(Number(spendData.data.materialSpend))} href="/ledger" />
          <Stat label="Labour Spend" value={etb(Number(spendData.data.laborSpend))} href="/ledger" />
          <Stat label="Other Spend" value={etb(Number(spendData.data.otherSpend))} href="/ledger" />
          <Stat label="Equipment Capital" value={etb(Number(spendData.data.totalEquipmentValue))} href="/equipment" />
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
          {salesAnalytics && (
            <div>
              <p className="kicker mb-3">Sales Overview</p>
              <div className="grid gap-px bg-black/10">
                <div className="bg-white p-4">
                  <p className="text-sm font-medium text-black/60">Total Revenue</p>
                  <p className="mt-1 font-mono text-xl">{etb(Number(salesAnalytics.totalRevenue))}</p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-sm font-medium text-black/60">Sold Equipment</p>
                  <p className="mt-1 font-mono text-xl">{salesAnalytics.soldEquipmentCount} <span className="text-sm text-black/50">units</span></p>
                </div>
                <div className="bg-white p-4">
                  <p className="text-sm font-medium text-black/60">Sold Materials</p>
                  <p className="mt-1 font-mono text-xl">{salesAnalytics.soldMaterialCount} <span className="text-sm text-black/50">batches</span></p>
                </div>
              </div>
            </div>
          )}

          <div>
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
            {maintenance.length > 0 ? (
              <p className="mt-6 text-sm text-black/70">
                In the shop: {maintenance.map((e) => e.name).join(", ")}.
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

