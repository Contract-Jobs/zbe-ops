"use client";

import { useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";
import { isSiteManager, useStore } from "@/lib/store";
import {
  usePurchaseEquipment,
  useTransferEquipment,
  useSellEquipment,
  useConsumeEquipment,
  useReportMissingEquipment,
  useMaintenanceDispatch,
  useMaintenanceReturn,
  useDegradeEquipment,
  useAppreciateEquipment,
  useEquipmentList,
} from "@/hooks/use-equipment";
import { useLicenses } from "@/hooks/use-licenses";
import type { LocationKind } from "@/lib/types";
import { SearchableSelect } from "@/components/ui";
import type { EquipmentLogAction } from "@/types/api";

type ActionType = EquipmentLogAction["action"];

const actions: Array<{ type: ActionType; label: string }> = [
  { type: "purchased", label: "Purchase" },
  { type: "transferred", label: "Transfer" },
  { type: "sold", label: "Sell" },
  { type: "degraded", label: "Write down value" },
  { type: "appreciated", label: "Write up value" },
  { type: "maintenance_dispatch", label: "Send to maintenance" },
  { type: "maintenance_return", label: "Return from maintenance" },
  { type: "used_up", label: "Dispose" },
  { type: "missing", label: "Report missing" },
];

export interface EquipmentMovementFormProps {
  equipmentId?: string | "new";
  defaultSource?: { id: string; type: LocationKind };
  defaultDestination?: { id: string; type: LocationKind };
  fixedSource?: { id: string; type: LocationKind; name: string };
  fixedDestination?: { id: string; type: LocationKind; name: string };
  allowedActions?: ActionType[];
  noBg?: boolean,
  title?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EquipmentMovementForm({
  equipmentId,
  defaultSource,
  defaultDestination,
  fixedSource,
  fixedDestination,
  allowedActions,
  noBg,
  title,
  onSuccess,
  onCancel,
}: EquipmentMovementFormProps) {
  const store = useStore();
  const { data: licensesData } = useLicenses();
  const licenses = licensesData?.data ?? store.licenses;
  const { data: eqData } = useEquipmentList({});
  const equipment = eqData?.data ?? store.equipment;

  const availableActions = actions.filter(a => !allowedActions || allowedActions.includes(a.type));

  const [selectedEqId, setSelectedEqId] = useState<string>(equipmentId ?? "new");
  const eId = equipmentId || selectedEqId;
  const isCreating = eId === "new";

  const [type, setType] = useState<ActionType>(isCreating ? "purchased" : (allowedActions?.[0] ?? "transferred"));

  // Equipment details (for new creation)
  const [eqName, setEqName] = useState("");
  const [eqSerial, setEqSerial] = useState("");

  // Financial & entity fields
  const [cost, setCost] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [notes, setNotes] = useState("");

  // Location fields
  const [fromKind, setFromKind] = useState<LocationKind | "">(defaultSource?.type ?? "");
  const [fromId, setFromId] = useState(defaultSource?.id ?? "");
  const [toKind, setToKind] = useState<LocationKind | "">(defaultDestination?.type ?? "");
  const [toId, setToId] = useState(defaultDestination?.id ?? "");

  const [msg, setMsg] = useState<string | null>(null);

  const purchaseMutation = usePurchaseEquipment();
  const transferMutation = useTransferEquipment();
  const sellMutation = useSellEquipment();
  const consumeMutation = useConsumeEquipment();
  const missingMutation = useReportMissingEquipment();
  const dispatchMutation = useMaintenanceDispatch();
  const returnMutation = useMaintenanceReturn();
  const degradeMutation = useDegradeEquipment();
  const appreciateMutation = useAppreciateEquipment();

  const isPending =
    purchaseMutation.isPending ||
    transferMutation.isPending ||
    sellMutation.isPending ||
    consumeMutation.isPending ||
    missingMutation.isPending ||
    dispatchMutation.isPending ||
    returnMutation.isPending ||
    degradeMutation.isPending ||
    appreciateMutation.isPending;

  const submit = async () => {
    setMsg(null);
    try {
      const source = fixedSource ? { id: fixedSource.id, type: fixedSource.type as "site" | "warehouse" } : (fromKind && fromId ? { id: fromId, type: fromKind as "site" | "warehouse" } : undefined);
      const destination = fixedDestination ? { id: fixedDestination.id, type: fixedDestination.type as "site" | "warehouse" } : (toKind && toId ? { id: toId, type: toKind as "site" | "warehouse" } : undefined);

      if (!eId) throw new Error("Please select an equipment");

      if (type === "purchased") {
        if (!cost) throw new Error("Cost is required");
        await purchaseMutation.mutateAsync({
          equipmentId: eId,
          purchaseCost: cost,
          destination,
          vendorName: vendorName || undefined,
          licenseId: licenseId || undefined,
          notes: notes || undefined,
          newEquipment: eId === "new" ? { name: eqName, serialNumber: eqSerial || undefined } : undefined,
        });
      } else if (type === "transferred") {
        if (!destination) throw new Error("Destination is required");
        await transferMutation.mutateAsync({
          equipmentId: eId,
          source,
          destination,
          notes: notes || undefined,
        });
      } else if (type === "sold") {
        if (!cost) throw new Error("Selling price is required");
        await sellMutation.mutateAsync({
          equipmentId: eId,
          sellingPrice: cost,
          source,
          buyerName: buyerName || undefined,
          licenseId: licenseId || undefined,
          notes: notes || undefined,
        });
      } else if (type === "maintenance_dispatch") {
        await dispatchMutation.mutateAsync({
          equipmentId: eId,
          source,
          vendorName: vendorName || undefined,
          notes: notes || undefined,
        });
      } else if (type === "maintenance_return") {
        if (!destination) throw new Error("Destination is required");
        await returnMutation.mutateAsync({
          equipmentId: eId,
          destination,
          repairCost: cost || undefined,
          notes: notes || undefined,
        });
      } else if (type === "degraded") {
        await degradeMutation.mutateAsync({
          equipmentId: eId,
          valueAdjustment: cost || undefined,
          notes: notes || undefined,
        });
      } else if (type === "appreciated") {
        await appreciateMutation.mutateAsync({
          equipmentId: eId,
          valueAdjustment: cost || undefined,
          notes: notes || undefined,
        });
      } else if (type === "used_up") {
        await consumeMutation.mutateAsync({
          equipmentId: eId,
          source,
          price: cost || undefined,
          notes: notes || undefined,
        });
      } else if (type === "missing") {
        await missingMutation.mutateAsync({
          equipmentId: eId,
          source,
          notes: notes || undefined,
        });
      }

      setMsg("Queued for approval.");
      if (onSuccess) onSuccess();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className={isCreating || noBg ? "" : "border border-black/10 bg-paper/40 p-5"}>
      {!isCreating && <p className="kicker mb-3">{title || "Raise a movement"}</p>}

      {!equipmentId && (
        <label className="mb-3 block z-10 relative text-sm">
          Equipment
          <div className="mt-1">
            <SearchableSelect
              value={selectedEqId}
              onChange={(val) => {
                setSelectedEqId(val);
                if (val === "new") setType("purchased");
              }}
              options={equipment.map(e => ({ id: e.id, label: e.name, subLabel: e.serialNumber || "No S/N" }))}
              placeholder="Search equipment..."
              onCreateNew={() => {
                setSelectedEqId("new");
                setType("purchased");
              }}
              createNewLabel="+ Create new equipment"
            />
          </div>
        </label>
      )}

      {!isCreating && availableActions.length > 1 && (
        <label className="mb-3 block text-sm">
          Action
          <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as ActionType)}>
            {availableActions.map((a) => (
              <option key={a.type} value={a.type}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {isCreating && (
        <>
          <label className="mb-3 block text-sm">
            Equipment Name
            <input className="field mt-1" value={eqName} onChange={(e) => setEqName(e.target.value)} />
          </label>
          <label className="mb-3 block text-sm">
            Serial Number
            <input className="field mt-1" value={eqSerial} onChange={(e) => setEqSerial(e.target.value)} />
          </label>
        </>
      )}

      {["purchased"].includes(type) && (
        <label className="mb-3 block text-sm">
          Total Cost (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {["sold"].includes(type) && (
        <label className="mb-3 block text-sm">
          Selling Price (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {["maintenance_return"].includes(type) && (
        <label className="mb-3 block text-sm">
          Repair Cost (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {["degraded", "appreciated"].includes(type) && (
        <label className="mb-3 block text-sm">
          Value Adjustment (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {["used_up"].includes(type) && (
        <label className="mb-3 block text-sm">
          Price (ETB)
          <input className="field mt-1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      )}

      {["sold"].includes(type) && (
        <label className="mb-3 block text-sm">
          Buyer
          <input className="field mt-1" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
        </label>
      )}

      {["purchased", "maintenance_dispatch"].includes(type) && (
        <label className="mb-3 block text-sm">
          Vendor
          <input className="field mt-1" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
        </label>
      )}

      {["purchased", "sold"].includes(type) && (
        <label className="mb-3 block text-sm">
          License
          <select className="field mt-1" value={licenseId} onChange={(e) => setLicenseId(e.target.value)}>
            <option value="">Select license</option>
            {licenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {["transferred", "sold", "maintenance_dispatch", "used_up", "missing"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Source</p>
          {fixedSource ? (
            <div className="field mt-1 cursor-not-allowed bg-black/5 text-black/50">
              {fixedSource.name}
            </div>
          ) : (
            <LocationSelect kind={fromKind} id={fromId} onKind={setFromKind} onId={setFromId} />
          )}
        </div>
      )}

      {["purchased", "transferred", "maintenance_return"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Destination</p>
          {fixedDestination ? (
            <div className="field mt-1 cursor-not-allowed bg-black/5 text-black/50">
              {fixedDestination.name}
            </div>
          ) : (
            <LocationSelect kind={toKind} id={toId} onKind={setToKind} onId={setToId} />
          )}
        </div>
      )}

      <label className="mb-3 block text-sm">
        Notes
        <input className="field mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex gap-2 mt-4">
        {onCancel && (
          <button type="button" className="btn btn-ghost w-full" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" className="btn w-full" disabled={isPending} onClick={submit}>
          {isPending ? "Confirming..." : "Confirm"}
        </button>
      </div>
      {msg && <p className="mt-3 text-sm">{msg}</p>}
    </div>
  );
}
