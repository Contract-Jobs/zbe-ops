"use client";

import Link from "next/link";
import { useState } from "react";
import { WarehouseForm } from "@/components/forms/master";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, TableWrap, type RecordMode } from "@/components/ui";
import { isSiteManager, useStore } from "@/lib/store";
import { useWarehouses, useDeleteWarehouse, useRestoreWarehouse } from "@/hooks/use-warehouses";
import type { Warehouse } from "@/types/api";

export default function WarehousesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Warehouse>>(closedMode);
  const [showDeleted, setShowDeleted] = useState(false);

  const [page, setPage] = useState(1);

  const { data: warehousesData, isLoading } = useWarehouses({ page, limit: 10 });
  const deleteMutation = useDeleteWarehouse();
  const restoreMutation = useRestoreWarehouse();

  const warehouses = (warehousesData ? warehousesData.data : (store.warehouses as unknown as Warehouse[])).filter(
    (w) => showDeleted || !w.deletedAt
  );

  async function handleDelete() {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
      } catch {
        // Handled
      }
    }
  }

  async function handleRestore(id: string) {
    try {
      await restoreMutation.mutateAsync(id);
    } catch {
      // Handled
    }
  }

  return (
    <div>
      <PageHead
        kicker="Central"
        title="Warehouses"
        action={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show deleted
            </label>
            {canMutate ? <RecordActions newLabel="New warehouse" onNew={() => setMode({ kind: "create" })} /> : undefined}
          </div>
        }
      />
      <p className="mb-6 text-sm text-black/70">
        Warehouses are not scoped to a site manager. Sales can only leave a warehouse. Transfers onto a job still go through
        Approvals.
      </p>
      {mode.kind === "create" ? (
        <FormPanel kicker="Central" title="New warehouse" onClose={() => setMode(closedMode())}>
          <WarehouseForm onDone={() => setMode(closedMode())} onCancel={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Central" title="Edit warehouse" onClose={() => setMode(closedMode())}>
          <WarehouseForm initial={mode.record} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-black/50">Loading warehouses...</div>
      ) : (
        <TableWrap pagination={warehousesData?.pagination} onPageChange={setPage}>
          <table className="data w-full text-left">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Location</th>
                {/* <th>Materials on hand</th>
                <th className="hidden sm:table-cell">Plant parked</th> */}
                {canMutate ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => {
                const Materials = store.balances.filter(
                  (b) => b.locationKind === "warehouse" && b.locationId === w.id && b.quantity > 0
                ).length;
                const plant = store.equipment.filter((e) => e.warehouseId === w.id && !e.deletedAt).length;
                return (
                  <tr key={w.id}>
                    <td className="font-medium">
                      <Link href={`/warehouses/${w.id}`} className="hover:underline">
                        {w.name}
                      </Link>
                    </td>
                    <td>{w.location ?? "—"}</td>
                    {/* <td className="font-mono">{Materials}</td>
                    <td className="hidden font-mono sm:table-cell">{plant}</td> */}
                    {canMutate ? (
                      <td>
                        <RecordActions
                          onEdit={!w.deletedAt ? () => setMode({ kind: "edit", record: w }) : undefined}
                          onDelete={!w.deletedAt ? () => setMode({ kind: "delete", record: w, label: w.name }) : undefined}
                          onRestore={w.deletedAt ? () => handleRestore(w.id) : undefined}
                          restoreDisabled={restoreMutation.isPending}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
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
