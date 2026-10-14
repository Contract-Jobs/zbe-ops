"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, FormActions } from "@/components/ui";
import { useCategories } from "@/hooks/use-categories";
import { useRegisterSitePayment } from "@/hooks/use-warehouses";
import { etb } from "@/lib/format";
import type { AccountRow } from "@/types/api";

// A site pays its warehouse in bulk against a running balance — never per
// sale. One column, top to bottom.
export function RegisterSitePaymentForm({
  warehouseId,
  account,
  selectedSaleIds,
  onCancel,
  onDone,
}: {
  warehouseId: string;
  account: AccountRow;
  // Sales ticked as paid in the same step (a tracking label only).
  selectedSaleIds: string[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const mutation = useRegisterSitePayment();
  const { data: categoriesData } = useCategories();
  const categories = (categoriesData?.data ?? []).filter((c) => !c.deletedAt);

  const outstanding = Number(account.outstanding);
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding.toFixed(2) : "");
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
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {error ? (
        <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">{error}</p>
      ) : null}

      {/* Where the account stands before this payment — one item under another. */}
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
