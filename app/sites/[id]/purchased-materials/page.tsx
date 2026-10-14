"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import {
  PAYMENT_FILTER_FIELDS,
  PAYMENT_SORT_OPTIONS,
  toPaymentParams,
  type PaymentSortBy,
} from "@/components/SiteAccounts";
import { SortSelect, type SortState } from "@/components/SortSelect";
import { Field, PageHead, Stamp, Tabs, TableWrap, Username } from "@/components/ui";
import { useInventoriesInBulk } from "@/hooks/use-inventories";
import { useInventoryItemsInBulk } from "@/hooks/use-inventory-items";
import { useInventoryMovements } from "@/hooks/use-inventory-movements";
import { useSite, useSitePayablePayments, useSitePayables } from "@/hooks/use-sites";
import { day, etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";

type SalesSortBy = "movementDate" | "totalCost" | "quantity";

const SALES_SORT_OPTIONS: { value: SalesSortBy; label: string }[] = [
  { value: "movementDate", label: "Date" },
  { value: "totalCost", label: "Total" },
  { value: "quantity", label: "Quantity" },
];

// Read side of the site's warehouse accounts. A site pays each warehouse in
// bulk against a running balance; payments are registered from the warehouse's
// sold-items page, so nothing here mutates.
export default function SitePurchasedMaterialsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();
  const isAdmin = !isSiteManager(store);

  const { data: siteData } = useSite(id);
  const siteName = siteData?.data?.name ?? "Site";

  // Narrows the accounts and the payments to one warehouse. (The items list
  // can't be narrowed by warehouse: the movements API has no such filter.)
  const [accountFilter, setAccountFilter] = useState<QueryFilterValues>({});
  const warehouseId = accountFilter.warehouseId || undefined;
  const { data: payablesData, isLoading: isAccountsLoading } = useSitePayables(id, { warehouseId });
  const summary = payablesData?.summary;
  const accounts = payablesData?.byWarehouse ?? [];

  const [salesPage, setSalesPage] = useState(1);
  const [markedFilter, setMarkedFilter] = useState("");
  const [salesRange, setSalesRange] = useState<QueryFilterValues>({});
  const [salesSort, setSalesSort] = useState<SortState<SalesSortBy>>({ sortBy: "movementDate", sortOrder: "desc" });
  const { data: salesData, isLoading: isSalesLoading } = useInventoryMovements({
    buyerSiteId: id,
    movementType: "sale",
    isMarkedPaid: markedFilter || undefined,
    fromDate: salesRange.dateFrom || undefined,
    toDate: salesRange.dateTo || undefined,
    page: salesPage,
    limit: 10,
    ...salesSort,
  });
  const sales = useMemo(() => salesData?.data ?? [], [salesData?.data]);

  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentFilters, setPaymentFilters] = useState<QueryFilterValues>({});
  const [paymentSort, setPaymentSort] = useState<SortState<PaymentSortBy>>({
    sortBy: "paymentDate",
    sortOrder: "desc",
  });
  const { data: paymentsData, isLoading: isPaymentsLoading } = useSitePayablePayments(id, {
    page: paymentsPage,
    limit: 10,
    warehouseId,
    ...toPaymentParams(paymentFilters, paymentSort),
  });
  const payments = paymentsData?.data ?? [];

  const itemIds = useMemo(() => Array.from(new Set(sales.map((s) => s.itemId))), [sales]);
  const sourceIds = useMemo(
    () => Array.from(new Set(sales.map((s) => s.sourceInventoryId).filter((v): v is string => Boolean(v)))),
    [sales],
  );
  const { data: itemsData } = useInventoryItemsInBulk(itemIds);
  const { data: nodesData } = useInventoriesInBulk(sourceIds);
  const itemById = useMemo(() => new Map((itemsData?.data ?? []).map((i) => [i.id, i])), [itemsData]);
  const warehouseByNode = useMemo(
    () => new Map((nodesData?.data ?? []).map((n) => [n.id, n.warehouse?.name ?? n.site?.name ?? "—"])),
    [nodesData],
  );

  const outstanding = Number(summary?.outstanding ?? 0);
  const [tab, setTab] = useState<"accounts" | "items" | "payments">("accounts");

  return (
    <div>
      <PageHead
        kicker="Site"
        title={`${siteName} — Purchased Materials`}
        action={
          <button className="btn btn-ghost" onClick={() => router.push(`/sites/${id}`)}>
            Back to Site
          </button>
        }
      />
      <p className="mb-6 max-w-xl text-sm text-black/60">
        Material this site bought from warehouses. It pays each warehouse in bulk against a running balance, not per
        item. No stock is added to the site and nothing is posted to its budget.
        {isAdmin ? " Payments are registered from the warehouse's Sold Items page, under Site Accounts." : ""}
      </p>

      <div className="mb-6 grid gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-4">
          <p className="kicker">Bought</p>
          <p className="mt-2 font-mono text-sm">{etb(summary?.sold)}</p>
        </div>
        <div className="bg-white p-4">
          <p className="kicker">Paid</p>
          <p className="mt-2 font-mono text-sm">{etb(summary?.paid)}</p>
        </div>
        <div className="bg-white p-4">
          <p className="kicker">Outstanding</p>
          <p className={`mt-2 font-mono text-sm ${outstanding > 0 ? "text-bad" : ""}`}>{etb(summary?.outstanding)}</p>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "accounts", label: "Accounts", count: accounts.length },
          { id: "items", label: "Items Bought", count: salesData?.pagination?.total },
          { id: "payments", label: "Payments Made", count: paymentsData?.pagination?.total },
        ]}
        active={tab}
        onChange={(next) => setTab(next as typeof tab)}
      />

      <section className={tab === "accounts" ? "mb-10" : "hidden"}>
        <p className="kicker mb-3">Accounts by warehouse</p>
        <QueryFilters
          className="mb-3"
          fields={["warehouseId"]}
          values={accountFilter}
          onChange={(next) => {
            setAccountFilter(next);
            setPaymentsPage(1);
          }}
        />
        {isAccountsLoading && !payablesData ? (
          <div className="p-6 text-center text-sm text-black/40">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="border border-dashed border-black/20 p-6 text-center text-sm text-black/40">
            This site has not bought material from a warehouse.
          </div>
        ) : (
          <TableWrap showPagination={false} data={accounts}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th className="hidden sm:table-cell">Sales</th>
                  <th>Bought</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th className="hidden md:table-cell">Marked paid</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">
                      {isAdmin ? (
                        <Link href={`/warehouses/${a.id}/sold-items?tab=accounts`} className="hover:text-yellow">
                          {a.name}
                        </Link>
                      ) : (
                        a.name
                      )}
                    </td>
                    <td className="hidden font-mono text-sm sm:table-cell">{a.saleCount}</td>
                    <td className="font-mono text-sm">{etb(a.sold)}</td>
                    <td className="font-mono text-sm">{etb(a.paid)}</td>
                    <td className={`font-mono text-sm ${Number(a.outstanding) > 0 ? "text-bad" : ""}`}>
                      {etb(a.outstanding)}
                    </td>
                    <td className="hidden font-mono text-xs text-black/60 md:table-cell">
                      {etb(a.markedPaidTotal)} of {etb(a.sold)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <p className="mt-2 text-xs text-black/50">
          The balance is bought minus paid. &ldquo;Marked paid&rdquo; is a manual label staff use to track items; it
          never changes the balance.
        </p>
      </section>

      <section className={tab === "items" ? "mb-10" : "hidden"}>
        {/* One left-aligned row, like the other tabs: paid label, dates, sort. */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-44">
            <Field label="Paid label">
              <select
                className="field"
                value={markedFilter}
                onChange={(e) => {
                  setMarkedFilter(e.target.value);
                  setSalesPage(1);
                }}
              >
                <option value="">All items</option>
                <option value="true">Marked paid</option>
                <option value="false">Not marked paid</option>
              </select>
            </Field>
          </div>
          <QueryFilters
            className=""
            fields={["dateFrom", "dateTo"]}
            values={salesRange}
            onChange={(next) => {
              setSalesRange(next);
              setSalesPage(1);
            }}
          />
          <SortSelect
            options={SALES_SORT_OPTIONS}
            value={salesSort}
            onChange={(next) => {
              setSalesSort(next);
              setSalesPage(1);
            }}
          />
        </div>
        {isSalesLoading && !salesData ? (
          <div className="p-6 text-center text-sm text-black/40">Loading items...</div>
        ) : (
          <TableWrap pagination={salesData?.pagination} onPageChange={setSalesPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th className="hidden md:table-cell">Warehouse</th>
                  <th>Total</th>
                  <th>Paid label</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const item = s.item ?? itemById.get(s.itemId);
                  return (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap">{day(s.movementDate)}</td>
                      <td>
                        <div className="font-medium">{item?.name ?? s.itemId}</div>
                        <div className="font-mono text-xs text-black/50">
                          {s.quantity} {item?.unit ?? ""} × {etb(s.unitCost)}
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        {s.sourceInventoryId ? (warehouseByNode.get(s.sourceInventoryId) ?? "—") : "—"}
                      </td>
                      <td className="font-mono text-sm">{etb(s.totalCost)}</td>
                      <td>
                        {!s.isApproved ? (
                          <Stamp value="pending" tone="yellow" />
                        ) : s.isMarkedPaid ? (
                          <Stamp value="marked paid" tone="ok" />
                        ) : (
                          <Stamp value="not marked" tone="ink" />
                        )}
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-black/45">
                      No items bought from warehouses.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section className={tab === "payments" ? "" : "hidden"}>
        <p className="kicker mb-3">Payments made</p>
        <QueryFilters
          className="mb-3"
          fields={[...PAYMENT_FILTER_FIELDS]}
          popover
          pinned={["dateFrom", "dateTo"]}
          values={paymentFilters}
          onChange={(next) => {
            setPaymentFilters(next);
            setPaymentsPage(1);
          }}
        />
        <div className="mb-4">
          <SortSelect
            options={PAYMENT_SORT_OPTIONS}
            value={paymentSort}
            onChange={(next) => {
              setPaymentSort(next);
              setPaymentsPage(1);
            }}
          />
        </div>
        {isPaymentsLoading && !paymentsData ? (
          <div className="p-6 text-center text-sm text-black/40">Loading payments...</div>
        ) : (
          <TableWrap pagination={paymentsData?.pagination} onPageChange={setPaymentsPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Warehouse</th>
                  <th>Amount</th>
                  <th className="hidden sm:table-cell">Note</th>
                  <th className="hidden md:table-cell">By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{day(p.paymentDate)}</td>
                    <td>{p.warehouseName}</td>
                    <td className="font-mono text-sm">{etb(p.amount)}</td>
                    <td className="hidden max-w-[14rem] truncate text-sm text-black/70 sm:table-cell" title={p.note ?? undefined}>
                      {p.note ?? "—"}
                    </td>
                    <td className="hidden md:table-cell">
                      <Username userId={p.loggedBy} fallback={p.loggedBy} />
                    </td>
                    <td>{p.isReversed ? <Stamp value="reversed" tone="bad" /> : <Stamp value="received" tone="ok" />}</td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-sm text-black/45">
                      No payments made yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>
    </div>
  );
}
