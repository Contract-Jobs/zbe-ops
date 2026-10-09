"use client";

import { useMemo, useState } from "react";
import { CategoryForm } from "@/components/forms/master";
import { TransactionForm } from "@/components/forms/transaction";
import { ConfirmDialog, FormPanel, ModalPanel, PageHead, Stamp, TableWrap, Username, statusTone } from "@/components/ui";
import { day, etb } from "@/lib/format";
import { currentUser, isSiteManager, useStore, visibleSiteIds } from "@/lib/store";
import { useTransactions, useTransaction, useReverseTransaction } from "@/hooks/use-transactions";
import { useCategories, useCategoriesInBulk, useDeleteCategory } from "@/hooks/use-categories";
import { useSitesInBulk } from "@/hooks/use-sites";
import { useWarehousesInBulk } from "@/hooks/use-warehouses";
import { useLicensesInBulk } from "@/hooks/use-licenses";
import { useEquipmentInBulk } from "@/hooks/use-equipment";
import { useInventoryItemsInBulk } from "@/hooks/use-inventory-items";
import type { Transaction, TransactionCategory, Site, Warehouse } from "@/types/api";

export default function TransactionsPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const user = currentUser(store);
  const canMutate = !manager;
  const sites = visibleSiteIds(store);
  const [page, setPage] = useState(1);

  const { data: transactionsData, isLoading: isTxLoading } = useTransactions({ page, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
  const { data: categoriesData } = useCategories();

  const deleteCategoryMutation = useDeleteCategory();
  const reverseTransactionMutation = useReverseTransaction();

  const [showDeletedCats, setShowDeletedCats] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [dropCat, setDropCat] = useState<TransactionCategory | null>(null);
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const categories = (categoriesData?.data ?? (store.categories as unknown as TransactionCategory[])).filter(
    (c) => showDeletedCats || !c.deletedAt
  );

  const transactions = transactionsData?.data ?? (store.transactions as unknown as Transaction[]);

  const rows = useMemo(() => {
    return transactions.filter((t) => {
      if (store.session.licenseId !== "all" && t.licenseId !== store.session.licenseId) return false;
      if (manager) return t.siteId ? sites.has(t.siteId) : false;
      return true;
    });
  }, [manager, sites, store.session.licenseId, transactions]);

  // Resolve entity IDs present in current rows via /in-bulk endpoints
  const siteIds = useMemo(() => {
    return Array.from(new Set(rows.map((t) => t.siteId).filter((id): id is string => Boolean(id))));
  }, [rows]);

  const warehouseIds = useMemo(() => {
    return Array.from(new Set(rows.map((t) => t.warehouseId).filter((id): id is string => Boolean(id))));
  }, [rows]);

  const categoryIds = useMemo(() => {
    return Array.from(new Set(rows.map((t) => t.categoryId).filter((id): id is string => Boolean(id))));
  }, [rows]);

  const { data: bulkSites } = useSitesInBulk(siteIds);
  const { data: bulkWarehouses } = useWarehousesInBulk(warehouseIds);
  const { data: bulkCategories } = useCategoriesInBulk(categoryIds);

  const sitesMap = useMemo(() => {
    const map = new Map<string, Site>();
    bulkSites?.data?.forEach((s) => map.set(s.id, s));
    return map;
  }, [bulkSites]);

  const warehousesMap = useMemo(() => {
    const map = new Map<string, Warehouse>();
    bulkWarehouses?.data?.forEach((w) => map.set(w.id, w));
    return map;
  }, [bulkWarehouses]);

  const categoriesMap = useMemo(() => {
    const map = new Map<string, TransactionCategory>();
    bulkCategories?.data?.forEach((c) => map.set(c.id, c));
    return map;
  }, [bulkCategories]);

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

  const handleReverse = async () => {
    if (!reverseTarget) return;
    setReverseError(null);
    try {
      await reverseTransactionMutation.mutateAsync(reverseTarget.id);
      setReverseTarget(null);
    } catch (e) {
      setReverseError(e instanceof Error ? e.message : "Reversal failed — the API rejected this request.");
    }
  };

  const canReverseTx = (t: Transaction) => {
    return (
      !t.isReversal &&
      !t.isReversed &&
      // Only manual transactions are reversible this way — a
      // system-generated one (the automatic ledger side-effect of
      // a movement) would 403.
      !t.isSystemGenerated &&
      (
        // Admins can reverse any transaction
        // Site managers can reverse manual transactions on sites they manage;
        // equipmentId !== null means auto-linked to an equipment log — excluded.
        // Material-log-linked transactions have no client field, so the API
        // will 403 and the error is surfaced in the confirm dialog.
        ((manager || (user?.role === "admin" || user?.role === "superadmin")) && !!t.siteId)
      )
    );
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
            <button type="button" className="btn btn-ghost" onClick={() => setCatOpen(true)}>
              New category
            </button>
            <button type="button" className="btn" onClick={() => setAddTxOpen(true)}>
              Log transaction
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

      {addTxOpen ? (
        <FormPanel kicker="Money" title="Log Manual Transaction" onClose={() => setAddTxOpen(false)}>
          <TransactionForm onDone={() => setAddTxOpen(false)} />
        </FormPanel>
      ) : null}

      {isTxLoading && !transactionsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading transactions...</div>
      ) : (
        <TableWrap pagination={transactionsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Site</th>
                <th>Warehouse</th>
                <th className="hidden md:table-cell">Category</th>
                <th className="hidden sm:table-cell">Type</th>
                <th>Note</th>
                <th>Amount</th>
                {canMutate && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const siteName = t.siteId
                  ? sitesMap.get(t.siteId)?.name ?? store.sites.find((s) => s.id === t.siteId)?.name ?? t.siteId
                  : "";
                const warehouseName = t.warehouseId
                  ? warehousesMap.get(t.warehouseId)?.name ?? store.warehouses.find((w) => w.id === t.warehouseId)?.name ?? t.warehouseId
                  : "";
                const categoryName = t.categoryId
                  ? categoriesMap.get(t.categoryId)?.name ?? store.categories.find((c) => c.id === t.categoryId)?.name ?? "—"
                  : "—";
                const isHq = !t.siteId && !t.warehouseId;
                const canReverse = canReverseTx(t);
                const noteValue = t.note || t.description || "";

                return (
                  <tr
                    key={t.id}
                    onClick={() => setDetailTx(t)}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailTx(t);
                      }
                    }}
                  >
                    <td className="whitespace-nowrap">{day(t.transactionDate ?? t.createdAt)}</td>
                    <td className="min-w-0">
                      <div className="font-medium">{siteName || (isHq ? "HQ" : "—")}</div>
                      {t.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
                      <span className="mt-1 block sm:hidden">
                        <Stamp value={t.type} tone={statusTone(t.type)} />
                      </span>
                    </td>

                    <td className="min-w-0">
                      <div className="font-medium">{warehouseName || "—"}</div>
                    </td>

                    <td className="hidden md:table-cell">{categoryName}</td>
                    <td className="hidden sm:table-cell">
                      <Stamp value={t.type} tone={statusTone(t.type)} />
                    </td>
                    <td
                      className="max-w-[12rem] truncate text-sm text-black/70"
                      title={noteValue || undefined}
                    >
                      {noteValue || "—"}
                    </td>
                    <td className="whitespace-nowrap font-mono text-sm">{etb(Number(t.amount) || 0)}</td>
                    {canMutate && (
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {canReverse ? (
                          <button
                            type="button"
                            className="btn btn-ghost-bad px-2 py-0.5 text-xs"
                            onClick={() => setReverseTarget(t)}
                          >
                            Reverse
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={canMutate ? 8 : 7} className="py-12 text-center text-sm text-black/45">
                    No transactions found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableWrap>
      )}

      {detailTx ? (
        <ModalPanel
          kicker="Money"
          title="Transaction detail"
          onClose={() => setDetailTx(null)}
        >
          <TransactionDetailModal
            transaction={detailTx}
            sitesMap={sitesMap}
            warehousesMap={warehousesMap}
            categoriesMap={categoriesMap}
            canReverse={canMutate && canReverseTx(detailTx)}
            onReverse={() => {
              const target = detailTx;
              setDetailTx(null);
              setReverseTarget(target);
            }}
            onClose={() => setDetailTx(null)}
          />
        </ModalPanel>
      ) : null}

      <ConfirmDialog
        open={dropCat !== null}
        title="Are you sure?"
        body={`${dropCat?.name ?? "This category"} will be removed. There is no restore on this record.`}
        loading={deleteCategoryMutation.isPending}
        onCancel={() => setDropCat(null)}
        onConfirm={handleDropCategory}
      />

      <ConfirmDialog
        open={reverseTarget !== null}
        title="Reverse this transaction?"
        body={
          reverseError
            ? reverseError
            : `This will create an inverse ${reverseTarget?.type === "money_out" ? "money-in" : "money-out"} entry for ${etb(Number(reverseTarget?.amount) || 0)}. This cannot be undone.`
        }
        confirmLabel="Reverse transaction"
        danger
        loading={reverseTransactionMutation.isPending}
        onCancel={() => {
          setReverseTarget(null);
          setReverseError(null);
        }}
        onConfirm={handleReverse}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="kicker">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function TransactionDetailModal({
  transaction: initialTx,
  sitesMap,
  warehousesMap,
  categoriesMap,
  canReverse,
  onReverse,
  onClose,
}: {
  transaction: Transaction;
  sitesMap: Map<string, Site>;
  warehousesMap: Map<string, Warehouse>;
  categoriesMap: Map<string, TransactionCategory>;
  canReverse: boolean;
  onReverse: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const { data: detailData } = useTransaction(initialTx.id);
  const tx = detailData?.data ?? initialTx;

  const licenseIds = useMemo(() => (tx.licenseId ? [tx.licenseId] : []), [tx.licenseId]);
  const siteIds = useMemo(() => (tx.siteId ? [tx.siteId] : []), [tx.siteId]);
  const warehouseIds = useMemo(() => (tx.warehouseId ? [tx.warehouseId] : []), [tx.warehouseId]);
  const categoryIds = useMemo(() => (tx.categoryId ? [tx.categoryId] : []), [tx.categoryId]);
  const equipmentIds = useMemo(() => (tx.equipmentId ? [tx.equipmentId] : []), [tx.equipmentId]);
  const itemIds = useMemo(() => (tx.itemId ? [tx.itemId] : []), [tx.itemId]);

  const { data: licenseData } = useLicensesInBulk(licenseIds);
  const { data: siteData } = useSitesInBulk(siteIds);
  const { data: warehouseData } = useWarehousesInBulk(warehouseIds);
  const { data: categoryData } = useCategoriesInBulk(categoryIds);
  const { data: equipmentData } = useEquipmentInBulk(equipmentIds);
  const { data: itemData } = useInventoryItemsInBulk(itemIds);

  const site = siteData?.data?.[0] ?? (tx.siteId ? sitesMap.get(tx.siteId) : null);
  const warehouse = warehouseData?.data?.[0] ?? (tx.warehouseId ? warehousesMap.get(tx.warehouseId) : null);
  const category = categoryData?.data?.[0] ?? (tx.categoryId ? categoriesMap.get(tx.categoryId) : null);
  const license = licenseData?.data?.[0];
  const equipment = equipmentData?.data?.[0];
  const item = itemData?.data?.[0];

  const siteName = tx.siteId
    ? site?.name ?? store.sites.find((s) => s.id === tx.siteId)?.name ?? tx.siteId
    : "—";
  const warehouseName = tx.warehouseId
    ? warehouse?.name ?? store.warehouses.find((w) => w.id === tx.warehouseId)?.name ?? tx.warehouseId
    : "—";
  const categoryName = tx.categoryId
    ? category?.name ?? store.categories.find((c) => c.id === tx.categoryId)?.name ?? tx.categoryId
    : "—";
  const licenseName = tx.licenseId
    ? license?.name ?? store.licenses.find((l) => l.id === tx.licenseId)?.name ?? tx.licenseId
    : "—";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Stamp value={tx.type} tone={statusTone(tx.type)} />
        <Stamp
          value={tx.isApproved ? "approved" : "pending"}
          tone={tx.isApproved ? "ok" : "yellow"}
        />
        {tx.isReversal ? <Stamp value="reversal" tone="bad" /> : null}
        {tx.isReversed ? <Stamp value="reversed" tone="bad" /> : null}
        <Stamp value={tx.isSystemGenerated ? "system" : "manual"} tone="ink" />
      </div>

      <div className="mb-6 border-b border-black/10 pb-4">
        <p className="kicker">Amount</p>
        <p
          className={`mt-1 font-mono text-2xl font-medium tracking-tight ${tx.type === "money_in" ? "text-ok" : "text-black"
            }`}
        >
          {tx.type === "money_in" ? "+" : "-"}
          {etb(Number(tx.amount) || 0)}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border border-black/10 p-4 text-sm sm:grid-cols-2 sm:p-5">
        <DetailRow
          label="Transaction date"
          value={<span className="font-mono text-xs">{day(tx.transactionDate ?? tx.createdAt)}</span>}
        />
        <DetailRow
          label="Logged by"
          value={<Username userId={tx.loggedBy} fallback={tx.loggedBy || "—"} />}
        />
        <DetailRow label="Category" value={categoryName} />
        <DetailRow label="License" value={licenseName} />
        <DetailRow label="Site" value={siteName} />
        <DetailRow label="Warehouse" value={warehouseName} />

        {tx.equipmentId ? (
          <DetailRow
            label="Equipment"
            value={
              <span className="font-mono text-xs">
                {equipment
                  ? `${equipment.item?.name ? `${equipment.item.name} · ` : ""}${equipment.identifier}`
                  : tx.equipmentId}
              </span>
            }
          />
        ) : null}

        {tx.itemId ? (
          <DetailRow
            label="Inventory item"
            value={
              <span className="font-mono text-xs">
                {item ? `${item.name} (${tx.itemId})` : tx.itemId}
              </span>
            }
          />
        ) : null}

        {tx.reversalOfId ? (
          <DetailRow
            label="Reversal of"
            value={<span className="font-mono text-xs">{tx.reversalOfId}</span>}
          />
        ) : null}

        {tx.ledgerId ? (
          <DetailRow
            label="Ledger reference"
            value={<span className="font-mono text-xs">{tx.ledgerId}</span>}
          />
        ) : null}

        <DetailRow
          label="Note"
          value={tx.note || "—"}
          fullWidth
        />

        {tx.description && tx.description !== tx.note ? (
          <DetailRow
            label="Description"
            value={tx.description}
            fullWidth
          />
        ) : null}

        <DetailRow
          label="Transaction ID"
          value={
            <span className="font-mono text-xs text-black/60 break-all">
              {tx.id}
            </span>
          }
          fullWidth
        />

        <DetailRow
          label="Created at"
          value={<span className="font-mono text-xs">{day(tx.createdAt)}</span>}
        />

        {tx.updatedAt ? (
          <DetailRow
            label="Updated at"
            value={<span className="font-mono text-xs">{day(tx.updatedAt)}</span>}
          />
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        {canReverse ? (
          <button
            type="button"
            className="btn btn-ghost-bad text-xs"
            onClick={onReverse}
          >
            Reverse transaction
          </button>
        ) : (
          <div />
        )}
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}



