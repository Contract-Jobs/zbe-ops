"use client";

import { useState } from "react";
import { LocationSelect } from "@/components/LocationSelect";
import { isSiteManager, useStore } from "@/lib/store";
import {
  usePurchaseInventoryItem,
  useTransferInventoryItem,
  useSellInventoryItem,
  useConsumeInventoryItem,
  useLogInventoryLoss,
} from "@/hooks/use-inventory-movements";
import { useInventoryItems } from "@/hooks/use-inventory-items";
import { useInventoryNodeId } from "@/hooks/use-inventories";
import { useLicenses } from "@/hooks/use-licenses";
import type { LocationKind } from "@/lib/types";
import { SearchableSelect } from "@/components/ui";
import type { QuantityMovementType } from "@/types/api";

// movementType labels shown to users — internal wire names never rendered raw.
const ACTION_LABELS: Record<QuantityMovementType, string> = {
  purchase: "Purchase",
  transfer: "Transfer",
  sale: "Sell (warehouse only)",
  consume: "Consume",
  loss: "Report loss",
};

export interface MaterialMovementFormProps {
  materialId?: string | "new";
  defaultSource?: { id: string; type: LocationKind };
  defaultDestination?: { id: string; type: LocationKind };
  fixedSource?: { id: string; type: LocationKind; name: string };
  fixedDestination?: { id: string; type: LocationKind; name: string };
  allowedActions?: QuantityMovementType[];
  title?: string;
  noBg?: boolean,
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MaterialMovementForm({
  materialId,
  defaultSource,
  defaultDestination,
  fixedSource,
  fixedDestination,
  allowedActions,
  title,
  onSuccess,
  noBg,
  onCancel,
}: MaterialMovementFormProps) {
  const store = useStore();
  const manager = isSiteManager(store);

  const { data: licensesData } = useLicenses();
  const licenses = licensesData?.data ?? store.licenses;
  // Full catalog pull, not the endpoint's default page size of 10 —
  // SearchableSelect below filters client-side, no server search wired.
  const { data: itemsData } = useInventoryItems({ category: "material", limit: 50, tracking: "quantity" });
  const materials = itemsData?.data ?? store.materials;

  const allActions: Array<{ type: QuantityMovementType; label: string; disabled?: boolean }> = [
    { type: "purchase", label: ACTION_LABELS.purchase },
    { type: "transfer", label: ACTION_LABELS.transfer },
    { type: "sale", label: ACTION_LABELS.sale, disabled: manager },
    { type: "consume", label: ACTION_LABELS.consume },
    { type: "loss", label: ACTION_LABELS.loss },
  ];
  const actions = allActions.filter(a => !allowedActions || allowedActions.includes(a.type));

  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(materialId ?? "");
  const mId = materialId || selectedMaterialId;
  const isCreating = mId === "new";

  const [type, setType] = useState<QuantityMovementType>(isCreating ? "purchase" : (allowedActions?.[0] ?? "transfer"));

  // New Material fields
  const [matName, setMatName] = useState("");
  const [matUnit, setMatUnit] = useState("pcs");

  // Core fields
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [clientName, setClientName] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [reason, setReason] = useState("");

  // Location fields — these carry the site's/warehouse's own id; resolved to
  // an inventory node id below before building the payload (docs/migration.md §2.3).
  const [fromKind, setFromKind] = useState<LocationKind | "">(defaultSource?.type ?? "");
  const [fromId, setFromId] = useState(defaultSource?.id ?? "");
  const [toKind, setToKind] = useState<LocationKind | "">(defaultDestination?.type ?? "");
  const [toId, setToId] = useState(defaultDestination?.id ?? "");

  const sourceKind = fixedSource?.type ?? fromKind;
  const sourceRefId = fixedSource?.id ?? fromId;
  const destKind = fixedDestination?.type ?? toKind;
  const destRefId = fixedDestination?.id ?? toId;

  const { nodeId: sourceNodeId } = useInventoryNodeId(sourceKind, sourceRefId || undefined);
  const { nodeId: destNodeId } = useInventoryNodeId(destKind, destRefId || undefined);

  const [msg, setMsg] = useState<string | null>(null);

  const purchaseMutation = usePurchaseInventoryItem();
  const transferMutation = useTransferInventoryItem();
  const sellMutation = useSellInventoryItem();
  const consumeMutation = useConsumeInventoryItem();
  const lossMutation = useLogInventoryLoss();

  const isPending =
    purchaseMutation.isPending ||
    transferMutation.isPending ||
    sellMutation.isPending ||
    consumeMutation.isPending ||
    lossMutation.isPending;

  const submit = async () => {
    setMsg(null);
    try {
      const qn = Number(quantity);
      if (!qn || qn <= 0) throw new Error("Quantity required");
      if (!mId) throw new Error("Please select a material");

      if (type === "purchase") {
        if (!unitCost) throw new Error("Unit cost is required");
        if (!licenseId) throw new Error("License is required");
        if (!destNodeId) throw new Error("Destination is required");
        await purchaseMutation.mutateAsync({
          itemId: mId === "new" ? undefined : mId,
          quantity: qn,
          destinationInventoryId: destNodeId,
          unitCost,
          clientName: clientName || undefined,
          licenseId,
          autoCreateItem: mId === "new" ? { name: matName, unit: matUnit || "pcs", category: "material" } : undefined,
        });
      } else if (type === "transfer") {
        if (!sourceNodeId || !destNodeId) throw new Error("Source and destination are required for transfer");
        await transferMutation.mutateAsync({
          itemId: mId,
          quantity: qn,
          sourceInventoryId: sourceNodeId,
          destinationInventoryId: destNodeId,
        });
      } else if (type === "sale") {
        if (!unitCost) throw new Error("Unit cost is required");
        if (!licenseId) throw new Error("License is required");
        if (sourceKind !== "warehouse" || !sourceNodeId) throw new Error("Source must be a warehouse for sales");
        if (manager) throw new Error("Site managers cannot sell");

        await sellMutation.mutateAsync({
          itemId: mId,
          quantity: qn,
          sourceInventoryId: sourceNodeId,
          unitCost,
          clientName: clientName || undefined,
          licenseId,
        });
      } else if (type === "consume") {
        if (!sourceNodeId) throw new Error("Source is required");
        await consumeMutation.mutateAsync({
          itemId: mId,
          quantity: qn,
          sourceInventoryId: sourceNodeId,
        });
      } else if (type === "loss") {
        if (!sourceNodeId) throw new Error("Source is required");
        if (!reason.trim()) throw new Error("Reason is required");
        await lossMutation.mutateAsync({
          itemId: mId,
          quantity: qn,
          sourceInventoryId: sourceNodeId,
          metadata: { reason: reason.trim() },
        });
      }

      setMsg("Queued for approval.");
      if (onSuccess) onSuccess();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className={isCreating || noBg ? "" : "border border-black/10 bg-paper/40 p-5 h-max"}>
      {!isCreating && <p className="kicker mb-3">{title || "Raise a movement"}</p>}

      {!materialId && (
        <label className="mb-3 block z-10 relative text-sm">
          Material
          <div className="mt-1">
            <SearchableSelect
              value={selectedMaterialId}
              onChange={(val) => {
                setSelectedMaterialId(val);
                if (val === "new") setType("purchase");
              }}
              options={materials.map(m => ({ id: m.id, label: m.name }))}
              placeholder="Search material..."
              onCreateNew={() => {
                setSelectedMaterialId("new");
                setType("purchase");
              }}
              createNewLabel="+ Create new material"
            />
          </div>
        </label>
      )}

      {!isCreating && actions.length > 1 && (
        <label className="mb-3 block text-sm">
          Action
          <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as QuantityMovementType)}>
            {actions.map((a) => (
              <option key={a.type} value={a.type} disabled={a.disabled}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {isCreating && (
        <>
          <label className="mb-3 block text-sm">
            Material Name
            <input className="field mt-1" value={matName} onChange={(e) => setMatName(e.target.value)} />
          </label>
          <label className="mb-3 block text-sm">
            Unit
            <input className="field mt-1" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} />
          </label>
        </>
      )}

      <label className="mb-3 block text-sm">
        Quantity
        <input className="field mt-1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>

      {["purchase", "sale"].includes(type) && (
        <label className="mb-3 block text-sm">
          Unit Cost (ETB)
          <input className="field mt-1" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </label>
      )}

      {type === "sale" && (
        <label className="mb-3 block text-sm">
          Buyer
          <input className="field mt-1" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        </label>
      )}

      {["purchase", "sale"].includes(type) && (
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

      {["transfer", "sale", "consume", "loss"].includes(type) && (
        <div className="mb-3">
          <p className="mb-1 text-sm">Source</p>
          {fixedSource ? (
            <div className="field mt-1 cursor-not-allowed bg-black/5 text-black/50">
              {fixedSource.name}
            </div>
          ) : (
            <LocationSelect
              kind={fromKind}
              id={fromId}
              onKind={setFromKind}
              onId={setFromId}
              allowSite={type !== "sale"} // Only warehouses can sell
            />
          )}
        </div>
      )}

      {["purchase", "transfer"].includes(type) && (
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

      {type === "loss" ? (
        <label className="mb-3 block text-sm">
          Reason
          <input className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
      ) : null}

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
