"use client";

import { useState } from "react";
import { WarehouseForm } from "@/components/forms/master";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, TableWrap, type RecordMode } from "@/components/ui";
import { isSiteManager, useStore } from "@/lib/store";
import { useWarehouses, useDeleteWarehouse } from "@/hooks/use-warehouses";
import type { Warehouse } from "@/types/api";

export default function WarehousesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Warehouse>>(closedMode);

  const { data: warehousesData, isLoading } = useWarehouses();
  const deleteMutation = useDeleteWarehouse();

  const warehouses = warehousesData ? warehousesData.data : (store.warehouses as unknown as Warehouse[]);

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

  return (
    <div>
      <PageHead
        kicker="Central"
        title="Yards"
        action={canMutate ? <RecordActions newLabel="New yard" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      <p className="mb-6 max-w-xl text-black/65">
        Warehouses are not scoped to a site manager. Sales can only leave a yard. Transfers onto a job still go through
        Approvals.
      </p>
      {mode.kind === "create" ? (
        <FormPanel kicker="Central" title="New yard" onClose={() => setMode(closedMode())}>
          <WarehouseForm onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Central" title="Edit yard" onClose={() => setMode(closedMode())}>
          <WarehouseForm initial={mode.record} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {isLoading && !warehousesData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading yards...</div>
      ) : (
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Yard</th>
                <th>Location</th>
                <th>SKUs on hand</th>
                <th className="hidden sm:table-cell">Plant parked</th>
                {canMutate ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => {
                const skus = store.balances.filter(
                  (b) => b.locationKind === "warehouse" && b.locationId === w.id && b.quantity > 0
                ).length;
                const plant = store.equipment.filter((e) => e.warehouseId === w.id && !e.deletedAt).length;
                return (
                  <tr key={w.id}>
                    <td className="font-medium">{w.name}</td>
                    <td>{w.location ?? "—"}</td>
                    <td className="font-mono">{skus}</td>
                    <td className="hidden font-mono sm:table-cell">{plant}</td>
                    {canMutate ? (
                      <td>
                        <RecordActions
                          onEdit={() => setMode({ kind: "edit", record: w })}
                          onDelete={() => setMode({ kind: "delete", record: w, label: w.name })}
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
