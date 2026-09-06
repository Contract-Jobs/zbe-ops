"use client";

import { useParams } from "next/navigation";
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
import { isSiteManager, locationName, submitApproval, useStore } from "@/lib/store";
import { useMaterial, useMaterialSubitems, useDeleteMaterial, useDeleteSubitem } from "@/hooks/use-materials";
import type { ApprovalType, LocationKind } from "@/lib/types";
import type { MaterialCatalog, MaterialSubitem } from "@/types/api";

const actions: Array<{ type: ApprovalType; label: string }> = [
  { type: "material_purchase", label: "Purchase" },
  { type: "material_transfer", label: "Transfer" },
  { type: "material_sale", label: "Sell (warehouse only)" },
  { type: "material_consume", label: "Consume" },
  { type: "material_missing", label: "Report missing" },
];

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const manager = isSiteManager(store);
  const canMutate = !manager;
  const [type, setType] = useState<ApprovalType>("material_transfer");
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

  const { data: itemData, isLoading: itemLoading } = useMaterial(id);
  const { data: subitemsData } = useMaterialSubitems(id);
  const deleteMutation = useDeleteMaterial();
  const deleteSubMutation = useDeleteSubitem(id);

  const item = itemData?.data;
  const kits = subitemsData?.data ?? (store.subitems as unknown as MaterialSubitem[]).filter((s) => s.materialId === id);

  const bals = store.balances.filter((b) => b.catalogId === id && b.quantity !== 0);
  const logs = store.materialLogs.filter((l) => l.materialId === id);

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

  async function handleDeleteSubitem() {
    if (subMode.kind === "delete" && subMode.record) {
      try {
        await deleteSubMutation.mutateAsync(subMode.record.id);
        setSubMode(closedMode());
      } catch {
        // Handle silently
      }
    }
  }

  if (itemLoading) return <p className="p-8 text-black/50">Loading material details...</p>;
  if (!item) return <p className="p-8">Material not found.</p>;

  const submit = () => {
    try {
      const qn = Number(quantity);
      if (!qn || qn <= 0) throw new Error("Quantity required");
      if (manager && fromKind === "warehouse") throw new Error("Site managers cannot withdraw from warehouses");
      if (type === "material_sale" && fromKind !== "warehouse") throw new Error("Only warehouses can sell");
      const summary = `${actions.find((a) => a.type === type)?.label} ${qn} ${item.unit} ${item.name}`;
      submitApproval(
        type,
        {
          materialId: item.id,
          quantity: qn,
          unitPrice: unitPrice ? Number(unitPrice) : undefined,
          buyerName: buyerName || undefined,
          fromKind: fromKind || undefined,
          fromId: fromId || undefined,
          toKind: toKind || undefined,
          toId: toId || undefined,
          note: note || undefined,
        },
        summary
      );
      setMsg("Queued for approval.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
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
          <MaterialForm initial={item} onCancel={() => setMode(closedMode())} onDone={() => setMode(closedMode())} />
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
                <SubitemForm materialId={item.id} onCancel={() => setSubMode(closedMode())} onDone={() => setSubMode(closedMode())} />
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
                {bals.map((b) => (
                  <tr key={`${b.locationKind}-${b.locationId}`}>
                    <td>{locationName(b.locationKind, b.locationId, store)}</td>
                    <td className="font-mono">{qty(b.quantity, item.unit)}</td>
                  </tr>
                ))}
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
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{day(l.createdAt)}</td>
                    <td>
                      <Stamp value={l.logType} />
                    </td>
                    <td className="font-mono">{l.quantity}</td>
                    <td className="hidden text-sm sm:table-cell">
                      {locationName(l.fromKind, l.fromId, store)} → {locationName(l.toKind, l.toId, store)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>

        <aside className="border border-black/10 bg-paper/40 p-5">
          <p className="kicker mb-3">Raise a movement</p>
          <label className="mb-3 block text-sm">
            Action
            <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as ApprovalType)}>
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
          <button type="button" className="btn w-full" onClick={submit}>
            Queue for approval
          </button>
          {msg ? <p className="mt-3 text-sm">{msg}</p> : null}
        </aside>
      </div>
      <DeleteConfirm 
        mode={mode} 
        restore 
        loading={deleteMutation.isPending}
        onClose={() => setMode(closedMode())} 
        onConfirm={handleDelete}
      />
      <DeleteConfirm 
        mode={subMode} 
        restore={false} 
        loading={deleteSubMutation.isPending}
        onClose={() => setSubMode(closedMode())} 
        onConfirm={handleDeleteSubitem}
      />
    </div>
  );
}
