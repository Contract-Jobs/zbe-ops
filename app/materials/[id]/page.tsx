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
import { day, qty } from "@/lib/format";
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
import { useInventoryBalances } from "@/hooks/use-inventory";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import type { LocationKind } from "@/lib/types";
import type { MaterialCatalog, MaterialLog, MaterialSubitem, InventoryBalance } from "@/types/api";

type MaterialActionKind = "material_purchase" | "material_transfer" | "material_sale" | "material_consume" | "material_missing";

const actions: Array<{ type: MaterialActionKind; label: string }> = [
  { type: "material_purchase", label: "Purchase" },
  { type: "material_transfer", label: "Transfer" },
  { type: "material_sale", label: "Sell (warehouse only)" },
  { type: "material_consume", label: "Consume" },
  { type: "material_missing", label: "Report missing" },
];

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const store = useStore();

  const { data: materialData, isLoading: isMaterialLoading } = useMaterial(id);
  const { data: subItemsData } = useSubItems(id);
  const { data: balancesData } = useInventoryBalances({ materialId: id ? [id] : undefined });
  const { data: logsData } = useMaterialLogs({ materialId: id });
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();

  const deleteMaterialMutation = useDeleteMaterial();
  const removeSubItemMutation = useRemoveSubItem(id || "");

  const purchaseMutation = usePurchaseMaterial();
  const transferMutation = useTransferMaterial();
  const sellMutation = useSellMaterial();
  const consumeMutation = useConsumeMaterial();
  const reportMissingMutation = useReportMissingMaterial();

  const item = materialData?.data ?? (store.materials.find((m) => m.id === id) as unknown as MaterialCatalog | undefined);
  const manager = isSiteManager(store);
  const canMutate = !manager;

  const [type, setType] = useState<MaterialActionKind>("material_transfer");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [fromKind, setFromKind] = useState<LocationKind | "">("");
  const [fromId, setFromId] = useState("");
  const [toKind, setToKind] = useState<LocationKind | "">("");
  const [toId, setToId] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<RecordMode<MaterialCatalog>>(closedMode);
  const [subMode, setSubMode] = useState<RecordMode<MaterialSubitem>>(closedMode);

  if (isMaterialLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading material...</p>;
  }

  if (!item) return <p>Material not found.</p>;

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

  const isActionPending =
    purchaseMutation.isPending ||
    transferMutation.isPending ||
    sellMutation.isPending ||
    consumeMutation.isPending ||
    reportMissingMutation.isPending;

  const submit = async () => {
    setMsg(null);
    try {
      const qn = Number(quantity);
      if (!qn || qn <= 0) throw new Error("Quantity required");
      if (manager && fromKind === "warehouse") throw new Error("Site managers cannot withdraw from warehouses");
      if (type === "material_sale" && fromKind !== "warehouse") throw new Error("Only warehouses can sell");

      const source = fromKind && fromId ? { id: fromId, type: fromKind as "site" | "warehouse" } : undefined;
      const destination = toKind && toId ? { id: toId, type: toKind as "site" | "warehouse" } : undefined;

      if (type === "material_purchase") {
        await purchaseMutation.mutateAsync({
          materialId: item.id,
          quantity: qn,
          purchaseCost: unitPrice ? String(Number(unitPrice) * qn) : "0",
          destination,
          notes: note || undefined,
        });
      } else if (type === "material_transfer") {
        await transferMutation.mutateAsync({
          materialId: item.id,
          quantity: qn,
          source,
          destination,
          notes: note || undefined,
        });
      } else if (type === "material_sale") {
        await sellMutation.mutateAsync({
          materialId: item.id,
          quantity: qn,
          sellingPrice: unitPrice ? String(Number(unitPrice) * qn) : "0",
          source,
          buyerName: buyerName || undefined,
          notes: note || undefined,
        });
      } else if (type === "material_consume") {
        await consumeMutation.mutateAsync({
          materialId: item.id,
          quantity: qn,
          source,
          notes: note || undefined,
        });
      } else if (type === "material_missing") {
        await reportMissingMutation.mutateAsync({
          materialId: item.id,
          quantity: qn,
          source,
          notes: note || undefined,
        });
      }

      setMsg("Queued for approval.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
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
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10">
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
          </div>
          <p className="kicker mb-2">Balances</p>
          <TableWrap>
            <table className="data mb-10">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Qty</th>
                </tr>
              </thead>
              <tbody>
                {bals.map((b) => {
                  const locationKind = (b as unknown as { locationKind?: LocationKind }).locationKind ??
                    (b.siteId ? "site" : "warehouse");
                  const locationId = (b as unknown as { locationId?: string }).locationId ?? (b.siteId || b.warehouseId);
                  return (
                    <tr key={`${b.id ?? locationId}`}>
                      <td>{getLocationName(locationKind, locationId)}</td>
                      <td className="font-mono">{qty(b.quantity, item.unit)}</td>
                    </tr>
                  );
                })}
                {bals.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-sm text-black/45">
                      No inventory balances found for this material.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
          <p className="kicker mb-2">Movement log</p>
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th className="hidden sm:table-cell">From / to</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const fromId = l.fromSiteId ?? l.fromWarehouseId ?? (l as unknown as { fromId?: string }).fromId;
                  const fromKind = l.fromSiteId ? "site" : l.fromWarehouseId ? "warehouse" : (l as unknown as { fromKind?: LocationKind }).fromKind;
                  const toId = l.toSiteId ?? l.toWarehouseId ?? (l as unknown as { toId?: string }).toId;
                  const toKind = l.toSiteId ? "site" : l.toWarehouseId ? "warehouse" : (l as unknown as { toKind?: LocationKind }).toKind;

                  return (
                    <tr key={l.id}>
                      <td>{day(l.createdAt)}</td>
                      <td>
                        <Stamp value={l.logType} />
                      </td>
                      <td className="font-mono">{l.quantity}</td>
                      <td className="hidden text-sm sm:table-cell">
                        {getLocationName(fromKind, fromId)} → {getLocationName(toKind, toId)}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-sm text-black/45">
                      No movements recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </TableWrap>
        </div>

        <aside className="border border-black/10 bg-paper/40 p-5">
          <p className="kicker mb-3">Raise a movement</p>
          <label className="mb-3 block text-sm">
            Action
            <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as MaterialActionKind)}>
              {actions.map((a) => (
                <option key={a.type} value={a.type}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block text-sm">
            Quantity
            <input className="field mt-1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          {type === "material_purchase" || type === "material_sale" ? (
            <label className="mb-3 block text-sm">
              Unit price (ETB)
              <input className="field mt-1" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
            </label>
          ) : null}
          {type === "material_sale" ? (
            <label className="mb-3 block text-sm">
              Buyer
              <input className="field mt-1" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </label>
          ) : null}
          {type !== "material_purchase" ? (
            <div className="mb-3">
              <p className="mb-1 text-sm">From</p>
              <LocationSelect
                kind={fromKind}
                id={fromId}
                onKind={setFromKind}
                onId={setFromId}
                allowWarehouse={!manager}
              />
            </div>
          ) : null}
          {type === "material_purchase" || type === "material_transfer" ? (
            <div className="mb-3">
              <p className="mb-1 text-sm">To</p>
              <LocationSelect kind={toKind} id={toId} onKind={setToKind} onId={setToId} />
            </div>
          ) : null}
          <label className="mb-3 block text-sm">
            Note
            <input className="field mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn w-full"
            disabled={isActionPending}
            onClick={submit}
          >
            {isActionPending ? "Queueing..." : "Queue for approval"}
          </button>
          {msg ? <p className="mt-3 text-sm">{msg}</p> : null}
        </aside>
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

