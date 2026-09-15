"use client";

import { useMemo, useState } from "react";
import { CategoryForm } from "@/components/forms/master";
import { TransactionForm } from "@/components/forms/transaction";
import { ConfirmDialog, FormPanel, PageHead, Stamp, TableWrap, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories, useDeleteCategory } from "@/hooks/use-categories";
import { useSites } from "@/hooks/use-sites";
import type { Transaction, TransactionCategory, Site } from "@/types/api";

export default function TransactionsPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const sites = visibleSiteIds(store);
  const [page, setPage] = useState(1);

  const { data: transactionsData, isLoading: isTxLoading } = useTransactions({ page, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
  const { data: categoriesData } = useCategories();
  const { data: sitesData } = useSites();

  const deleteCategoryMutation = useDeleteCategory();

  const [showDeletedCats, setShowDeletedCats] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [dropCat, setDropCat] = useState<TransactionCategory | null>(null);

  const canMutate = !manager;

  const categories = (categoriesData?.data ?? (store.categories as unknown as TransactionCategory[])).filter(
    (c) => showDeletedCats || !c.deletedAt
  );

  const allSites = sitesData?.data ?? (store.sites as unknown as Site[]);

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
    out: transactions
      .filter((t) => t.categoryId === c.id && t.type === "money_out")
      .reduce((s, t) => s + (Number(t.amount) || 0), 0),
  }));

  const handleDropCategory = async () => {
    if (!dropCat) return;
    try {
      await deleteCategoryMutation.mutateAsync(dropCat.id);
      setDropCat(null);
    } catch {
      // Ignore
    }
  };

  return (
    <div>
      <PageHead
        kicker="Money"
        title="Transactions"
        action={canMutate ? (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                checked={showDeletedCats}
                onChange={(e) => setShowDeletedCats(e.target.checked)}
              />
              Show deleted categories
            </label>
            <button type="button" className="btn" onClick={() => setCatOpen(true)}>
              New category
            </button>
          </div>
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
              {canMutate && !c.deletedAt ? (
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

      <div className="mb-8 border border-black/10 bg-paper/30 p-5">
        <TransactionForm />
      </div>

      {isTxLoading && !transactionsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading transactions...</div>
      ) : (
        <TableWrap pagination={transactionsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th className="hidden md:table-cell">Category</th>
                <th className="hidden sm:table-cell">Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const desc = t.description ?? "Manual entry";
                const siteName = allSites.find(s => s.id === t.siteId)?.name ?? "HQ";

                return (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{day(t.transactionDate ?? (t as any).date ?? t.createdAt)}</td>
                    <td className="min-w-0">
                      <div className="font-medium">{siteName}</div>
                      <div className="text-sm text-black/60">{desc}</div>
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
                  <td colSpan={5} className="py-12 text-center text-sm text-black/45">
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
