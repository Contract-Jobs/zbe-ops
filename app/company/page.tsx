"use client";

import { useState } from "react";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { PageHead, TableWrap } from "@/components/ui";
import { etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useCompanyFinancials, useVatReport } from "@/hooks/use-analytics";

// Admin/superadmin only — the whole-company income/expense decomposition
// new_api.md/migration.md both call out as having no legacy equivalent:
// every other financial analytics endpoint sums project_ledger, which only
// ever has entries for a real site, so this is the only place non-site
// spend (warehouse-anchored + corporate) and all income (inherently
// non-site now that sales only happen from a warehouse) show up at all.
export default function CompanyFinancialsPage() {
  const store = useStore();
  const manager = isSiteManager(store);

  const [filters, setFilters] = useState<QueryFilterValues>({});
  const { data, isLoading } = useCompanyFinancials({
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  });

  const { data: vatData } = useVatReport({
    licenseId: filters.licenseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
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

      <QueryFilters fields={["licenseId", "dateFrom", "dateTo"]} values={filters} onChange={setFilters} />

      {isLoading && !data ? (
        <div className="p-8 text-center text-sm text-black/50">Loading company financials...</div>
      ) : !summary ? (
        <div className="p-8 text-center text-sm text-black/50">No data.</div>
      ) : (
        <>
          <div
            className={`mb-10 grid gap-px bg-black/10 ${summary.netIncome !== undefined ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
          >
            <div className="bg-white p-5">
              <p className="kicker">Total Income</p>
              <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.income.total)}</p>
              <p className="mt-1 text-xs text-black/50">Before VAT</p>
            </div>
            <div className="bg-white p-5">
              <p className="kicker">Total Expense</p>
              <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.expense.total)}</p>
            </div>
            <div className="bg-white p-5">
              <p className="kicker">Net Cash Flow</p>
              <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.netCashFlow)}</p>
              <p className="mt-1 text-xs text-black/50">Cash in minus expense. Includes VAT collected.</p>
            </div>
            {summary.netIncome !== undefined ? (
              <div className="bg-white p-5">
                <p className="kicker">Net Income</p>
                <p className="mt-2 break-words text-2xl tracking-tight">{etb(summary.netIncome)}</p>
                <p className="mt-1 text-xs text-black/50">Before VAT. Counts site sales when sold.</p>
              </div>
            ) : null}
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
                    {summary.income.siteSaleRevenue !== undefined ? (
                      <tr>
                        <td className="pl-6 text-black/60">of which sold to sites</td>
                        <td className="font-mono text-black/60">{etb(summary.income.siteSaleRevenue)}</td>
                      </tr>
                    ) : null}
                    <tr><td className="font-medium">Equipment sales</td><td className="font-mono">{etb(summary.income.equipmentSaleRevenue)}</td></tr>
                    <tr><td className="font-medium">Other</td><td className="font-mono">{etb(summary.income.other)}</td></tr>
                    <tr className="font-medium"><td>Total income (before VAT)</td><td className="font-mono">{etb(summary.income.total)}</td></tr>
                    {summary.income.vatOutput !== undefined ? (
                      <tr>
                        <td className="font-medium">VAT charged on sales</td>
                        <td className="font-mono">{etb(summary.income.vatOutput)}</td>
                      </tr>
                    ) : null}
                    {summary.income.vatCollected !== undefined ? (
                      <tr>
                        <td className="pl-6 text-black/60">of which collected from buyers</td>
                        <td className="font-mono text-black/60">{etb(summary.income.vatCollected)}</td>
                      </tr>
                    ) : null}
                    {summary.income.outstandingSalesReceivables !== undefined ? (
                      <tr>
                        <td className="font-medium">Owed to us on sales (incl. VAT)</td>
                        <td className="font-mono">{etb(summary.income.outstandingSalesReceivables)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </TableWrap>
              {summary.vat ? (
                <p className="mt-2 text-xs text-black/50">
                  VAT: charged {etb(summary.vat.output)}, paid {etb(summary.vat.input)}, net{" "}
                  {etb(summary.vat.netPayable)}. Expenses include the VAT paid.
                </p>
              ) : null}
            </section>
          </div>

          {vatData?.data ? (
            <section className="mt-10">
              <p className="kicker mb-3">VAT on sales</p>
              <p className="mb-3 max-w-2xl text-sm text-black/60">
                VAT charged on approved sales that were not reversed, in the period. VAT is owed to the tax
                authority, not income.
              </p>
              <div className="mb-6 grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-white p-5">
                  <p className="kicker">VAT charged</p>
                  <p className="mt-2 break-words text-2xl tracking-tight">{etb(vatData.data.outputVat)}</p>
                </div>
                <div className="bg-white p-5">
                  <p className="kicker">Invoiced incl. VAT</p>
                  <p className="mt-2 break-words text-2xl tracking-tight">{etb(vatData.data.grossInvoiced)}</p>
                </div>
                <div className="bg-white p-5">
                  <p className="kicker">Sales with VAT</p>
                  <p className="mt-2 break-words text-2xl tracking-tight">{etb(vatData.data.taxableNet)}</p>
                  <p className="mt-1 text-xs text-black/50">Before VAT</p>
                </div>
                <div className="bg-white p-5">
                  <p className="kicker">VAT-free sales</p>
                  <p className="mt-2 break-words text-2xl tracking-tight">{etb(vatData.data.exemptNet)}</p>
                </div>
              </div>
              {vatData.data.inputVat ? (
                <div className="mb-6 grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-white p-5">
                    <p className="kicker">VAT paid (can reclaim)</p>
                    <p className="mt-2 break-words text-2xl tracking-tight">{etb(vatData.data.inputVat.total)}</p>
                    <p className="mt-1 text-xs text-black/50">
                      Materials {etb(vatData.data.inputVat.materialPurchases)} · equipment{" "}
                      {etb(vatData.data.inputVat.equipmentPurchases)} · transactions{" "}
                      {etb(vatData.data.inputVat.transactions)}
                    </p>
                  </div>
                  {vatData.data.netVatPayable !== undefined ? (
                    <div className="bg-white p-5">
                      <p className="kicker">
                        {Number(vatData.data.netVatPayable) < 0 ? "VAT refundable" : "VAT to pay"}
                      </p>
                      <p className="mt-2 break-words text-2xl tracking-tight">
                        {etb(Math.abs(Number(vatData.data.netVatPayable)))}
                      </p>
                      <p className="mt-1 text-xs text-black/50">VAT charged minus VAT paid</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <TableWrap showPagination={false}>
                <table className="data w-full text-left">
                  <thead>
                    <tr>
                      <th>Sales</th>
                      <th className="hidden sm:table-cell">Count</th>
                      <th>Before VAT</th>
                      <th>VAT</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Materials", vatData.data.byCategory.material],
                        ["Equipment", vatData.data.byCategory.equipment],
                        ["To sites", vatData.data.byCategory.siteSales],
                      ] as const
                    ).map(([label, row]) => (
                      <tr key={label}>
                        <td className="font-medium">{label}</td>
                        <td className="hidden font-mono sm:table-cell">{row.saleCount}</td>
                        <td className="font-mono">{etb(row.net)}</td>
                        <td className="font-mono">{etb(row.vat)}</td>
                        <td className="font-mono">{etb(row.gross)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
              <p className="mt-2 text-xs text-black/50">
                From outside buyers: VAT collected {etb(vatData.data.externalVatCollected)}, still to collect{" "}
                {etb(vatData.data.externalVatOutstanding)}. VAT on sales to sites counts when the sale is made,
                because site payments are not matched to individual sales.
              </p>
              {(vatData.data.notBackfilledPurchaseCount ?? 0) > 0 ? (
                <p className="mt-1 text-xs text-[var(--warn)]">
                  {vatData.data.notBackfilledPurchaseCount} older purchase
                  {vatData.data.notBackfilledPurchaseCount === 1 ? " has" : "s have"} no VAT recorded and count as
                  0 VAT paid.
                </p>
              ) : null}
              {vatData.data.notBackfilledSaleCount > 0 ? (
                <p className="mt-1 text-xs text-[var(--warn)]">
                  {vatData.data.notBackfilledSaleCount} older sale
                  {vatData.data.notBackfilledSaleCount === 1 ? " is" : "s are"} still counted without VAT.
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
