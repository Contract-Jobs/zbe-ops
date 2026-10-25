"use client";

import { useState } from "react";
import { logManualTx, useStore, currentUser } from "@/lib/store";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useLicenses } from "@/hooks/use-licenses";
import { useSite } from "@/hooks/use-sites";
import type { TxType, LocationKind } from "@/lib/types";
import type { TransactionCategory, License, Site } from "@/types/api";
import { LocationSelect } from "@/components/LocationSelect";
import { Field } from "@/components/ui";
import { etb } from "@/lib/format";

export function TransactionForm({
  initialSiteId = "",
  onDone,
}: {
  initialSiteId?: string;
  onDone?: () => void;
}) {
  const store = useStore();
  const user = currentUser(store);
  const requiresApproval = user.role !== "admin" && user.role !== "superadmin";

  const { data: categoriesData } = useCategories();
  const { data: licensesData } = useLicenses();
  const { data: siteData } = useSite(initialSiteId || undefined);
  const createTxMutation = useCreateTransaction();

  const categories = (categoriesData?.data ?? (store.categories as unknown as TransactionCategory[])).filter(
    (c) => !c.deletedAt
  );
  const licenses = (licensesData?.data ?? (store.licenses as unknown as License[])).filter(
    (l) => !l.deletedAt
  );

  const lockedSiteName = initialSiteId
    ? siteData?.data?.name || (store.sites.find((s) => s.id === initialSiteId) as unknown as Site | undefined)?.name || "Unknown Site"
    : "";

  const activeLicenseId = licenses[0]?.id || "";
  const activeCategoryId = categories[0]?.id || "";

  const [type, setType] = useState<TxType>("money_out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [locKind, setLocKind] = useState<LocationKind | "">("site");
  const [locId, setLocId] = useState<string>(initialSiteId);
  const [categoryId, setCategoryId] = useState(activeCategoryId);
  const [licenseId, setLicenseId] = useState(activeLicenseId);
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [msg, setMsg] = useState<string | null>(null);
  // Taxes already inside the amount (the amount stays the total paid/received).
  const [taxes, setTaxes] = useState<Array<{ taxType: "vat" | "other"; label: string; amount: string }>>([]);

  // Frontend only. Unchecked: the amount typed is before tax and the taxes
  // are added on top. Checked: the amount typed is already the total.
  const [includesTax, setIncludesTax] = useState(false);
  const taxTotal = taxes.reduce((sum, t) => sum + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);
  const typedAmount = Number(amount) > 0 ? Number(amount) : 0;
  const totalAmount = includesTax ? typedAmount : typedAmount + taxTotal;

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const n = Number(amount);
      if (!n || n <= 0) throw new Error("Valid amount required");

      const finalLicenseId = licenseId || activeLicenseId;
      const finalCategoryId = categoryId || activeCategoryId;
      const siteId = locKind === "site" ? locId : undefined;
      const warehouseId = locKind === "warehouse" ? locId : undefined;

      const cleanTaxes = taxes
        .filter((t) => t.amount.trim() !== "")
        .map((t) => ({
          taxType: t.taxType,
          label: t.taxType === "other" ? t.label.trim() : undefined,
          amount: t.amount.trim(),
        }));
      if (cleanTaxes.some((t) => !(Number(t.amount) > 0))) throw new Error("Each tax must be more than 0");
      if (cleanTaxes.some((t) => t.taxType === "other" && !t.label)) throw new Error("Name each other tax");
      if (includesTax && cleanTaxes.reduce((sum, t) => sum + Number(t.amount), 0) > n + 0.005) {
        throw new Error("Taxes cannot add up to more than the amount");
      }
      // The API amount is always the total paid/received, taxes inside it.
      const sendAmount = includesTax ? n : n + cleanTaxes.reduce((sum, t) => sum + Number(t.amount), 0);

      const payload = {
        taxes: cleanTaxes.length > 0 ? cleanTaxes : undefined,
        type,
        amount: sendAmount.toFixed(2),
        licenseId: finalLicenseId || undefined,
        siteId,
        warehouseId,
        note,
        categoryId: finalCategoryId || undefined,
        description: note || "Manual entry",
        transactionDate,
      };

      if (createTxMutation) {
        await createTxMutation.mutateAsync(payload);
      } else {
        logManualTx({
          type,
          amount: n,
          licenseId: finalLicenseId,
          siteId,
          warehouseId,
          categoryId: finalCategoryId,
          note: note || "Manual entry",
          transactionDate,
        });
      }

      setAmount("");
      setNote("");
      setTaxes([]);
      setIncludesTax(false);
      setMsg(requiresApproval ? "Transaction submitted for approval." : "Approved.");
      if (onDone) onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handlePost}
    >
      <Field label="Type">
        <div className="flex items-center gap-2">
          <select className="field w-32 shrink-0" value={type} onChange={(e) => setType(e.target.value as TxType)}>
            <option value="money_out">Money out</option>
            <option value="money_in">Money in</option>
          </select>
        </div>
      </Field>

      <Field label="Date">
        <input
          className="field flex-1 min-w-0"
          type="date"
          required
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
        />
      </Field>

      <Field label="Amount">
        <input
          className="field flex-1 min-w-0"
          placeholder="Amount ETB"
          type="number"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {licenses.length > 1 ? (
        <Field label="License">
          <select className="field w-full" value={licenseId || activeLicenseId} onChange={(e) => setLicenseId(e.target.value)}>
            {licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Category">
        <select className="field w-full" value={categoryId || activeCategoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="sm:col-span-2">
        <Field label="Location">
          {initialSiteId ? (
            <div className="flex h-10 w-full items-center rounded border border-black/10 bg-black/5 px-3 text-sm text-black/70">
              {lockedSiteName}
            </div>
          ) : (
            <LocationSelect
              kind={locKind}
              id={locId}
              onKind={setLocKind}
              onId={setLocId}
            />
          )}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <p className="text-sm">Taxes included in the amount (optional)</p>
        {taxes.map((t, i) => (
          <div key={i} className="mt-2 flex flex-col gap-2 sm:flex-row">
            <select
              className="field sm:w-40"
              value={t.taxType}
              onChange={(e) =>
                setTaxes(taxes.map((x, j) => (j === i ? { ...x, taxType: e.target.value as "vat" | "other" } : x)))
              }
            >
              <option value="vat">VAT</option>
              <option value="other">Other tax</option>
            </select>
            {t.taxType === "other" ? (
              <input
                className="field"
                placeholder="Name, e.g. Withholding"
                value={t.label}
                onChange={(e) => setTaxes(taxes.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              />
            ) : null}
            <input
              className="field sm:w-40"
              placeholder="Amount ETB"
              type="number"
              step="0.01"
              min="0.01"
              value={t.amount}
              onChange={(e) => setTaxes(taxes.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
            />
            <button type="button" className="btn btn-ghost" onClick={() => setTaxes(taxes.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        {taxes.length < 10 ? (
          <button
            type="button"
            className="btn btn-ghost mt-2"
            onClick={() => setTaxes([...taxes, { taxType: "vat", label: "", amount: "" }])}
          >
            Add tax
          </button>
        ) : null}
        {taxes.length > 0 ? (
          <>
            <label className="mt-3 flex items-center gap-2 text-sm text-black/70">
              <input type="checkbox" checked={includesTax} onChange={(e) => setIncludesTax(e.target.checked)} />
              Amount includes tax
            </label>
            <p className="kicker mt-3">Cost summary</p>
            <dl className="mt-1 grid grid-cols-2 gap-1 border border-black/10 p-3 text-sm">
              <dt className="text-black/60">Before tax</dt>
              <dd className="text-right font-mono">{etb(Math.max(0, totalAmount - taxTotal).toFixed(2))}</dd>
              <dt className="text-black/60">Tax</dt>
              <dd className="text-right font-mono">{etb(taxTotal.toFixed(2))}</dd>
              <dt className="font-medium">{type === "money_out" ? "Total paid" : "Total received"}</dt>
              <dd className="text-right font-mono font-medium">{etb(totalAmount.toFixed(2))}</dd>
            </dl>
          </>
        ) : null}
        <p className="mt-1 text-xs text-black/50">
          VAT is counted as VAT paid in the VAT report; other taxes are only recorded.
        </p>
      </div>

      <div className="sm:col-span-2">
        <Field label="Note / Description">
          <input
            className="field w-full"
            placeholder="Add a detailed note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      <div className="sm:col-span-2 flex items-center gap-3">
        <button
          className="btn"
          type="submit"
          disabled={createTxMutation.isPending}
        >
          {createTxMutation.isPending ? "Posting..." : "Post Transaction"}
        </button>
        {msg ? <p className="text-sm text-black/70">{msg}</p> : null}
      </div>
    </form>
  );
}
