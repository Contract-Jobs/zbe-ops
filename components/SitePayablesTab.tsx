"use client";

import { useState } from "react";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { SalePaymentsPanel } from "@/components/SalePaymentsPanel";
import { Field, ModalPanel, Stamp, TableWrap, statusTone } from "@/components/ui";
import { useSitePayables } from "@/hooks/use-sites";
import { day, etb } from "@/lib/format";
import type { PayableRow, SaleStatus } from "@/types/api";

// Value is what the select holds; the API wants a list of statuses.
const STATUS_OPTIONS: { value: string; label: string; statuses?: SaleStatus[] }[] = [
  { value: "", label: "All purchases" },
  { value: "owing", label: "Unpaid or partly paid", statuses: ["unpaid", "partially_paid"] },
  { value: "unpaid", label: "Unpaid", statuses: ["unpaid"] },
  { value: "partially_paid", label: "Partially paid", statuses: ["partially_paid"] },
  { value: "paid", label: "Paid", statuses: ["paid"] },
];

export function SitePayablesTab({
  siteId,
  canMutate,
  initialStatus = "",
}: {
  siteId: string;
  // Payments are recorded from the warehouse side; site managers only read.
  canMutate: boolean;
  initialStatus?: string;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<QueryFilterValues>({});
  const [status, setStatus] = useState(initialStatus);
  const [paying, setPaying] = useState<PayableRow | null>(null);

  const { data, isLoading } = useSitePayables(siteId, {
    page,
    limit: 10,
    warehouseId: filters.warehouseId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    saleStatus: STATUS_OPTIONS.find((o) => o.value === status)?.statuses,
  });

  const rows = data?.data ?? [];
  const summary = data?.summary;
  const byWarehouse = data?.byWarehouse ?? [];
  // Re-read the open row so totals refresh after a payment is recorded.
  const livePaying = paying ? (rows.find((r) => r.id === paying.id) ?? paying) : null;

  return (
    <section>
      <p className="kicker mb-3">Payables</p>
      <p className="mb-4 max-w-xl text-sm text-black/60">
        Material this site bought from warehouses. No stock is added to the site and nothing is posted to its budget.
      </p>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-52">
          <Field label="Status">
            <select
              className="field"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <QueryFilters
          className=""
          fields={["warehouseId", "dateFrom", "dateTo"]}
          values={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
      </div>

      <div className="mb-6 grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-4">
          <p className="kicker">Total owed</p>
          <p className="mt-2 font-mono text-sm">{etb(summary?.totalOwed)}</p>
        </div>
        <div className="bg-white p-4">
          <p className="kicker">Paid</p>
          <p className="mt-2 font-mono text-sm">{etb(summary?.totalPaid)}</p>
        </div>
        <div className="bg-white p-4">
          <p className="kicker">Outstanding</p>
          <p className="mt-2 font-mono text-sm">{etb(summary?.outstanding)}</p>
        </div>
      </div>

      {byWarehouse.length > 1 ? (
        <div className="mb-6">
          <p className="kicker mb-2">By warehouse</p>
          <div className="grid gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-3">
            {byWarehouse.map((w) => (
              <div key={w.id} className="bg-white p-4">
                <p className="text-sm font-medium">{w.name}</p>
                <p className="mt-1 font-mono text-xs text-black/60">
                  {etb(w.outstanding)} outstanding of {etb(w.totalOwed)} · {w.count}{" "}
                  {w.count === 1 ? "purchase" : "purchases"}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="p-8 text-center text-sm text-black/40">Loading payables...</div>
      ) : (
        <TableWrap pagination={data?.pagination} onPageChange={setPage}>
          <table className="data w-full text-left">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th className="hidden md:table-cell">Warehouse</th>
                <th>Owed</th>
                <th className="hidden sm:table-cell">Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{day(r.movementDate)}</td>
                  <td>
                    <div className="font-medium">{r.itemName}</div>
                    <div className="font-mono text-xs text-black/50">
                      {r.quantity} × {etb(r.unitCost)}
                    </div>
                  </td>
                  <td className="hidden md:table-cell">{r.warehouseName}</td>
                  <td className="font-mono text-sm">{etb(r.totalOwed)}</td>
                  <td className="hidden font-mono text-sm sm:table-cell">{etb(r.paidAmount)}</td>
                  <td className="font-mono text-sm">{etb(r.outstanding)}</td>
                  <td>
                    <Stamp value={r.saleStatus} tone={statusTone(r.saleStatus)} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost px-2 py-0.5 text-sm" onClick={() => setPaying(r)}>
                      Payments
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-black/45">
                    No purchases from warehouses.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}

      {livePaying ? (
        <ModalPanel kicker="Sale Payments" title={`${livePaying.itemName} · Payments`} wide onClose={() => setPaying(null)}>
          <SalePaymentsPanel
            movementId={livePaying.id}
            kind="material"
            itemTitle={livePaying.itemName}
            totalCost={Number(livePaying.totalOwed)}
            paidAmount={Number(livePaying.paidAmount)}
            saleStatus={livePaying.saleStatus}
            canMutate={canMutate}
          />
        </ModalPanel>
      ) : null}
    </section>
  );
}
