"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MaterialForm } from "@/components/forms/material";
import { MaterialMovementForm } from "@/components/forms/material-movement";
import { closedMode, DeleteConfirm, FormPanel, ModalPanel, PageHead, RecordActions, Stamp, TableWrap, type RecordMode } from "@/components/ui";
import { isSiteManager, useStore } from "@/lib/store";
import { useInventoryItems, useDeleteInventoryItem, useRestoreInventoryItem } from "@/hooks/use-inventory-items";
import type { InventoryItem } from "@/types/api";

export default function MaterialsPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<RecordMode<InventoryItem>>(closedMode);
  const [purchaseNew, setPurchaseNew] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);

  const { data: itemsData, isLoading } = useInventoryItems({ category: "material", page, limit: 10, search: q || undefined });
  const deleteMutation = useDeleteInventoryItem();
  const restoreMutation = useRestoreInventoryItem();

  const materialsList = itemsData ? itemsData.data : (store.materials as unknown as InventoryItem[]);

  // Catalog only — balances/trace for one item live on /materials/[id],
  // not fetched here.
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return materialsList
      .filter((m) => showDeleted || !m.deletedAt)
      .filter((m) => (term ? m.name.toLowerCase().includes(term) : true));
  }, [q, materialsList, showDeleted]);

  async function handleDelete() {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
      } catch {
        // Handle silently
      }
    }
  }

  async function handleRestore(id: string) {
    try {
      await restoreMutation.mutateAsync(id);
    } catch {
      // Handle silently
    }
  }

  return (
    <div>
      <PageHead
        kicker="Catalog"
        title="Materials"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/materials/movements" className="btn btn-ghost">
              All movements
            </Link>
            {canMutate ? (
              <>
                <label className="flex items-center gap-2 text-sm text-black/70">
                  <input
                    type="checkbox"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                  />
                  Show deleted
                </label>
                <div className="flex gap-2">
                  <RecordActions newLabel="New material" onNew={() => setMode({ kind: "create" })} />
                  <button className="btn" onClick={() => setPurchaseNew(true)}>Purchase New</button>
                </div>
              </>
            ) : null}
          </div>
        }
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Catalog" title="New material" onClose={() => setMode(closedMode())}>
          <MaterialForm onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {purchaseNew ? (
        <ModalPanel kicker="Catalog" title="Purchase new material" onClose={() => setPurchaseNew(false)}>
          <MaterialMovementForm noBg materialId="new" onCancel={() => setPurchaseNew(false)} onSuccess={() => setPurchaseNew(false)} />
        </ModalPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Catalog" title="Edit material" onClose={() => setMode(closedMode())}>
          <MaterialForm initial={mode.record} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Search catalog"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading && !itemsData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading materials...</div>
      ) : (
        <TableWrap pagination={itemsData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Total</th>
                <th className="hidden sm:table-cell">Type</th>
                {canMutate ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/materials/${m.id}`} className="font-medium hover:text-yellow">
                      {m.name}
                    </Link>
                  </td>
                  <td className="font-mono text-sm">{m.totalQuantity} {m.unit}</td>
                  <td className="hidden sm:table-cell">
                    <Stamp value={m.compositionType} />
                  </td>
                  {canMutate ? (
                    <td>
                      <RecordActions
                        onEdit={!m.deletedAt ? () => setMode({ kind: "edit", record: m }) : undefined}
                        onDelete={!m.deletedAt ? () => setMode({ kind: "delete", record: m, label: m.name }) : undefined}
                        onRestore={m.deletedAt ? () => handleRestore(m.id) : undefined}
                        restoreDisabled={restoreMutation.isPending}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDelete}
      />
    </div>
  );
}
