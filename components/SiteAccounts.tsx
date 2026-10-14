"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { QueryFilters, type QueryFilterValues } from "@/components/QueryFilters";
import { ListToolbar } from "@/components/ListToolbar";
import { SortSelect, type SortState } from "@/components/SortSelect";
import { ConfirmDialog, Field, FormActions, ModalPanel, Stamp, TableWrap, Username } from "@/components/ui";
import { useCategories } from "@/hooks/use-categories";
import {
  useRegisterSitePayment,
  useReverseSitePayment,
  useWarehouseSitePayments,
} from "@/hooks/use-warehouses";
import { day, etb } from "@/lib/format";
import type { AccountRow, SitePayment } from "@/types/api";

export type PaymentSortBy = "paymentDate" | "amount" | "createdAt";

export const PAYMENT_SORT_OPTIONS: { value: PaymentSortBy; label: string }[] = [
  { value: "paymentDate", label: "Payment date" },
  { value: "amount", label: "Amount" },
  { value: "createdAt", label: "Recorded" },
];

export const PAYMENT_FILTER_FIELDS = ["isReversed", "dateFrom", "dateTo", "minAmount", "maxAmount"] as const;

// Query params shared by both payments lists (the warehouse's received and
// the site's made): the filter bar values plus the chosen sort.
export function toPaymentParams(filters: QueryFilterValues, sort: SortState<PaymentSortBy>) {
  return {
    isReversed: filters.isReversed || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    minAmount: filters.minAmount || undefined,
    maxAmount: filters.maxAmount || undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  };
}

// What each site owes this warehouse. A site pays in bulk against a running
// balance (sold − paid); a payment is never allocated to individual sales.
// Admin/superadmin register and reverse payments; site managers don't see
// this section at all (the API returns no accounts for them).
export function SiteAccountsSection({
  warehouseId,
  accounts,
  canMutate,
  selectedSaleIdsBySite,
  onPaymentRegistered,
}: {
  warehouseId: string;
  accounts: AccountRow[];
  canMutate: boolean;
  // Sold-item rows currently ticked in the table, grouped by buyer site, so a
  // payment can tick them as paid in the same step.
  selectedSaleIdsBySite: Map<string, string[]>;
  onPaymentRegistered?: () => void;
}) {
  const [payFor, setPayFor] = useState<AccountRow | null>(null);
  const [historyFor, setHistoryFor] = useState<AccountRow | null>(null);

  const owed = accounts.reduce((sum, a) => sum + Number(a.outstanding), 0);

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[0.8rem] uppercase tracking-wider text-black/50">Site accounts</h2>
        {accounts.length > 0 ? (
          <p className="text-sm text-black/60">
            Sites owe this warehouse <span className="font-mono">{etb(owed)}</span>
          </p>
        ) : null}
      </div>

      {accounts.length === 0 ? (
        <div className="border border-dashed border-black/20 p-6 text-center text-sm text-black/40">
          No site has bought material from this warehouse.
        </div>
      ) : (
        <TableWrap showPagination={false} data={accounts}>
          <table className="data w-full text-left">
            <thead>
              <tr>
                <th>Site</th>
                <th className="hidden sm:table-cell">Sales</th>
                <th>Sold</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th className="hidden md:table-cell">Marked paid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="font-medium">
                    <Link href={`/sites/${a.id}/purchased-materials`} className="hover:text-yellow">
                      {a.name}
                    </Link>
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
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      className="text-xs text-black/50 hover:text-black hover:underline"
                      onClick={() => setHistoryFor(a)}
                    >
                      Payments
                    </button>
                    {canMutate && Number(a.outstanding) > 0 ? (
                      <button type="button" className="btn ml-3 px-2 py-0.5 text-xs" onClick={() => setPayFor(a)}>
                        Register payment
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <p className="mt-2 text-xs text-black/50">
        The balance is sold minus paid. &ldquo;Marked paid&rdquo; is a manual label you can tick on the sales below to
        track items; it never changes the balance.
      </p>

      {payFor ? (
        <ModalPanel kicker="Site account" title={`Payment from ${payFor.name}`} onClose={() => setPayFor(null)}>
          <RegisterPaymentForm
            warehouseId={warehouseId}
            account={payFor}
            selectedSaleIds={selectedSaleIdsBySite.get(payFor.id) ?? []}
            onCancel={() => setPayFor(null)}
            onDone={() => {
              setPayFor(null);
              onPaymentRegistered?.();
            }}
          />
        </ModalPanel>
      ) : null}

      {historyFor ? (
        <ModalPanel kicker="Site account" title={`Payments from ${historyFor.name}`} wide onClose={() => setHistoryFor(null)}>
          <AccountPayments warehouseId={warehouseId} account={historyFor} canMutate={canMutate} />
        </ModalPanel>
      ) : null}
    </section>
  );
}

function RegisterPaymentForm({
  warehouseId,
  account,
  selectedSaleIds,
  onCancel,
  onDone,
}: {
  warehouseId: string;
  account: AccountRow;
  selectedSaleIds: string[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const mutation = useRegisterSitePayment();
  const { data: categoriesData } = useCategories();
  const categories = (categoriesData?.data ?? []).filter((c) => !c.deletedAt);

  const outstanding = Number(account.outstanding);
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding.toFixed(2) : "");
  // What the site would still owe if this payment went through.
  const balanceAfter = outstanding - (Number(amount) || 0);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [markSelected, setMarkSelected] = useState(selectedSaleIds.length > 0);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = Number(amount);
    if (!(value > 0)) return setError("Enter an amount above zero.");
    // The API refuses more than the account owes; catch it before the round trip.
    if (value > outstanding + 0.005) return setError(`The most this site can pay is ${etb(outstanding)}.`);

    try {
      const result = await mutation.mutateAsync({
        warehouseId,
        payload: {
          siteId: account.id,
          amount: value.toFixed(2),
          // Date-only inputs need an offset; the API wants a full datetime.
          paymentDate: paymentDate ? new Date(`${paymentDate}T12:00:00`).toISOString() : undefined,
          note: note.trim() || undefined,
          categoryId: categoryId || undefined,
          markPaidMovementIds: markSelected && selectedSaleIds.length > 0 ? selectedSaleIds : undefined,
        },
      });
      toast.success(`Received ${etb(result.data.payment.amount)}. ${etb(result.data.balance.outstanding)} still owed.`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register payment");
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>
      ) : null}

      {/* Where the account stands before this payment. */}
      <dl className="border border-black/10">
        <div className="border-b border-black/10 px-3 py-2">
          <dt className="kicker">Sold</dt>
          <dd className="mt-0.5 font-mono text-sm">{etb(account.sold)}</dd>
        </div>
        <div className="border-b border-black/10 px-3 py-2">
          <dt className="kicker">Paid</dt>
          <dd className="mt-0.5 font-mono text-sm">{etb(account.paid)}</dd>
        </div>
        <div className="px-3 py-2">
          <dt className="kicker">Owes</dt>
          <dd className={`mt-0.5 font-mono text-sm font-medium ${outstanding > 0 ? "text-bad" : ""}`}>
            {etb(account.outstanding)}
          </dd>
        </div>
      </dl>

      <Field label="Amount (ETB)">
        <input
          className="field"
          type="number"
          step="0.01"
          min="0.01"
          max={outstanding > 0 ? outstanding.toFixed(2) : undefined}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={mutation.isPending}
          required
        />
        <div className="mt-1 flex flex-col items-start gap-1 text-xs">
          <span className={balanceAfter < -0.005 ? "text-bad" : "text-black/50"}>
            {balanceAfter < -0.005 ? `Over by ${etb(-balanceAfter)}` : `Owes after: ${etb(Math.max(0, balanceAfter))}`}
          </span>
          <button
            type="button"
            className="text-blue-600/80 hover:text-black hover:underline"
            onClick={() => setAmount(outstanding.toFixed(2))}
            disabled={mutation.isPending || outstanding <= 0}
          >
            Pay full balance
          </button>
        </div>
      </Field>
      <Field label="Payment date">
        <input
          className="field"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          disabled={mutation.isPending}
        />
      </Field>
      <Field label="Category (optional)">
        <select
          className="field"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={mutation.isPending}
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)">
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} disabled={mutation.isPending} />
      </Field>
      {selectedSaleIds.length > 0 ? (
        <label className="flex items-start gap-2 border border-black/10 bg-paper/40 p-3 text-sm text-black/70">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={markSelected}
            onChange={(e) => setMarkSelected(e.target.checked)}
          />
          <span>
            Also mark the {selectedSaleIds.length} selected {selectedSaleIds.length === 1 ? "sale" : "sales"} as paid
            <span className="block text-xs text-black/50">A tracking label only; it doesn&apos;t change the balance.</span>
          </span>
        </label>
      ) : null}
      <FormActions onCancel={onCancel} loading={mutation.isPending} saveLabel="Register payment" />
    </form>
  );
}

function AccountPayments({
  warehouseId,
  account,
  canMutate,
}: {
  warehouseId: string;
  account: AccountRow;
  canMutate: boolean;
}) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<QueryFilterValues>({});
  const [sort, setSort] = useState<SortState<PaymentSortBy>>({ sortBy: "paymentDate", sortOrder: "desc" });
  const { data, isLoading } = useWarehouseSitePayments(warehouseId, {
    siteId: account.id,
    page,
    limit: 10,
    ...toPaymentParams(filters, sort),
  });
  const reverse = useReverseSitePayment();
  const [target, setTarget] = useState<SitePayment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payments = data?.data ?? [];

  async function confirmReverse() {
    if (!target) return;
    setError(null);
    try {
      await reverse.mutateAsync({ warehouseId, paymentId: target.id });
      setTarget(null);
    } catch (err) {
      // Includes the 409 for a closed site: reopen it before reversing.
      setError(err instanceof Error ? err.message : "Failed to reverse payment");
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-black/60">
        Balance <span className="font-mono">{etb(account.outstanding)}</span> · paid{" "}
        <span className="font-mono">{etb(account.paid)}</span> of{" "}
        <span className="font-mono">{etb(account.sold)}</span>
      </p>
      <ListToolbar
        sort={
          <SortSelect
            options={PAYMENT_SORT_OPTIONS}
            value={sort}
            onChange={(next) => {
              setSort(next);
              setPage(1);
            }}
          />
        }
      >
        <QueryFilters
          className="contents"
          fields={[...PAYMENT_FILTER_FIELDS]}
          popover
          pinned={["dateFrom", "dateTo"]}
          values={filters}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
        />
      </ListToolbar>
      {isLoading && !data ? (
        <div className="p-6 text-center text-sm text-black/40">Loading payments...</div>
      ) : (
        <TableWrap pagination={data?.pagination} onPageChange={setPage}>
          <table className="data w-full text-left">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th className="hidden sm:table-cell">Note</th>
                <th className="hidden md:table-cell">By</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{day(p.paymentDate)}</td>
                  <td className="font-mono text-sm">{etb(p.amount)}</td>
                  <td className="hidden max-w-[14rem] truncate text-sm text-black/70 sm:table-cell" title={p.note ?? undefined}>
                    {p.note ?? "—"}
                  </td>
                  <td className="hidden md:table-cell">
                    <Username userId={p.loggedBy} fallback={p.loggedBy} />
                  </td>
                  <td>{p.isReversed ? <Stamp value="reversed" tone="bad" /> : <Stamp value="received" tone="ok" />}</td>
                  <td className="text-right">
                    {canMutate && !p.isReversed ? (
                      <button type="button" className="text-xs text-bad hover:underline" onClick={() => setTarget(p)}>
                        Reverse
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-black/45">
                    No payments from this site yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}

      <ConfirmDialog
        open={target !== null}
        title="Reverse this payment?"
        body={
          error
            ? error
            : `The ${etb(target?.amount ?? 0)} received from ${account.name} is cancelled and the site owes it again.`
        }
        confirmLabel="Reverse payment"
        danger
        loading={reverse.isPending}
        onCancel={() => {
          setTarget(null);
          setError(null);
        }}
        onConfirm={confirmReverse}
      />
    </div>
  );
}
