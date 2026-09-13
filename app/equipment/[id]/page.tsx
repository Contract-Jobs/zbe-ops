"use client";

import { useParams, useRouter } from "next/navigation";
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
import {
  useEquipment,
  useDeleteEquipment,
  useEquipmentLogs,
  useTransferEquipment,
  useSellEquipment,
  useConsumeEquipment,
  useReportMissingEquipment,
  useMaintenanceDispatch,
  useMaintenanceReturn,
  useDegradeEquipment,
  useAppreciateEquipment,
} from "@/hooks/use-equipment";
import { useLicenses } from "@/hooks/use-licenses";
import { useSites } from "@/hooks/use-sites";
import { useWarehouses } from "@/hooks/use-warehouses";
import type { ApprovalType, LocationKind } from "@/lib/types";
import type { Equipment, EquipmentLog, License } from "@/types/api";

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
  const router = useRouter();
  const store = useStore();

  const { data: equipData, isLoading: isEquipLoading } = useEquipment(id);
  const { data: logsData } = useEquipmentLogs({ equipmentId: id });
  const { data: licensesData } = useLicenses();
  const { data: sitesData } = useSites();
  const { data: warehousesData } = useWarehouses();

  const deleteEquipmentMutation = useDeleteEquipment();
  const transferMutation = useTransferEquipment();
  const sellMutation = useSellEquipment();
  const consumeMutation = useConsumeEquipment();
  const reportMissingMutation = useReportMissingEquipment();
  const maintenanceDispatchMutation = useMaintenanceDispatch();
  const maintenanceReturnMutation = useMaintenanceReturn();
  const degradeMutation = useDegradeEquipment();
  const appreciateMutation = useAppreciateEquipment();

  const item = equipData?.data ?? (store.equipment.find((e) => e.id === id) as unknown as Equipment | undefined);
  const canMutate = !isSiteManager(store);

  const [type, setType] = useState<ApprovalType>("equipment_transfer");
  const [price, setPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [toKind, setToKind] = useState<LocationKind | "">("");
  const [toId, setToId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<RecordMode<Equipment>>(closedMode);

  if (isEquipLoading && !item) {
    return <p className="p-8 text-center text-sm text-black/50">Loading equipment...</p>;
  }

  if (!item) return <p>Equipment not found.</p>;

  const logs: EquipmentLog[] = logsData?.data ??
    (store.equipmentLogs.filter((l) => l.equipmentId === item.id) as unknown as EquipmentLog[]);
  const licenses: License[] = licensesData?.data ?? (store.licenses as unknown as License[]);

  const here = item.siteId
    ? (sitesData?.data.find((s) => s.id === item.siteId)?.name ?? locationName("site", item.siteId, store))
    : item.warehouseId
      ? (warehousesData?.data.find((w) => w.id === item.warehouseId)?.name ?? locationName("warehouse", item.warehouseId, store))
      : "Off books";

  const status = item.currentStatus ?? (item as unknown as { status: string }).status;
  const ownership = item.ownershipStatus;
  const value = item.value ?? item.originalValue;
  const rentRate = item.rentRate;
  const isOnLoan = (item as unknown as { isOnLoan?: boolean }).isOnLoan;

  const isActionPending =
    transferMutation.isPending ||
    sellMutation.isPending ||
    consumeMutation.isPending ||
    reportMissingMutation.isPending ||
    maintenanceDispatchMutation.isPending ||
    maintenanceReturnMutation.isPending ||
    degradeMutation.isPending ||
    appreciateMutation.isPending;

  const submit = async () => {
    setMsg(null);
    try {
      if (isOnLoan && (type === "equipment_rent_in" || type === "equipment_rent_out")) {
        throw new Error("Already on loan");
      }

      const source = item.siteId
        ? { id: item.siteId, type: "site" as const }
        : item.warehouseId
          ? { id: item.warehouseId, type: "warehouse" as const }
          : undefined;
      const destination = toKind && toId ? { id: toId, type: toKind as "site" | "warehouse" } : undefined;

      if (type === "equipment_transfer") {
        await transferMutation.mutateAsync({
          equipmentId: item.id,
          source,
          destination,
          notes: `Transfer to ${destination?.type ?? ""} ${destination?.id ?? ""}`,
        });
      } else if (type === "equipment_sale") {
        await sellMutation.mutateAsync({
          equipmentId: item.id,
          sellingPrice: price || "0",
          source,
          buyerName: buyerName || undefined,
        });
      } else if (type === "equipment_maintenance_dispatch") {
        await maintenanceDispatchMutation.mutateAsync({
          equipmentId: item.id,
          source,
          vendorName: vendorName || undefined,
        });
      } else if (type === "equipment_maintenance_return") {
        await maintenanceReturnMutation.mutateAsync({
          equipmentId: item.id,
          destination,
          repairCost: price || undefined,
        });
      } else if (type === "equipment_degrade") {
        await degradeMutation.mutateAsync({
          equipmentId: item.id,
          valueAdjustment: price || undefined,
        });
      } else if (type === "equipment_appreciate") {
        await appreciateMutation.mutateAsync({
          equipmentId: item.id,
          valueAdjustment: price || undefined,
        });
      } else if (type === "equipment_consume") {
        await consumeMutation.mutateAsync({
          equipmentId: item.id,
          source,
        });
      } else if (type === "equipment_missing") {
        await reportMissingMutation.mutateAsync({
          equipmentId: item.id,
          source,
        });
      } else {
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
            fromId: item.siteId ?? item.warehouseId ?? undefined,
          },
          `${actions.find((a) => a.type === type)?.label} · ${item.name}`
        );
      }

      setMsg("Queued for approval.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDeleteEquipment = async () => {
    if (mode.kind === "delete" && mode.record) {
      try {
        if (equipData) {
          await deleteEquipmentMutation.mutateAsync(mode.record.id);
        }
        setMode(closedMode());
        router.push("/equipment");
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Failed to delete");
      }
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
            initial={mode.kind === "edit" ? mode.record : undefined}
            licenses={licenses}
            onCancel={() => setMode(closedMode())}
            onDone={() => setMode(closedMode())}
          />
        </FormPanel>
      ) : null}
      <div className="flex flex-col-reverse gap-8 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-10">
        <div>
          <div className="mb-8 flex flex-wrap gap-2">
            <Stamp value={status} tone={statusTone(status)} />
            <Stamp value={ownership} />
            {isOnLoan ? <Stamp value="on loan" tone="yellow" /> : null}
          </div>
          <dl className="mb-10 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="kicker">Serial</dt>
              <dd className="mt-1 font-mono">{item.serialNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="kicker">Book value</dt>
              <dd className="mt-1 font-mono">{etb(Number(value) || 0)}</dd>
            </div>
            <div>
              <dt className="kicker">Location</dt>
              <dd className="mt-1">{here}</dd>
            </div>
            <div>
              <dt className="kicker">Rent rate</dt>
              <dd className="mt-1 font-mono">{rentRate ? `${etb(Number(rentRate) || 0)} / day` : "—"}</dd>
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
                    <td>{day(l.timestamp ?? l.createdAt)}</td>
                    <td>
                      <Stamp value={l.logType} />
                    </td>
                    <td className="font-mono text-sm">{l.price ? etb(Number(l.price) || 0) : "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm text-black/45">
                      No event log entries found.
                    </td>
                  </tr>
                ) : null}
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
          <button
            type="button"
            className="btn mt-4 w-full"
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
        loading={deleteEquipmentMutation.isPending}
        onClose={() => setMode(closedMode())}
        onConfirm={handleDeleteEquipment}
      />
    </div>
  );
}

