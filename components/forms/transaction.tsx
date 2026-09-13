"use client";

import { useState } from "react";
import { logManualTx, useStore } from "@/lib/store";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { useLicenses } from "@/hooks/use-licenses";
import { useSites } from "@/hooks/use-sites";
import type { TxType, LocationKind } from "@/lib/types";
import type { TransactionCategory, License, Site } from "@/types/api";
import { LocationSelect } from "@/components/LocationSelect";
import { Field } from "@/components/ui";

export function TransactionForm({
  initialSiteId = "",
  onDone,
}: {
  initialSiteId?: string;
  onDone?: () => void;
}) {
  const store = useStore();

  const { data: categoriesData } = useCategories();
  const { data: licensesData } = useLicenses();
  const { data: sitesData } = useSites();
  const createTxMutation = useCreateTransaction();

  const categories = (categoriesData?.data ?? (store.categories as unknown as TransactionCategory[])).filter(
    (c) => !c.deletedAt
  );
  const licenses = (licensesData?.data ?? (store.licenses as unknown as License[])).filter(
    (l) => !l.deletedAt
  );
  const allSites = (sitesData?.data ?? (store.sites as unknown as Site[])).filter(
    (s) => !s.deletedAt
  );

  const lockedSiteName = initialSiteId ? allSites.find(s => s.id === initialSiteId)?.name || "Unknown Site" : "";

  const activeLicenseId = licenses[0]?.id || "";
  const activeCategoryId = categories[0]?.id || "";

  const [type, setType] = useState<TxType>("money_out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [locKind, setLocKind] = useState<LocationKind | "">("site");
  const [locId, setLocId] = useState<string>(initialSiteId);
  const [categoryId, setCategoryId] = useState(activeCategoryId);
  const [licenseId, setLicenseId] = useState(activeLicenseId);
  const [msg, setMsg] = useState<string | null>(null);

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

      const payload = {
        type,
        amount: String(n),
        licenseId: finalLicenseId || undefined,
        siteId,
        warehouseId,
        categoryId: finalCategoryId || undefined,
        description: note || "Manual entry",
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
        });
      }

      setAmount("");
      setNote("");
      setMsg("Approved.");
      if (onDone) onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
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

      <div className="md:col-span-2">
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

      <div className="md:col-span-2">
        <Field label="Note / Description">
          <input
            className="field w-full"
            placeholder="Add a detailed note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>

      <div className="md:col-span-2 flex items-center gap-3">
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
