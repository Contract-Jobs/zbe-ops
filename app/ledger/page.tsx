"use client";

import { useMemo, useState } from "react";
import { CategoryForm } from "@/components/forms/master";
import { ConfirmDialog, FormPanel, PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, logManualTx, useStore, visibleSiteIds } from "@/lib/store";
import { useTransactions, useCreateTransaction } from "@/hooks/use-transactions";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { useLicenses } from "@/hooks/use-licenses";
import { useSites } from "@/hooks/use-sites";
import type { TxType } from "@/lib/types";
import type { Transaction, TransactionCategory, License, Site } from "@/types/api";

export default function LedgerPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const sites = visibleSiteIds(store);

  const { data: transactionsData, isLoading: isTxLoading } = useTransactions();
  const { data: categoriesData } = useCategories();
  const { data: licensesData } = useLicenses();
  const { data: sitesData } = useSites();

  const createTxMutation = useCreateTransaction();
  const deleteCategoryMutation = useDeleteCategory();

  const categories = (categoriesData?.data ?? (store.categories as unknown as TransactionCategory[])).filter(
    (c) => !c.deletedAt
  );
  const licenses = (licensesData?.data ?? (store.licenses as unknown as License[])).filter(
    (l) => !l.deletedAt
  );
  const allSites = (sitesData?.data ?? (store.sites as unknown as Site[])).filter(
    (s) => !s.deletedAt
  );

  const [type, setType] = useState<TxType>("money_out");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [siteId, setSiteId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [dropCat, setDropCat] = useState<TransactionCategory | null>(null);
  const canMutate = !manager;

  const activeLicenseId = licenseId || licenses[0]?.id || "";
  const activeCategoryId = categoryId || categories[0]?.id || "";

  const transactions = transactionsData?.data ?? (store.transactions as unknown as Transaction[]);

  const rows = useMemo(() => {
    return transactions.filter((t) => {
      if (store.session.licenseId !== "all" && t.licenseId !== store.session.licenseId) return false;
      if (manager) return t.siteId ? sites.has(t.siteId) : false;
      return true;
    });
  }, [manager, sites, store.session.licenseId, transactions]);

  const grouped = categories.map((c) => ({
    ...c,
    out: rows
      .filter((t) => t.categoryId === c.id && t.type === "money_out")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0),
  }));

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const n = Number(amount);
      if (!n || n <= 0) throw new Error("Valid amount required");

      const payload = {
        type,
        amount: String(n),
        licenseId: activeLicenseId || undefined,
        siteId: siteId || undefined,
        categoryId: activeCategoryId || undefined,
        description: note || "Manual entry",
      };

      if (transactionsData) {
        await createTxMutation.mutateAsync(payload);
      } else {
        logManualTx({
          type,
          amount: n,
          licenseId: activeLicenseId,
          siteId: siteId || undefined,
          categoryId: activeCategoryId,
          note: note || "Manual entry",
        });
      }

      setAmount("");
      setNote("");
      setMsg("Posted.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDropCategory = async () => {
    if (!dropCat) return;
    try {
      await deleteCategoryMutation.mutateAsync(dropCat.id);
      setDropCat(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  return (
    <div>
      <PageHead
        kicker="Money"
        title="Ledger"
        action={canMutate ? (
          <button type="button" className="btn" onClick={() => setCatOpen(true)}>
            New category
          </button>
        ) : undefined}
      />
      <p className="mb-6 max-w-xl text-black/65">
        Manual income and expense post immediately — they do not wait in Approvals. Stock and plant movements still do, and they write their own lines when approved.
      </p>
      {catOpen ? (
        <FormPanel kicker="Money" title="New category" onClose={() => setCatOpen(false)}>
          <CategoryForm onCancel={() => setCatOpen(false)} onDone={() => setCatOpen(false)} />
        </FormPanel>
      ) : null}

      <div className="mb-8 grid gap-px bg-black/10 sm:grid-cols-3 lg:grid-cols-5">
        {grouped.map((c) => (
          <div key={c.id} className="bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="kicker">{c.name}</p>
              {canMutate ? (
                <button
                  type="button"
                  className="btn btn-ghost-bad px-2 py-0.5 text-sm"
                  onClick={() => setDropCat(c)}
                >
                  Delete
                </button>
              ) : null}
            </div>
            <p className="mt-2 font-mono text-sm">{etb(c.out)}</p>
          </div>
        ))}
      </div>

      <form
        className="mb-8 grid gap-3 border border-black/10 bg-paper/30 p-5 md:grid-cols-6"
        onSubmit={handlePost}
      >
        <select className="field" value={type} onChange={(e) => setType(e.target.value as TxType)}>
          <option value="money_out">Money out</option>
          <option value="money_in">Money in</option>
        </select>
        <input
          className="field"
          placeholder="Amount ETB"
          type="number"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select className="field" value={activeLicenseId} onChange={(e) => setLicenseId(e.target.value)}>
          {licenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select className="field" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          <option value="">No site</option>
          {allSites
            .filter((s) => (manager ? sites.has(s.id) : true))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <select className="field" value={activeCategoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          className="btn w-full md:w-auto"
          type="submit"
          disabled={createTxMutation.isPending}
        >
          {createTxMutation.isPending ? "Posting..." : "Post"}
        </button>
        <input
          className="field md:col-span-6"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {msg ? <p className="text-sm md:col-span-6">{msg}</p> : null}
      </form>

      {isTxLoading && !transactionsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading transactions...</div>
      ) : (
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Note</th>
                <th className="hidden md:table-cell">Category</th>
                <th className="hidden sm:table-cell">Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const desc = t.description ?? (t as unknown as { note?: string }).note ?? "Manual entry";
                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{day(t.transactionDate)}</td>
                    <td className="min-w-0">
                      {desc}
                      {t.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
                      <span className="mt-1 block sm:hidden">
                        <Stamp value={t.type} tone={statusTone(t.type)} />
                      </span>
                    </td>
                    <td className="hidden md:table-cell">
                      {categories.find((c) => c.id === t.categoryId)?.name ?? "—"}
                    </td>
                    <td className="hidden sm:table-cell">
                      <Stamp value={t.type} tone={statusTone(t.type)} />
                    </td>
                    <td className="whitespace-nowrap font-mono text-sm">{etb(Number(t.amount) || 0)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-black/45">
                    No transactions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}

      <ConfirmDialog
        open={dropCat !== null}
        title="Are you sure?"
        body={`${dropCat?.name ?? "This category"} will be removed. There is no restore on this record.`}
        loading={deleteCategoryMutation.isPending}
        onCancel={() => setDropCat(null)}
        onConfirm={handleDropCategory}
      />
    </div>
  );
}

