"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, Field, FormActions, FormPanel, Stamp, TableWrap, Username, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import {
  useInventoryMovementPayments,
  useRecordInventoryMovementPayment,
  useReverseInventoryMovementPayment,
} from "@/hooks/use-inventory-movements";
import {
  useEquipmentMovementPayments,
  useRecordEquipmentMovementPayment,
  useReverseEquipmentMovementPayment,
} from "@/hooks/use-equipment-movements";
import { useCategories } from "@/hooks/use-categories";
import type { SaleStatus, Transaction } from "@/types/api";

interface SalePaymentsPanelProps {
  movementId: string;
  kind: "material" | "equipment";
  itemTitle: string;
  totalCost: number;
  paidAmount: number;
  saleStatus: SaleStatus;
  canMutate?: boolean;
}

export function SalePaymentsPanel({
  movementId,
  kind,
  itemTitle,
  totalCost,
  paidAmount,
  saleStatus,
  canMutate = true,
}: SalePaymentsPanelProps) {
  const { data: categoriesData } = useCategories();
  const categories = (categoriesData?.data ?? []).filter((c) => !c.deletedAt);

  // Material payments hooks
  const materialPaymentsQuery = useInventoryMovementPayments(kind === "material" ? movementId : undefined);
  const recordMaterialPayment = useRecordInventoryMovementPayment();
  const reverseMaterialPayment = useReverseInventoryMovementPayment();

  // Equipment payments hooks
  const equipPaymentsQuery = useEquipmentMovementPayments(kind === "equipment" ? movementId : undefined);
  const recordEquipPayment = useRecordEquipmentMovementPayment();
  const reverseEquipPayment = useReverseEquipmentMovementPayment();

  const paymentsQuery = kind === "material" ? materialPaymentsQuery : equipPaymentsQuery;
  const isPendingMutation =
    recordMaterialPayment.isPending ||
    reverseMaterialPayment.isPending ||
    recordEquipPayment.isPending ||
    reverseEquipPayment.isPending;

  const [showRecordForm, setShowRecordForm] = useState(false);
  const remaining = Math.max(0, totalCost - paidAmount);

  const [paymentAmount, setPaymentAmount] = useState(remaining > 0 ? remaining.toFixed(2) : "");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);

  const payments = [...(paymentsQuery.data?.data ?? [])].sort(
    (a, b) =>
      new Date(b.transactionDate ?? b.createdAt).getTime() -
      new Date(a.transactionDate ?? a.createdAt).getTime()
  );

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amountNum = Number(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }
    if (amountNum > remaining) {
      setError(`Payment cannot exceed the remaining balance of ${etb(remaining)}.`);
      return;
    }

    try {
      if (kind === "material") {
        await recordMaterialPayment.mutateAsync({
          id: movementId,
          payload: {
            amount: paymentAmount,
            paymentDate: new Date(paymentDate).toISOString(),
            note: paymentNote.trim() || undefined,
            categoryId: categoryId || undefined,
          },
        });
      } else {
        await recordEquipPayment.mutateAsync({
          id: movementId,
          payload: {
            amount: paymentAmount,
            paymentDate: new Date(paymentDate).toISOString(),
            note: paymentNote.trim() || undefined,
          },
        });
      }
      toast.success("Payment recorded successfully");
      setShowRecordForm(false);
      setPaymentNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const handleConfirmReversePayment = async () => {
    if (!reverseTarget) return;
    setError(null);
    try {
      if (kind === "material") {
        await reverseMaterialPayment.mutateAsync({
          id: movementId,
          paymentId: reverseTarget.id,
          payload: { note: `Reversal of payment ${etb(reverseTarget.amount)}` },
        });
      } else {
        await reverseEquipPayment.mutateAsync({
          id: movementId,
          paymentId: reverseTarget.id,
          payload: { note: `Reversal of payment ${etb(reverseTarget.amount)}` },
        });
      }
      toast.success("Payment reversed successfully");
      setReverseTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reverse payment");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp value={saleStatus} tone={statusTone(saleStatus)} />
        <Stamp value={kind === "equipment" ? "equipment sale" : "material sale"} tone="ok" />
        <span className="text-sm font-medium text-black/70">{itemTitle}</span>
      </div>

      {error && !showRecordForm ? (
        <p className="mb-4 border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)]">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-px bg-black/10 sm:grid-cols-3">
        <div className="bg-white p-4">
          <p className="kicker">Total Sale Amount</p>
          <p className="mt-1 font-mono text-xl font-medium tracking-tight text-black">{etb(totalCost)}</p>
        </div>
        <div className="bg-white p-4">
          <p className="kicker">Cash Collected</p>
          <p className="mt-1 font-mono text-xl font-medium tracking-tight text-ok">{etb(paidAmount)}</p>
        </div>
        <div className="bg-white p-4">
          <p className="kicker">Outstanding Balance</p>
          <p
            className={`mt-1 font-mono text-xl font-medium tracking-tight ${
              remaining > 0 ? "text-bad" : "text-black/50"
            }`}
          >
            {etb(remaining)}
          </p>
        </div>
      </div>

      {showRecordForm ? (
        <FormPanel
          kicker="Payment"
          title={`Record payment for ${itemTitle}`}
          onClose={() => {
            setShowRecordForm(false);
            setError(null);
          }}
        >
          <form onSubmit={handleRecordPayment} className="grid gap-3 sm:grid-cols-2">
            {error ? (
              <p className="border border-[var(--bad)] bg-[var(--white)] p-2 text-sm text-[var(--bad)] sm:col-span-2">
                {error}
              </p>
            ) : null}

            <Field label="Amount (ETB) *">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={remaining}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="field"
                placeholder={`Max: ${remaining.toFixed(2)}`}
                disabled={isPendingMutation}
                required
              />
            </Field>

            <Field label="Payment date *">
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="field"
                disabled={isPendingMutation}
                required
              />
            </Field>

            {kind === "material" && categories.length > 0 ? (
              <Field label="Category">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="field"
                  disabled={isPendingMutation}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className={kind === "material" && categories.length > 0 ? "" : "sm:col-span-2"}>
              <Field label="Payment note (optional)">
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="e.g. Bank transfer, installment 1"
                  className="field"
                  disabled={isPendingMutation}
                />
              </Field>
            </div>

            <div className="mt-2 sm:col-span-2">
              <FormActions
                saveLabel="Save payment"
                onCancel={() => {
                  setShowRecordForm(false);
                  setError(null);
                }}
                loading={isPendingMutation}
              />
            </div>
          </form>
        </FormPanel>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-mono text-[0.8rem] uppercase tracking-wider text-black/50">
          Payment Transactions
        </h3>
        {remaining > 0 && canMutate && !showRecordForm ? (
          <button
            type="button"
            className="btn text-xs"
            onClick={() => {
              setError(null);
              setPaymentAmount(remaining.toFixed(2));
              setShowRecordForm(true);
            }}
          >
            + Record payment
          </button>
        ) : null}
      </div>

      {paymentsQuery.isLoading && !paymentsQuery.data ? (
        <div className="p-8 text-center text-sm text-black/40">Loading payments...</div>
      ) : payments.length === 0 ? (
        <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
          No payment transactions recorded for this sale.
        </div>
      ) : (
        <TableWrap data={payments}>
          {(pageRows) => (
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Note</th>
                  <th>Logged By</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => {
                  const canReverse = !p.isReversed && !p.isReversal;
                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-xs">
                        {day(p.transactionDate ?? p.createdAt)}
                      </td>
                      <td>
                        <Stamp value={p.type} tone={statusTone(p.type)} />
                      </td>
                      <td className="whitespace-nowrap font-mono text-sm">{etb(p.amount)}</td>
                      <td
                        className="max-w-[14rem] truncate text-sm text-black/70"
                        title={p.note ?? p.description ?? undefined}
                      >
                        {p.note ?? p.description ?? "—"}
                      </td>
                      <td className="text-xs">
                        <Username userId={p.loggedBy} />
                      </td>
                      <td>
                        {p.isReversed ? (
                          <Stamp value="reversed" tone="bad" />
                        ) : p.isReversal ? (
                          <Stamp value="reversal" tone="yellow" />
                        ) : (
                          <Stamp value="posted" tone="ok" />
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {canReverse && canMutate ? (
                          <button
                            type="button"
                            className="text-xs text-bad hover:underline disabled:opacity-50"
                            disabled={isPendingMutation}
                            onClick={() => setReverseTarget(p)}
                          >
                            Reverse
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}

      <ConfirmDialog
        open={reverseTarget !== null}
        title="Reverse this payment?"
        body={
          reverseTarget
            ? `This will record an offsetting money_out transaction for ${etb(
                reverseTarget.amount
              )}. The collected cash for this sale will decrease by ${etb(
                reverseTarget.amount
              )}. Physical warehouse stock is not altered.`
            : ""
        }
        confirmLabel="Reverse payment"
        danger
        loading={isPendingMutation}
        onCancel={() => setReverseTarget(null)}
        onConfirm={handleConfirmReversePayment}
      />
    </div>
  );
}
