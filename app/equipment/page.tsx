"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EquipmentForm } from "@/components/forms/equipment";
import {
  closedMode,
  DeleteConfirm,
  FormPanel,
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

export default function EquipmentPage() {
  const store = useStore();
  const manager = isSiteManager(store);
  const canMutate = !manager;
  const sites = visibleSiteIds(store);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<RecordMode<Equipment>>(closedMode);

  const { data: equipmentData, isLoading } = useEquipmentList();
  const { data: licensesData } = useLicenses();
  const deleteMutation = useDeleteEquipment();

  const equipmentList = equipmentData ? equipmentData.data : (store.equipment as unknown as Equipment[]);
  const licensesList = licensesData ? licensesData.data : store.licenses;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return equipmentList
      .filter((e) => !e.deletedAt)
      .filter((e) => {
        if (!manager) return true;
        return e.siteId ? sites.has(e.siteId) : false;
      })
      .filter((e) => (term ? e.name.toLowerCase().includes(term) || (e.serialNumber ?? "").toLowerCase().includes(term) : true));
  }, [manager, q, sites, equipmentList]);

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
        action={canMutate ? <RecordActions newLabel="New equipment" onNew={() => setMode({ kind: "create" })} /> : undefined}
      />
      {mode.kind === "create" ? (
        <FormPanel kicker="Plant" title="New equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm licenses={licensesList} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
        </FormPanel>
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
        <TableWrap>
          <table className="data">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Where</th>
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
                      ? locationName("site", e.siteId, store)
                      : e.warehouseId
                        ? locationName("warehouse", e.warehouseId, store)
                        : "—"}
                  </td>
                  <td className="hidden font-mono text-sm sm:table-cell">{e.originalValue ? etb(Number(e.originalValue)) : "—"}</td>
                  <td className="hidden md:table-cell">
                    <Stamp value={e.ownershipStatus} />
                  </td>
                  <td>
                    <Stamp value={e.status} tone={statusTone(e.status)} />
                  </td>
                  {canMutate ? (
                    <td>
                      <RecordActions
                        onEdit={() => setMode({ kind: "edit", record: e })}
                        onDelete={() => setMode({ kind: "delete", record: e, label: e.name })}
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
