"use client";

import { useState } from "react";
import { WarehouseForm } from "@/components/forms/master";
import { closedMode, DeleteConfirm, FormPanel, PageHead, RecordActions, TableWrap, type RecordMode } from "@/components/ui";
import { isSiteManager, useStore } from "@/lib/store";
import type { Warehouse } from "@/lib/types";

export default function WarehousesPage() {
  const store = useStore();
  const canMutate = !isSiteManager(store);
  const [mode, setMode] = useState<RecordMode<Warehouse>>(closedMode);

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
            {store.warehouses.map((w) => {
              const skus = store.balances.filter(
                (b) => b.locationKind === "warehouse" && b.locationId === w.id && b.quantity > 0
              ).length;
              const plant = store.equipment.filter((e) => e.warehouseId === w.id && !e.deletedAt).length;
              return (
                <tr key={w.id}>
                  <td className="font-medium">{w.name}</td>
                  <td>{w.location}</td>
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
      <DeleteConfirm mode={mode} restore onClose={() => setMode(closedMode())} />
    </div>
  );
}
