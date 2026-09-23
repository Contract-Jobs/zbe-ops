"use client";

import { useState } from "react";
import { PageHead, TableWrap } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useCompanyFinancials } from "@/hooks/use-analytics";
import { useLicenses } from "@/hooks/use-licenses";

// Admin/superadmin only — the whole-company income/expense decomposition
// new_api.md/migration.md both call out as having no legacy equivalent:
// every other financial analytics endpoint sums project_ledger, which only
// ever has entries for a real site, so this is the only place non-site
// spend (warehouse-anchored + corporate) and all income (inherently
// non-site now that sales only happen from a warehouse) show up at all.
export default function CompanyFinancialsPage() {
  const store = useStore();
  const manager = isSiteManager(store);

  const [licenseId, setLicenseId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: licensesData } = useLicenses();
  const { data, isLoading } = useCompanyFinancials({
    licenseId: licenseId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  if (manager) {
    return (
      <div>
        <PageHead kicker="Finance" title="Company Financials" />
        <p className="mt-6 text-sm text-black/50">Admin/superadmin only.</p>
      </div>
    );
  }

  const summary = data?.data;

  return (
    <div>
      <PageHead kicker="Finance" title="Company Financials" />
      <p className="mb-6 max-w-2xl text-sm text-black/60">
        Whole-company income/expense, including money every per-site report structurally can't see — sales revenue
        and any spend that never touched a site's ledger (warehouse-anchored or corporate).
      </p>

      <div className="mb-8 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          License
          <select className="field mt-1" value={licenseId} onChange={(e) => setLicenseId(e.target.value)}>
            <option value="">All licenses</option>
            {(licensesData?.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          From
          <input type="date" className="field mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="block text-sm">
          To
          <input type="date" className="field mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>

      {isLoading && !data ? (
        <div className="p-8 text-center text-sm text-black/50">Loading company financials...</div>
      ) : !summary ? (
        <div className="p-8 text-center text-sm text-black/50">No data.</div>
      ) : (
        <>
          <div className="mb-10 grid gap-px bg-black/10 sm:grid-cols-3">
            <div className="bg-white p-5">
              <p className="kicker">Total Income</p>
              <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.income.total)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="kicker">Total Expense</p>
              <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.expense.total)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="kicker">Net Cash Flow</p>
              <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.netCashFlow)}</p>
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            <section>
              <p className="kicker mb-3">Expense</p>
              <TableWrap showPagination={false}>
                <table className="data w-full text-left">
                  <tbody>
                    <tr><td className="font-medium">Site-attributed · Material</td><td className="font-mono">{etb(summary.expense.siteAttributed.material)}</td></tr>
                    <tr><td className="font-medium">Site-attributed · Labor</td><td className="font-mono">{etb(summary.expense.siteAttributed.labor)}</td></tr>
                    <tr><td className="font-medium">Site-attributed · Equipment</td><td className="font-mono">{etb(summary.expense.siteAttributed.equipment)}</td></tr>
                    <tr><td className="font-medium">Site-attributed · Other</td><td className="font-mono">{etb(summary.expense.siteAttributed.other)}</td></tr>
                    <tr className="font-medium"><td>Site-attributed total</td><td className="font-mono">{etb(summary.expense.siteAttributed.total)}</td></tr>
                    <tr><td className="font-medium">Non-site · Warehouse-anchored</td><td className="font-mono">{etb(summary.expense.nonSite.warehouseAnchored)}</td></tr>
                    <tr><td className="font-medium">Non-site · Corporate</td><td className="font-mono">{etb(summary.expense.nonSite.corporate)}</td></tr>
                    <tr className="font-medium"><td>Non-site total</td><td className="font-mono">{etb(summary.expense.nonSite.total)}</td></tr>
                  </tbody>
                </table>
              </TableWrap>
            </section>

            <section>
              <p className="kicker mb-3">Income</p>
              <p className="mb-3 text-sm text-black/50">
                No site/non-site split — sites can't generate revenue (materials and equipment can only be sold from a warehouse), so all income is inherently non-site.
              </p>
              <TableWrap showPagination={false}>
                <table className="data w-full text-left">
                  <tbody>
                    <tr><td className="font-medium">Material sales</td><td className="font-mono">{etb(summary.income.materialSaleRevenue)}</td></tr>
                    <tr><td className="font-medium">Equipment sales</td><td className="font-mono">{etb(summary.income.equipmentSaleRevenue)}</td></tr>
                    <tr><td className="font-medium">Other</td><td className="font-mono">{etb(summary.income.other)}</td></tr>
                    <tr className="font-medium"><td>Total income</td><td className="font-mono">{etb(summary.income.total)}</td></tr>
                  </tbody>
                </table>
              </TableWrap>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
