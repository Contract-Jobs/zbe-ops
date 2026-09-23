"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EquipmentForm } from "@/components/forms/equipment";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import {
  closedMode,
  ConfirmDialog,
  DeleteConfirm,
  FormPanel,
  ModalPanel,
  PageHead,
  RecordActions,
  Stamp,
  TableWrap,
  statusTone,
  type RecordMode,
} from "@/components/ui";
import { etb } from "@/lib/format";
import { currentUser, isSiteManager, useStore } from "@/lib/store";
import { useEquipmentList, useDeleteEquipment, useRestoreEquipment, useRebuildEquipmentStates } from "@/hooks/use-equipment";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import { useInventoryNodeMap } from "@/hooks/use-inventories";
import { BulkEquipmentMovementForm } from "@/components/forms/bulk-equipment-movement";
import type { IndividualEquipmentItem } from "@/types/api";

export default function EquipmentPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const canMutate = !manager;
  const isSuperadmin = currentUser(store).role === "superadmin";
  const [q, setQ] = useState("");
  const { byId: nodeById } = useInventoryNodeMap();
  // No itemId→name join on the equipment list response, and no
  // batch-by-ids lookup — pull the whole equipment catalog once instead of
  // defaulting to the endpoint's page size of 10 (was silently truncating
  // this map on any catalog bigger than that).
  const { data: eqItemsData } = useInventoryItems({ category: "equipment", limit: 50 });
  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const it of eqItemsData?.data ?? []) map.set(it.id, it.name);
    return map;
  }, [eqItemsData]);
  const [mode, setMode] = useState<RecordMode<IndividualEquipmentItem>>(closedMode);
  const [purchaseNew, setPurchaseNew] = useState(false);
  const [purchaseBulkNew, setPurchaseBulkNew] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);

  const { data: equipmentData, isLoading } = useEquipmentList({ page, limit: 10, search: q || undefined });
  const deleteMutation = useDeleteEquipment();
  const restoreMutation = useRestoreEquipment();
  const rebuildStatesMutation = useRebuildEquipmentStates();
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const equipmentList = equipmentData ? equipmentData.data : [];

  const rows = useMemo(() => {
    return equipmentList.filter((e) => showDeleted || !e.deletedAt);
  }, [equipmentList, showDeleted]);

  // Bulk (quantity-tracked) equipment — the catalog side, same "Total"
  // aggregate InventoryItem already carries (Round 2), no extra fetch.
  const bulkEquipmentItems = eqItemsData?.data.filter((it) => it.tracking === "quantity") ?? [];

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

  async function handleRebuildStates() {
    setRebuildMsg(null);
    try {
      const res = await rebuildStatesMutation.mutateAsync();
      setRebuildMsg(`Rebuilt ${res.data.rebuilt} equipment state(s).${res.data.errors.length ? ` ${res.data.errors.length} error(s).` : ""}`);
    } catch (e) {
      setRebuildMsg(e instanceof Error ? e.message : "Failed to rebuild equipment states");
    } finally {
      setConfirmRebuild(false);
    }
  }

  return (
    <div>
      <PageHead
        kicker="Plant"
        title="Equipment"
        action={
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/equipment/movements" className="btn btn-ghost">
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
                  {isSuperadmin ? (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setConfirmRebuild(true)}
                      disabled={rebuildStatesMutation.isPending}
                    >
                      {rebuildStatesMutation.isPending ? "Rebuilding..." : "Rebuild states"}
                    </button>
                  ) : null}
                  <button className="btn" onClick={() => setPurchaseNew(true)}>Purchase New</button>
                </div>
              </>
            ) : null}
          </div>
        }
      />
      {rebuildMsg ? <p className="mb-4 text-sm text-black/60">{rebuildMsg}</p> : null}
      {purchaseNew ? (
        <ModalPanel kicker="Plant" title="Purchase equipment" onClose={() => setPurchaseNew(false)}>
          <EquipmentMovementForm noBg onCancel={() => setPurchaseNew(false)} onSuccess={() => setPurchaseNew(false)} />
        </ModalPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Plant" title="Edit equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm
            initial={mode.record}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <input
        className="field mb-5 w-full max-w-sm"
        placeholder="Search name or serial"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {isLoading && !equipmentData ? (
        <div className="p-8 text-center text-sm text-black/50">Loading equipment...</div>
      ) : (
        <TableWrap pagination={equipmentData?.pagination} onPageChange={setPage}>
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Where</th>
                <th className="hidden sm:table-cell">Original Value</th>
                <th className="hidden sm:table-cell">Value</th>
                <th className="hidden md:table-cell">Ownership</th>
                <th>Status</th>
                {canMutate ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/equipment/${e.id}`} className="font-medium hover:text-yellow">
                      {itemNameById.get(e.itemId) ?? e.identifier}
                    </Link>
                    <p className="font-mono text-[0.7rem] text-black/45">{e.identifier}</p>
                  </td>
                  <td>{e.currentInventoryId ? (nodeById.get(e.currentInventoryId)?.name ?? "Unknown") : "Off books"}</td>
                  <td className="hidden font-mono text-sm sm:table-cell">{etb(Number(e.originalValue))}</td>
                  <td className="hidden font-mono text-sm sm:table-cell">{e.bookValue ? etb(Number(e.bookValue)) : "—"}</td>
                  <td className="hidden md:table-cell">
                    <Stamp value={e.lifecycleStatus} />
                  </td>
                  <td>
                    <Stamp value={e.assignmentStatus} tone={statusTone(e.assignmentStatus)} />
                  </td>
                  {canMutate ? (
                    <td>
                      <RecordActions
                        onEdit={!e.deletedAt ? () => setMode({ kind: "edit", record: e }) : undefined}
                        onDelete={!e.deletedAt ? () => setMode({ kind: "delete", record: e, label: e.identifier }) : undefined}
                        onRestore={e.deletedAt ? () => handleRestore(e.id) : undefined}
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

      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="kicker">Bulk Equipment</p>
          {canMutate && (
            <button className="btn btn-ghost" onClick={() => setPurchaseBulkNew(true)}>Purchase Bulk Equipment</button>
          )}
        </div>
        {bulkEquipmentItems.length > 0 ? (
          // No server pagination for this list (it's the full catalog pull
          // already on the page) — TableWrap's `data` prop slices it
          // client-side instead, same "Showing X-Y of Z" + Prev/Next as
          // every server-paginated table elsewhere.
          <TableWrap data={bulkEquipmentItems}>
            {(pageRows) => (
              <table className="data w-full text-left">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((it) => (
                    <tr key={it.id}>
                      <td>
                        {/* Reuses the item-detail page — it's generic over any
                            quantity-tracked item (balances/history/purchase by
                            itemId), not material-specific despite the route name. */}
                        <Link href={`/materials/${it.id}`} className="font-medium hover:text-yellow">
                          {it.name}
                        </Link>
                      </td>
                      <td className="font-mono text-sm">{it.totalQuantity} {it.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableWrap>
        ) : (
          <div className="border border-dashed border-black/20 p-8 text-center text-sm text-black/40">
            No bulk equipment in the catalog yet.
          </div>
        )}
      </div>

      {purchaseBulkNew ? (
        <ModalPanel kicker="Plant" title="Purchase Bulk Equipment" onClose={() => setPurchaseBulkNew(false)}>
          <BulkEquipmentMovementForm noBg onCancel={() => setPurchaseBulkNew(false)} onSuccess={() => setPurchaseBulkNew(false)} />
        </ModalPanel>
      ) : null}

      <DeleteConfirm
        mode={mode}
        restore
        loading={deleteMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={confirmRebuild}
        title="Rebuild all equipment states?"
        body="Recomputes every piece of equipment's projected state from its movement ledger from scratch. Heavy — a recovery tool, not routine maintenance."
        confirmLabel="Rebuild"
        danger
        loading={rebuildStatesMutation.isPending}
        onCancel={() => setConfirmRebuild(false)}
        onConfirm={handleRebuildStates}
      />
    </div>
  );
}
