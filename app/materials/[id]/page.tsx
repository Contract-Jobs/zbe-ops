"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialForm, SubitemForm } from "@/components/forms/material";
import {
  closedMode,
  DeleteConfirm,
  FormPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  type RecordMode,
} from "@/components/ui";
import { day, qty, etb } from "@/lib/format";
import { isSiteManager, useStore } from "@/lib/store";
import { useInventoryItem, useDeleteInventoryItem, useSubitems, useRemoveSubitem, useItemBalances, useItemHistory } from "@/hooks/use-inventory-items";
import { QUANTITY_MOVEMENT_LABELS } from "@/lib/movement-labels";
import type { InventoryItem, InventoryItemSubitem } from "@/types/api";

import { MaterialMovementForm } from "@/components/forms/material-movement";

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const { data: materialData, isLoading: isMaterialLoading } = useInventoryItem(id);
  const { data: subItemsData } = useSubitems(id);
  const [balPage, setBalPage] = useState(1);
  const { data: balancesData } = useItemBalances(id, { page: balPage, limit: 10 });
  const [histPage, setHistPage] = useState(1);
  const { data: historyData } = useItemHistory(id, { page: histPage, limit: 20, sortBy: "movementDate", sortOrder: "desc" });

  const deleteMaterialMutation = useDeleteInventoryItem();
  const removeSubItemMutation = useRemoveSubitem(id || "");

  const item = materialData?.data;
  const manager = isSiteManager(store);
  const canMutate = !manager;

  const [mode, setMode] = useState<RecordMode<InventoryItem>>(closedMode);
  const [subMode, setSubMode] = useState<RecordMode<InventoryItemSubitem>>(closedMode);
  const [msg, setMsg] = useState<string | null>(null);

  if (isMaterialLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading material...</p>;
  }

  if (!item) return <p>Material not found.</p>;

  const kits: InventoryItemSubitem[] = subItemsData?.data ?? [];
  const balances = balancesData?.data ?? [];
  const history = historyData?.data ?? [];

  const handleDeleteMaterial = async () => {
    if (mode.kind === "delete" && mode.record) {
      try {
        await deleteMaterialMutation.mutateAsync(mode.record.id);
        setMode(closedMode());
        router.push("/materials");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to delete");
      }
    }
  };

  const handleRemoveSubItem = async () => {
    if (subMode.kind === "delete" && subMode.record) {
      try {
        await removeSubItemMutation.mutateAsync(subMode.record.id);
        setSubMode(closedMode());
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to delete sub-item");
      }
    }
  };

  return (
    <div>
      <PageHead
        kicker="Catalog"
        title={item.name}
        action={
          canMutate ? (
            <RecordActions
              onEdit={() => setMode({ kind: "edit", record: item })}
              onDelete={() => setMode({ kind: "delete", record: item, label: item.name })}
            />
          ) : undefined
        }
      />
      <p className="mb-6 font-mono text-sm text-black/50">
        {item.unit} · {item.compositionType}
      </p>
      {mode.kind === "edit" ? (
        <FormPanel kicker="Catalog" title="Edit material" onClose={() => setMode(closedMode())}>
          <MaterialForm
            initial={mode.kind === "edit" ? mode.record : undefined}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_25rem] lg:gap-10">
        <div>
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="kicker">Set contents</p>
              {canMutate && item.compositionType === "set" ? (
                <button type="button" className="btn btn-ghost" onClick={() => setSubMode({ kind: "create" })}>
                  Add part
                </button>
              ) : null}
            </div>
            {subMode.kind === "create" ? (
              <FormPanel kicker="Set" title="Add part" onClose={() => setSubMode(closedMode())}>
                <SubitemForm
                  materialId={item.id}
                  onCancel={() => setSubMode(closedMode())}
                  onDone={() => setSubMode(closedMode())}
                />
              </FormPanel>
            ) : null}
            {subMode.kind === "edit" ? (
              <FormPanel kicker="Set" title="Edit part" onClose={() => setSubMode(closedMode())}>
                <SubitemForm
                  materialId={item.id}
                  initial={subMode.record}
                  onCancel={() => setSubMode(closedMode())}
                  onDone={() => setSubMode(closedMode())}
                />
              </FormPanel>
            ) : null}
            {kits.length > 0 ? (
              <ul className="text-sm">
                {kits.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 border-b border-black/10 py-1.5">
                    <span>{s.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono">{s.quantity}</span>
                      {canMutate ? (
                        <RecordActions
                          onEdit={() => setSubMode({ kind: "edit", record: s })}
                          onDelete={() => setSubMode({ kind: "delete", record: s, label: s.name })}
                        />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-black/45">{item.compositionType === "set" ? "No parts listed." : "Not a set."}</p>
            )}

            {/* Server-computed totals off the catalog item itself — not a
                sum of the (paginated) balances list below, which only ever
                covers one page of locations. */}
            <div className="grid gap-px bg-black/10 sm:grid-cols-3">
              <div className="bg-white p-5">
                <p className="kicker">Total</p>
                <p className="mt-2 break-words text-2xl tracking-tight">{qty(item.totalQuantity, item.unit)}</p>
              </div>

              <div className="bg-white p-5">
                <p className="kicker">Total Value</p>
                <p className="mt-2 break-words text-2xl tracking-tight">{etb(item.totalValue)}</p>
              </div>
            </div>
          </div>
          <p className="kicker mb-2">Global Distribution</p>
          <TableWrap pagination={balancesData?.pagination} onPageChange={setBalPage}>
            <table className="data w-full text-left mb-10">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Qty</th>
                  <th>Avg Cost</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.locationId}>
                    <td>{b.location}</td>
                    <td className="font-mono">{qty(b.quantity, item.unit)}</td>
                    <td className="font-mono">{b.averageUnitValue ? etb(b.averageUnitValue) : "—"}</td>
                  </tr>
                ))}
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm text-black/45">
                      No stock currently distributed.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>

          <p className="kicker mb-2">Activity Ledger</p>
          <TableWrap pagination={historyData?.pagination} onPageChange={setHistPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th className="hidden sm:table-cell">From / To</th>
                  <th>Unit Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.movement.id}>
                    <td>{day(h.movement.movementDate)}</td>
                    <td>
                      <Stamp value={QUANTITY_MOVEMENT_LABELS[h.movement.movementType]} />
                    </td>
                    <td className="font-mono">{h.movement.quantity}</td>
                    <td className="hidden text-sm sm:table-cell">
                      {h.fromLabel || "—"} → {h.toLabel || "—"}
                    </td>
                    <td className="font-mono">{h.movement.unitCost ? etb(h.movement.unitCost) : "—"}</td>
                    <td>
                      {h.movement.isReversed ? (
                        <Stamp value="reversed" tone="bad" />
                      ) : h.movement.isReversal ? (
                        <Stamp value="reversal" tone="yellow" />
                      ) : (
                        <Stamp value="posted" tone="ok" />
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-sm text-black/45">
                      No activity recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </div>

        <MaterialMovementForm materialId={item.id} allowedActions={["purchase"]} title="Purchase material" />
      </div>
      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteMaterialMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDeleteMaterial}
      />
      <DeleteConfirm
        mode={subMode}
        restore={false}
        loading={removeSubItemMutation.isPending}
        onClose={() => setSubMode(closedMode())}
        onConfirm={handleRemoveSubItem}
      />
      {msg ? <p className="mt-3 text-sm text-black/70">{msg}</p> : null}
    </div>
  );
}
