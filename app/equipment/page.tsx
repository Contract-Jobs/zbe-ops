"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EquipmentForm } from "@/components/forms/equipment";
import { EquipmentMovementForm } from "@/components/forms/equipment-movement";
import {
  closedMode,
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
import { isSiteManager, locationName, useStore, visibleSiteIds } from "@/lib/store";
import { useEquipmentList, useDeleteEquipment } from "@/hooks/use-equipment";
import { useLicenses } from "@/hooks/use-licenses";
import type { Equipment } from "@/types/api";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";

export default function EquipmentPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const canMutate = !manager;
  const sites = visibleSiteIds(store);
  const [q, setQ] = useState("");
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();
  const [mode, setMode] = useState<RecordMode<Equipment>>(closedMode);
  const [purchaseNew, setPurchaseNew] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);

  const { data: equipmentData, isLoading } = useEquipmentList({ page, limit: 10, search: q || undefined });
  const { data: licensesData } = useLicenses();
  const deleteMutation = useDeleteEquipment();

  const equipmentList = equipmentData ? equipmentData.data : (store.equipment as unknown as Equipment[]);
  const licensesList = licensesData ? licensesData.data : store.licenses;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return equipmentList
      .filter((e) => showDeleted || !e.deletedAt)
      .filter((e) => {
        if (!manager) return true;
        return e.siteId ? sites.has(e.siteId) : false;
      })
      .filter((e) => (equipmentData ? true : (term ? e.name.toLowerCase().includes(term) || (e.serialNumber ?? "").toLowerCase().includes(term) : true)));
  }, [manager, q, sites, equipmentList, showDeleted, equipmentData]);

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

  return (
    <div>
      <PageHead
        kicker="Plant"
        title="Equipment"
        action={canMutate ? (
          <div className="flex gap-4 items-center">
            <label className="flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show deleted
            </label>
            <div className="flex gap-2">
              <RecordActions newLabel="New equipment" onNew={() => setMode({ kind: "create" })} />
              <button className="btn" onClick={() => setPurchaseNew(true)}>Purchase New</button>
            </div>
          </div>
        ) : undefined}
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Plant" title="New equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm licenses={licensesList} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
      ) : null}
      {purchaseNew ? (
        <ModalPanel kicker="Plant" title="Purchase equipment" onClose={() => setPurchaseNew(false)}>
          <EquipmentMovementForm noBg onCancel={() => setPurchaseNew(false)} onSuccess={() => setPurchaseNew(false)} />
        </ModalPanel>
      ) : null}
      {mode.kind === "edit" ? (
        <FormPanel kicker="Plant" title="Edit equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm
            initial={mode.record}
            licenses={licensesList}
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
                      {e.name}
                    </Link>
                    {e.serialNumber ? <p className="font-mono text-[0.7rem] text-black/45">{e.serialNumber}</p> : null}
                  </td>
                  <td>
                    {e.siteId
                      ? (sitesData?.data.find((s) => s.id === e.siteId)?.name ?? locationName("site", e.siteId, store))
                      : e.warehouseId
                        ? (warehousesData?.data.find((w) => w.id === e.warehouseId)?.name ?? locationName("warehouse", e.warehouseId, store))
                        : "Off books"}
                  </td>
                  <td className="hidden font-mono text-sm sm:table-cell">{e.originalValue ? etb(Number(e.originalValue)) : "—"}</td>
                  <td className="hidden font-mono text-sm sm:table-cell">{e.value ? etb(Number(e.value)) : "—"}</td>
                  <td className="hidden md:table-cell">
                    <Stamp value={e.ownershipStatus} />
                  </td>
                  <td>
                    <Stamp value={e.currentStatus} tone={statusTone(e.currentStatus)} />
                  </td>
                  {canMutate ? (
                    <td>
                      <RecordActions
                        onEdit={() => setMode({ kind: "edit", record: e })}
                        onDelete={!e.deletedAt ? () => setMode({ kind: "delete", record: e, label: e.name }) : undefined}
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
