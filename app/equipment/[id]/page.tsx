"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { EquipmentForm } from "@/components/forms/equipment";
import { LocationSelect } from "@/components/LocationSelect";
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
import { day, etb } from "@/lib/format";
import { isSiteManager, locationName, submitApproval, useStore } from "@/lib/store";
import type { ApprovalType, Equipment, LocationKind } from "@/lib/types";

const actions: Array<{ type: ApprovalType; label: string }> = [
  { type: "equipment_purchase", label: "Purchase" },
  { type: "equipment_transfer", label: "Transfer" },
  { type: "equipment_rent_in", label: "Rent in" },
  { type: "equipment_return_in", label: "Return rented-in" },
  { type: "equipment_rent_out", label: "Rent out" },
  { type: "equipment_return_out", label: "Return rented-out" },
  { type: "equipment_sale", label: "Sell" },
  { type: "equipment_degrade", label: "Write down value" },
  { type: "equipment_appreciate", label: "Write up value" },
  { type: "equipment_maintenance_dispatch", label: "Send to shop" },
  { type: "equipment_maintenance_return", label: "Return from shop" },
  { type: "equipment_consume", label: "Dispose" },
  { type: "equipment_missing", label: "Report missing" },
];

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const store = useStore();
  const item = store.equipment.find((e) => e.id === id);
  const canMutate = !isSiteManager(store);
  const [type, setType] = useState<ApprovalType>("equipment_transfer");
  const [price, setPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [toKind, setToKind] = useState<LocationKind | "">("");
  const [toId, setToId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<RecordMode<Equipment>>(closedMode);

  if (!item) return <p>Equipment not found.</p>;

  const logs = store.equipmentLogs.filter((l) => l.equipmentId === item.id);
  const here = item.siteId
    ? locationName("site", item.siteId, store)
    : item.warehouseId
      ? locationName("warehouse", item.warehouseId, store)
      : "Off books";

  const submit = () => {
    try {
      if (item.isOnLoan && (type === "equipment_rent_in" || type === "equipment_rent_out")) {
        throw new Error("Already on loan");
      }
      submitApproval(
        type,
        {
          equipmentId: item.id,
          price: price ? Number(price) : undefined,
          buyerName: buyerName || undefined,
          vendorName: vendorName || undefined,
          toKind: toKind || undefined,
          toId: toId || undefined,
          fromKind: item.siteId ? "site" : item.warehouseId ? "warehouse" : undefined,
          fromId: item.siteId ?? item.warehouseId,
        },
        `${actions.find((a) => a.type === type)?.label} · ${item.name}`
      );
      setMsg("Queued for approval.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div>
      <PageHead
        kicker="Asset"
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
      {mode.kind === "edit" ? (
        <FormPanel kicker="Asset" title="Edit equipment" onClose={() => setMode(closedMode())}>
          <EquipmentForm
            initial={item}
            licenses={store.licenses}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10">
        <div>
          <div className="mb-8 flex flex-wrap gap-2">
            <Stamp value={item.status} tone={statusTone(item.status)} />
            <Stamp value={item.ownershipStatus} />
            {item.isOnLoan ? <Stamp value="on loan" tone="yellow" /> : null}
          </div>
          <dl className="mb-10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="kicker">Serial</dt>
              <dd className="mt-1 font-mono">{item.serialNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="kicker">Book value</dt>
              <dd className="mt-1 font-mono">{etb(item.value)}</dd>
            </div>
            <div>
              <dt className="kicker">Location</dt>
              <dd className="mt-1">{here}</dd>
            </div>
            <div>
              <dt className="kicker">Rent rate</dt>
              <dd className="mt-1 font-mono">{item.rentRate ? `${etb(item.rentRate)} / day` : "—"}</dd>
            </div>
          </dl>
          <p className="kicker mb-2">Event log</p>
          <TableWrap>
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{day(l.createdAt)}</td>
                    <td>
                      <Stamp value={l.logType} />
                    </td>
                    <td className="font-mono text-sm">{l.price ? etb(l.price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <aside className="border border-black/10 bg-paper/40 p-5">
          <p className="kicker mb-3">Raise an event</p>
          <select className="field mb-3" value={type} onChange={(e) => setType(e.target.value as ApprovalType)}>
            {actions.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
          <label className="mb-3 block text-sm">
            Price / rate / repair (ETB)
            <input className="field mt-1" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="mb-3 block text-sm">
            Buyer
            <input className="field mt-1" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
          </label>
          <label className="mb-3 block text-sm">
            Vendor
            <input className="field mt-1" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
          </label>
          <p className="mb-1 text-sm">Destination</p>
          <LocationSelect kind={toKind} id={toId} onKind={setToKind} onId={setToId} />
          <button type="button" className="btn mt-4 w-full" onClick={submit}>
            Queue for approval
          </button>
          {msg ? <p className="mt-3 text-sm">{msg}</p> : null}
        </aside>
      </div>
      <DeleteConfirm mode={mode} restore onClose={() => setMode(closedMode())} />
    </div>
  );
}
