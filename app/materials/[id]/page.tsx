"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialForm, SubitemForm } from "@/components/forms/material";
import { LocationSelect } from "@/components/LocationSelect";
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
import { isSiteManager, locationName, useStore } from "@/lib/store";
import {
  useMaterial,
  useDeleteMaterial,
  useSubItems,
  useRemoveSubItem,
  useMaterialLogs,
  usePurchaseMaterial,
  useTransferMaterial,
  useSellMaterial,
  useConsumeMaterial,
  useReportMissingMaterial,
} from "@/hooks/use-materials";
import { useInventoryBalances, useMaterialTrace } from "@/hooks/use-inventory";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import type { LocationKind } from "@/lib/types";
import type { MaterialCatalog, MaterialLog, MaterialSubitem, InventoryBalance } from "@/types/api";

import { MaterialMovementForm } from "@/components/forms/material-movement";

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const { data: materialData, isLoading: isMaterialLoading } = useMaterial(id);
  const { data: subItemsData } = useSubItems(id);
  const { data: traceData, isLoading: isTraceLoading } = useMaterialTrace(id);
  const [balPage, setBalPage] = useState(1);
  const { data: balancesData } = useInventoryBalances({ materialId: id ? [id] : undefined, page: balPage, limit: 10 });
  const [logPage, setLogPage] = useState(1);
  const { data: logsData } = useMaterialLogs({ materialId: id, page: logPage, limit: 10 });
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();
  const { data: matTrace } = useMaterialTrace(id)
  const totalCount = matTrace?.data ? matTrace.data.currentBalances.map(cb => cb.quantity).reduce((prev, curr) => curr + prev, 0) : 0;
  const averagePrice = matTrace?.data ? (matTrace.data.currentBalances.map(cb => cb.avgUnitPrice).reduce((prev, curr) => (curr || 0) + (prev || 0), 0) || 0) / (matTrace.data.currentBalances?.length || 1) : 0

  console.log(totalCount, averagePrice, matTrace?.data.currentBalances.map(cb => cb.avgUnitPrice).reduce((prev, curr) => (curr || 0) + (prev || 0), 0))
  const deleteMaterialMutation = useDeleteMaterial();
  const removeSubItemMutation = useRemoveSubItem(id || "");



  const item = materialData?.data ?? (store.materials.find((m) => m.id === id) as unknown as MaterialCatalog | undefined);
  const manager = isSiteManager(store);
  const canMutate = !manager;


  const [mode, setMode] = useState<RecordMode<MaterialCatalog>>(closedMode);
  const [subMode, setSubMode] = useState<RecordMode<MaterialSubitem>>(closedMode);
  const [msg, setMsg] = useState<string | null>(null);

  if (isMaterialLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading material...</p>;
  }

  if (!item) return <p>Material not found.</p>;

  const traceBalances = traceData?.data?.currentBalances;
  const traceHistory = traceData?.data?.history;

  const bals: InventoryBalance[] = balancesData?.data ??
    (store.balances.filter((b) => b.catalogId === item.id && b.quantity !== 0) as unknown as InventoryBalance[]);
  const logs: MaterialLog[] = logsData?.data ??
    (store.materialLogs.filter((l) => l.materialId === item.id) as unknown as MaterialLog[]);
  const kits: MaterialSubitem[] = subItemsData?.data ??
    (store.subitems.filter((s) => s.materialId === item.id) as unknown as MaterialSubitem[]);

  const getLocationName = (kind?: "site" | "warehouse" | LocationKind, locId?: string | null) => {
    if (!locId) return "—";
    if (kind === "site" || (!kind && sitesData?.data.some((s) => s.id === locId))) {
      return sitesData?.data.find((s) => s.id === locId)?.name ?? locationName("site", locId, store);
    }
    return warehousesData?.data.find((w) => w.id === locId)?.name ?? locationName("warehouse", locId, store);
  };



  const handleDeleteMaterial = async () => {
    if (mode.kind === "delete" && mode.record) {
      try {
        if (materialData) {
          await deleteMaterialMutation.mutateAsync(mode.record.id);
        }
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
        if (subItemsData) {
          await removeSubItemMutation.mutateAsync(subMode.record.id);
        }
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
        {item.unit} · {item.type}
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
              {canMutate && item.type === "set" ? (
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
              <p className="text-sm text-black/45">{item.type === "set" ? "No parts listed." : "Not a set."}</p>
            )}

            {matTrace?.data && <div className="grid gap-px bg-black/10 sm:grid-cols-3">
              <div className="bg-white p-5">
                <p className="kicker">Total</p>
                <p className="mt-2 break-words text-2xl tracking-tight">{qty(totalCount, materialData?.data.unit)}</p>
              </div>

              <div className="bg-white p-5">
                <p className="kicker">Total Value</p>
                <p className="mt-2 break-words text-2xl tracking-tight">{etb(averagePrice * totalCount)}</p>
              </div>
            </div>
            }
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
                {traceBalances ? (
                  traceBalances.map((b, i) => (
                    <tr key={i}>
                      <td>{b.location}</td>
                      <td className="font-mono">{qty(b.quantity, item.unit)}</td>
                      <td className="font-mono">{b.avgUnitPrice ? etb(b.avgUnitPrice) : "—"}</td>
                    </tr>
                  ))
                ) : (
                  bals.map((b) => {
                    const locationKind = (b as unknown as { locationKind?: LocationKind }).locationKind ??
                      (b.siteId ? "site" : "warehouse");
                    const locationId = (b as unknown as { locationId?: string }).locationId ?? (b.siteId || b.warehouseId);
                    return (
                      <tr key={`${b.id ?? locationId}`}>
                        <td>{getLocationName(locationKind, locationId)}</td>
                        <td className="font-mono">{qty(b.quantity, item.unit)}</td>
                        <td className="font-mono">—</td>
                      </tr>
                    );
                  })
                )}
                {(traceBalances ? traceBalances.length === 0 : bals.length === 0) ? (
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
          <TableWrap pagination={logsData?.pagination} onPageChange={setLogPage}>
            <table className="data w-full text-left">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th className="hidden sm:table-cell">From / To</th>
                  <th>Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {traceHistory ? (
                  traceHistory.map((h, i) => (
                    <tr key={i}>
                      <td>{day(h.log.timestamp)}</td>
                      <td>
                        <Stamp value={h.log.logType} />
                      </td>
                      <td className="font-mono">{h.log.quantity}</td>
                      <td className="hidden text-sm sm:table-cell">
                        {h.fromLabel || "—"} → {h.toLabel || "—"}
                      </td>
                      <td className="font-mono">{(h.log as any).unitPrice ? etb((h.log as any).unitPrice) : "—"}</td>
                    </tr>
                  ))
                ) : (
                  logs.map((l) => {
                    const fromId = l.fromSiteId ?? l.fromWarehouseId ?? (l as unknown as { fromId?: string }).fromId;
                    const fromKind = l.fromSiteId ? "site" : l.fromWarehouseId ? "warehouse" : (l as unknown as { fromKind?: LocationKind }).fromKind;
                    const toId = l.toSiteId ?? l.toWarehouseId ?? (l as unknown as { toId?: string }).toId;
                    const toKind = l.toSiteId ? "site" : l.toWarehouseId ? "warehouse" : (l as unknown as { toKind?: LocationKind }).toKind;

                    return (
                      <tr key={l.id}>
                        <td>{day(l.timestamp ?? l.createdAt)}</td>
                        <td>
                          <Stamp value={l.logType} />
                        </td>
                        <td className="font-mono">{l.quantity}</td>
                        <td className="hidden text-sm sm:table-cell">
                          {getLocationName(fromKind, fromId)} → {getLocationName(toKind, toId)}
                        </td>
                        <td className="font-mono">{(l as any).purchaseCost ? etb((l as any).purchaseCost) : "—"}</td>
                      </tr>
                    );
                  })
                )}
                {(traceHistory ? traceHistory.length === 0 : logs.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-black/45">
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
    </div>
  );
}

