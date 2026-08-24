"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";
import { PageHead, Stamp, TableWrap } from "@/components/ui";
import { day, qty } from "@/lib/format";
import { isSiteManager, locationName, submitApproval, useStore } from "@/lib/store";
import type { ApprovalType, LocationKind } from "@/lib/types";

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
  const item = store.materials.find((m) => m.id === id);
  const manager = isSiteManager(store);
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

  if (!item) return <p>Material not found.</p>;

  const bals = store.balances.filter((b) => b.catalogId === item.id && b.quantity !== 0);
  const logs = store.materialLogs.filter((l) => l.materialId === item.id);
  const kits = store.subitems.filter((s) => s.materialId === item.id);

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
      <PageHead kicker="Catalog" title={item.name} />
      <p className="mb-6 font-mono text-sm text-black/50">
        {item.unit} · {item.type}
      </p>
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10">
      <div>
        {kits.length > 0 ? (
          <div className="mb-8">
            <p className="kicker mb-2">Set contents</p>
            <ul className="text-sm">
              {kits.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-black/10 py-1.5">
                  <span>{s.name}</span>
                  <span className="font-mono">{s.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
    </div>
  );
}
